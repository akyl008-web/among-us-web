import Phaser from 'phaser';
import {
  findRoomAt,
  getVelocity,
  IDLE_INPUT,
  isMoving,
  LIGHTS_OUT_VISION,
  moveWithCollision,
  Role,
  SKYWARD_MAP,
  type MoveInput,
  type PublicPlayer,
  type RoomView,
  type WorldSnapshot,
} from '@stellar/shared';
import { characterTextureKey } from '../art/characterTextures';
import { PlayerSprite } from '../entities/PlayerSprite';
import { KeyboardInput } from '../input/KeyboardInput';
import { Interpolator } from '../world/Interpolator';
import { createShipMap } from '../world/shipMap';
import { computeProximity, NO_PROXIMITY, sameProximity, type Proximity } from '../world/proximity';
import type { SceneDeps } from './sceneDeps';

export const SHIP_SCENE_KEY = 'ShipScene';

const SNAP_DISTANCE = 80; // server correction beyond this = teleport (meeting, kill snap)
const INPUT_RESEND_MS = 100;
const PROXIMITY_INTERVAL_MS = 100;

interface RemoteState {
  sprite: PlayerSprite;
  interp: Interpolator;
  moving: boolean;
  facing: 1 | -1;
  ghost: boolean;
}

/**
 * The ship world: renders the Tiled map, players and bodies.
 * Local player: client-side prediction with the SAME collision code as the server,
 * softly corrected toward the authoritative position. Remote players: interpolation.
 */
export class ShipScene extends Phaser.Scene {
  private deps!: SceneDeps;
  private keyboard!: KeyboardInput;
  private readonly remotes = new Map<string, RemoteState>();
  private readonly bodies = new Map<string, Phaser.GameObjects.Sprite>();
  private self: PlayerSprite | null = null;
  private selfPos = { x: 0, y: 0 };
  private selfFacing: 1 | -1 = 1;
  private serverSelf: { x: number; y: number } | null = null;
  private lastInput: MoveInput = { ...IDLE_INPUT };
  private lastInputSentAt = 0;
  private inputLocked = false;
  private proximity: Proximity = NO_PROXIMITY;
  private proximityTimer = 0;
  private lastRoomName: string | null | undefined;
  private taskMarkers = new Map<string, Phaser.GameObjects.Container>();
  private stationMarkers = new Map<string, Phaser.GameObjects.Arc>();
  private darkness!: Phaser.GameObjects.RenderTexture;
  private visionBrush!: Phaser.GameObjects.Graphics;
  private cleanups: (() => void)[] = [];

  constructor() {
    super(SHIP_SCENE_KEY);
  }

  init(data: SceneDeps): void {
    this.deps = data;
  }

  create(): void {
    createShipMap(this);
    this.createMarkers();
    this.keyboard = new KeyboardInput(this);

    // Darkness overlay for the "lights" sabotage (crewmates only).
    this.darkness = this.add
      .renderTexture(0, 0, this.scale.width, this.scale.height)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(1_000_000)
      .setVisible(false);
    this.visionBrush = this.make.graphics({ x: 0, y: 0 }, false);
    for (let i = 10; i >= 1; i--) {
      this.visionBrush.fillStyle(0xffffff, 0.12);
      this.visionBrush.fillCircle(0, 0, LIGHTS_OUT_VISION * (0.55 + i * 0.045));
    }
    this.visionBrush.fillStyle(0xffffff, 1);
    this.visionBrush.fillCircle(0, 0, LIGHTS_OUT_VISION * 0.55);

    const { session, bridge } = this.deps;
    this.cleanups.push(
      session.onSnapshot((snap, at) => this.applySnapshot(snap, at)),
      bridge.on('ui:inputLocked', ({ locked }) => {
        this.inputLocked = locked;
      }),
    );
    if (session.latestSnapshot) this.applySnapshot(session.latestSnapshot, performance.now());
    // Game.destroy() emits DESTROY (not SHUTDOWN) — unsubscribe on both, exactly once.
    const cleanup = () => {
      this.cleanups.forEach((fn) => fn());
      this.cleanups = [];
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
    // Phaser defers Game.destroy() to the next frame; React's abort is immediate.
    this.deps.signal.addEventListener('abort', cleanup, { once: true });
    bridge.emit('game:ready', { sceneKey: SHIP_SCENE_KEY });
  }

  override update(_time: number, delta: number): void {
    const room = this.deps.session.getState().room;
    if (!room) return;
    const me = room.players.find((p) => p.id === room.you.id);

    if (room.phase === 'PLAYING' && this.self && me) {
      this.updateLocalPlayer(room, delta);
    }
    this.renderRemotes(room);
    this.updateMarkers(room);
    this.updateDarkness(room);

    this.proximityTimer += delta;
    if (this.proximityTimer >= PROXIMITY_INTERVAL_MS) {
      this.proximityTimer = 0;
      this.updateProximity(room);
    }
  }

  // ------------------------------------------------------------ world setup

  private createMarkers(): void {
    for (const task of SKYWARD_MAP.tasks) {
      const ring = this.add.circle(0, 0, 18).setStrokeStyle(3, 0xfacc15);
      const arrow = this.add.triangle(0, -34, 0, 0, 14, 0, 7, 10, 0xfacc15);
      const marker = this.add
        .container(task.x, task.y, [ring, arrow])
        .setDepth(-500)
        .setVisible(false);
      this.tweens.add({
        targets: arrow,
        y: -28,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.tweens.add({
        targets: ring,
        scale: 1.2,
        alpha: 0.5,
        duration: 800,
        yoyo: true,
        repeat: -1,
      });
      this.taskMarkers.set(task.id, marker);
    }
    for (const station of SKYWARD_MAP.sabotageStations) {
      const marker = this.add
        .circle(station.x, station.y, 22)
        .setStrokeStyle(4, 0xef4444)
        .setDepth(-500)
        .setVisible(false);
      this.tweens.add({
        targets: marker,
        scale: 1.3,
        alpha: 0.4,
        duration: 400,
        yoyo: true,
        repeat: -1,
      });
      this.stationMarkers.set(station.id, marker);
    }
  }

  // ------------------------------------------------------------ networking

  private applySnapshot(snap: WorldSnapshot, receivedAt: number): void {
    const room = this.deps.session.getState().room;
    if (!room) return;
    const seen = new Set<string>();

    for (const p of snap.players) {
      seen.add(p.id);
      const info = room.players.find((pl) => pl.id === p.id);
      if (!info) continue;
      if (p.id === room.you.id) {
        this.serverSelf = { x: p.x, y: p.y };
        if (!this.self) {
          this.self = new PlayerSprite(this, p.x, p.y, info.color, info.name, true);
          this.selfPos = { x: p.x, y: p.y };
          this.cameras.main.startFollow(this.self.sprite, true, 0.15, 0.15);
        }
        continue;
      }
      let remote = this.remotes.get(p.id);
      if (!remote) {
        remote = {
          sprite: new PlayerSprite(this, p.x, p.y, info.color, info.name, false),
          interp: new Interpolator(),
          moving: false,
          facing: 1,
          ghost: p.ghost,
        };
        this.remotes.set(p.id, remote);
      }
      remote.interp.push(p.x, p.y, receivedAt);
      remote.moving = p.moving;
      remote.facing = p.facing;
      remote.ghost = p.ghost;
    }

    for (const [id, remote] of this.remotes) {
      if (!seen.has(id)) {
        remote.sprite.destroy();
        this.remotes.delete(id);
      }
    }

    const bodyIds = new Set(snap.bodies.map((b) => b.ownerId));
    for (const body of snap.bodies) {
      if (this.bodies.has(body.ownerId)) continue;
      const color = room.players.find((p) => p.id === body.ownerId)?.color ?? 'white';
      const sprite = this.add
        .sprite(body.x, body.y, characterTextureKey(color), 'dead')
        .setOrigin(0.5, 0.85)
        .setDepth(body.y - 1);
      this.bodies.set(body.ownerId, sprite);
    }
    for (const [id, sprite] of this.bodies) {
      if (!bodyIds.has(id)) {
        sprite.destroy();
        this.bodies.delete(id);
      }
    }
  }

  private updateLocalPlayer(room: RoomView, delta: number): void {
    const busy = this.inputLocked || room.you.activeTaskId !== null;
    const input = busy ? { ...IDLE_INPUT } : this.keyboard.read();

    // Prediction: the same movement + collision code the server runs.
    const v = getVelocity(input);
    const dt = Math.min(delta, 100) / 1000;
    if (room.you.alive) {
      this.selfPos = moveWithCollision(SKYWARD_MAP.grid, this.selfPos, v.x * dt, v.y * dt);
    } else {
      this.selfPos = {
        x: Phaser.Math.Clamp(this.selfPos.x + v.x * dt, 16, SKYWARD_MAP.widthPx - 16),
        y: Phaser.Math.Clamp(this.selfPos.y + v.y * dt, 16, SKYWARD_MAP.heightPx - 16),
      };
    }
    if (v.x !== 0) this.selfFacing = v.x > 0 ? 1 : -1;

    // Reconciliation: snap on big errors (teleports), otherwise drift toward the server.
    if (this.serverSelf) {
      const dx = this.serverSelf.x - this.selfPos.x;
      const dy = this.serverSelf.y - this.selfPos.y;
      const error = Math.hypot(dx, dy);
      if (error > SNAP_DISTANCE) this.selfPos = { ...this.serverSelf };
      else {
        const k = isMoving(input) ? 0.04 : 0.2;
        this.selfPos = { x: this.selfPos.x + dx * k, y: this.selfPos.y + dy * k };
      }
    }

    const me = room.players.find((p) => p.id === room.you.id);
    if (me) this.syncIdentity(this.self!, me);
    this.self!.update(
      this.selfPos.x,
      this.selfPos.y,
      isMoving(input),
      this.selfFacing,
      !room.you.alive,
    );

    // Send intent when it changes, and periodically while moving.
    const now = performance.now();
    const changed =
      input.up !== this.lastInput.up ||
      input.down !== this.lastInput.down ||
      input.left !== this.lastInput.left ||
      input.right !== this.lastInput.right;
    if (changed || (isMoving(input) && now - this.lastInputSentAt > INPUT_RESEND_MS)) {
      this.deps.session.sendInput(input);
      this.lastInput = input;
      this.lastInputSentAt = now;
    }

    const roomName = findRoomAt(SKYWARD_MAP, this.selfPos);
    if (roomName !== this.lastRoomName) {
      this.lastRoomName = roomName;
      this.deps.bridge.emit('game:location', { room: roomName });
    }
  }

  private renderRemotes(room: RoomView): void {
    const now = performance.now();
    const impostorTeam = room.you.role === Role.IMPOSTOR ? new Set(room.impostorIds) : null;
    for (const [id, remote] of this.remotes) {
      const pos = remote.interp.sample(now);
      if (!pos) continue;
      const info = room.players.find((p) => p.id === id);
      if (info) this.syncIdentity(remote.sprite, info);
      const nameColor = impostorTeam?.has(id) ? '#f87171' : undefined;
      remote.sprite.update(pos.x, pos.y, remote.moving, remote.facing, remote.ghost, nameColor);
    }
  }

  private syncIdentity(sprite: PlayerSprite, info: PublicPlayer): void {
    sprite.setColor(this, info.color);
    sprite.setName(info.name);
  }

  // ------------------------------------------------------------- overlays

  private updateMarkers(room: RoomView): void {
    const showTasks = room.phase === 'PLAYING' && room.you.role === Role.CREWMATE && room.you.alive;
    for (const [id, marker] of this.taskMarkers) {
      const own = room.you.tasks.find((t) => t.id === id);
      marker.setVisible(showTasks && !!own && !own.done);
    }
    for (const [id, marker] of this.stationMarkers) {
      const station = SKYWARD_MAP.sabotageStations.find((s) => s.id === id)!;
      const active =
        room.sabotage?.type === station.sabotage && !room.sabotage.fixedStationIds.includes(id);
      marker.setVisible(room.phase === 'PLAYING' && active);
    }
  }

  private updateDarkness(room: RoomView): void {
    const dark =
      room.phase === 'PLAYING' &&
      room.sabotage?.type === 'LIGHTS' &&
      room.you.role === Role.CREWMATE &&
      room.you.alive;
    this.darkness.setVisible(dark);
    if (!dark || !this.self) return;
    const cam = this.cameras.main;
    this.darkness.clear();
    this.darkness.fill(0x000000, 0.93);
    this.darkness.erase(
      this.visionBrush,
      this.selfPos.x - cam.scrollX,
      this.selfPos.y - 30 - cam.scrollY,
    );
  }

  private updateProximity(room: RoomView): void {
    const others = [...this.remotes.entries()]
      .filter(([, r]) => !r.ghost)
      .map(([id, r]) => ({ id, x: r.sprite.sprite.x, y: r.sprite.sprite.y }));
    const bodies = [...this.bodies.entries()].map(([ownerId, s]) => ({ ownerId, x: s.x, y: s.y }));
    const next = this.self
      ? computeProximity(this.selfPos, room, SKYWARD_MAP, others, bodies)
      : NO_PROXIMITY;
    if (!sameProximity(next, this.proximity)) {
      this.proximity = next;
      this.deps.bridge.emit('game:proximity', next);
    }
  }
}
