import { beforeEach, describe, expect, it } from 'vitest';
import {
  GamePhase,
  INITIAL_KILL_COOLDOWN_MS,
  REACTOR_MELTDOWN_MS,
  RESULT_DURATION_MS,
  Role,
  SKYWARD_MAP,
  STARTING_COUNTDOWN_MS,
  type ChatMessage,
  type GameNotice,
} from '@stellar/shared';
import { GameError } from './GameError.js';
import { GameRoom, type MatchSummary } from './GameRoom.js';
import type { Rng } from './random.js';

/** Deterministic RNG: always picks index 0 → first players in join order become impostors. */
const firstRng: Rng = { int: () => 0 };

function setup(playerCount = 5, impostors = 1) {
  let time = 1_000_000;
  const events = {
    chats: [] as ChatMessage[],
    notices: [] as [string | null, GameNotice][],
    summaries: [] as MatchSummary[],
  };
  const room = new GameRoom({
    code: 'TEST22',
    map: SKYWARD_MAP,
    rng: firstRng,
    now: () => time,
    minPlayers: 3,
    listener: {
      onStateChanged: () => {},
      onChat: (m) => events.chats.push(m),
      onNotice: (id, n) => events.notices.push([id, n]),
      onPlayerRemoved: () => {},
      onMatchFinished: (s) => events.summaries.push(s),
    },
  });
  const ids = Array.from(
    { length: playerCount },
    (_, i) => room.addPlayer(`Player${i}`, undefined, null).id,
  );
  const host = ids[0]!;
  room.updateSettings(host, {
    impostorCount: impostors,
    discussionSec: 0,
    votingSec: 30,
    killCooldownSec: 20,
  });
  const advance = (ms: number) => {
    time += ms;
    room.tick();
  };
  const begin = () => {
    room.start(host);
    advance(STARTING_COUNTDOWN_MS);
    expect(room.currentPhase).toBe(GamePhase.PLAYING);
  };
  const byRole = (role: Role) => ids.filter((id) => room.getPlayer(id)!.role === role);
  const moveTo = (id: string, x: number, y: number) => {
    const p = room.getPlayer(id)!;
    p.x = x;
    p.y = y;
  };
  return { room, ids, host, advance, begin, byRole, moveTo, events, now: () => time };
}

const expectError = (fn: () => void, code: string) => {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(GameError);
    expect((err as GameError).code).toBe(code);
    return;
  }
  throw new Error(`Expected GameError ${code}`);
};

describe('GameRoom: lobby', () => {
  it('assigns unique colors and names and makes the first player host', () => {
    const { room, ids } = setup(3);
    const view = room.viewFor(ids[1]!);
    expect(view.hostId).toBe(ids[0]);
    expect(new Set(view.players.map((p) => p.color)).size).toBe(3);
    const dup = room.addPlayer('Player0', undefined, null);
    expect(dup.name).toBe('Player0 2');
  });

  it('only lets the host change settings and start', () => {
    const { room, ids } = setup(4);
    expectError(() => room.updateSettings(ids[1]!, { impostorCount: 2 }), 'NOT_HOST');
    expectError(() => room.start(ids[1]!), 'NOT_HOST');
  });

  it('refuses to start without enough players for the impostor count', () => {
    const { room, host } = setup(4, 2); // 2 impostors vs 2 crew: not allowed
    expectError(() => room.start(host), 'NOT_ENOUGH_PLAYERS');
  });

  it('rejects joining a running game and a taken color', () => {
    const { room, ids, begin } = setup(4);
    expectError(
      () => room.updateLobby(ids[1]!, { color: room.getPlayer(ids[0]!)!.color }),
      'COLOR_TAKEN',
    );
    begin();
    expectError(() => room.addPlayer('Late', undefined, null), 'GAME_IN_PROGRESS');
  });
});

describe('GameRoom: roles and privacy', () => {
  it('assigns the configured number of impostors', () => {
    const { begin, byRole } = setup(7, 2);
    begin();
    expect(byRole(Role.IMPOSTOR)).toHaveLength(2);
    expect(byRole(Role.CREWMATE)).toHaveLength(5);
  });

  it('never reveals roles of others to crewmates, but impostors see their team', () => {
    const { room, begin, byRole } = setup(7, 2);
    begin();
    const crewView = room.viewFor(byRole(Role.CREWMATE)[0]!);
    expect(crewView.you.role).toBe(Role.CREWMATE);
    expect(crewView.impostorIds).toEqual([]);
    expect(JSON.stringify(crewView)).not.toContain('IMPOSTOR');

    const impView = room.viewFor(byRole(Role.IMPOSTOR)[0]!);
    expect(impView.impostorIds.sort()).toEqual(byRole(Role.IMPOSTOR).sort());
    expect(impView.you.fakeTasks).toBe(true);
    expect(impView.you.killCooldownMs).not.toBeNull();
    expect(crewView.you.killCooldownMs).toBeNull();
  });
});

describe('GameRoom: kills', () => {
  let ctx: ReturnType<typeof setup>;
  let impostor: string;
  let crew: string[];

  beforeEach(() => {
    ctx = setup(5);
    ctx.begin();
    impostor = ctx.byRole(Role.IMPOSTOR)[0]!;
    crew = ctx.byRole(Role.CREWMATE);
    const spawn = SKYWARD_MAP.spawns[0]!;
    ctx.moveTo(impostor, spawn.x, spawn.y);
    ctx.moveTo(crew[0]!, spawn.x + 40, spawn.y);
  });

  it('enforces the initial cooldown, then allows a kill in range', () => {
    expectError(() => ctx.room.kill(impostor, crew[0]!), 'COOLDOWN');
    ctx.advance(INITIAL_KILL_COOLDOWN_MS);
    ctx.room.kill(impostor, crew[0]!);
    expect(ctx.room.getPlayer(crew[0]!)!.alive).toBe(false);
    expect(ctx.room.snapshotFor(crew[1]!).bodies).toHaveLength(1);
  });

  it('rejects kills that are too far, by crewmates, or on impostors', () => {
    ctx.advance(INITIAL_KILL_COOLDOWN_MS);
    ctx.moveTo(crew[0]!, 2000, 2000);
    expectError(() => ctx.room.kill(impostor, crew[0]!), 'TOO_FAR');
    expectError(() => ctx.room.kill(crew[1]!, crew[2]!), 'NOT_ALLOWED');
    expectError(() => ctx.room.kill(impostor, impostor), 'NOT_ALLOWED');
  });

  it('hides the death from the living until it is revealed, and ghosts from snapshots', () => {
    ctx.advance(INITIAL_KILL_COOLDOWN_MS);
    ctx.room.kill(impostor, crew[0]!);
    const witnessView = ctx.room.viewFor(crew[1]!);
    expect(witnessView.players.find((p) => p.id === crew[0])!.isDead).toBe(false);
    expect(ctx.room.snapshotFor(crew[1]!).players.some((p) => p.id === crew[0])).toBe(false);
    // the ghost sees itself and everyone
    expect(ctx.room.viewFor(crew[0]!).you.alive).toBe(false);
    expect(ctx.room.snapshotFor(crew[0]!).players.some((p) => p.id === crew[0] && p.ghost)).toBe(
      true,
    );
  });

  it('stops dead players from acting', () => {
    ctx.advance(INITIAL_KILL_COOLDOWN_MS);
    ctx.room.kill(impostor, crew[0]!);
    expectError(() => ctx.room.callEmergency(crew[0]!), 'NOT_ALLOWED');
    const taskId = ctx.room.getPlayer(crew[0]!)!.tasks[0]!.id;
    expectError(() => ctx.room.startTask(crew[0]!, taskId), 'NOT_ALLOWED');
  });
});

describe('GameRoom: meetings and voting', () => {
  it('runs report → vote → ejection → back to playing', () => {
    const ctx = setup(5);
    ctx.begin();
    const [imp] = ctx.byRole(Role.IMPOSTOR);
    const crew = ctx.byRole(Role.CREWMATE);
    const s = SKYWARD_MAP.spawns[0]!;
    ctx.moveTo(imp!, s.x, s.y);
    ctx.moveTo(crew[0]!, s.x + 30, s.y);
    ctx.moveTo(crew[1]!, s.x + 60, s.y);
    ctx.advance(INITIAL_KILL_COOLDOWN_MS);
    ctx.room.kill(imp!, crew[0]!);
    ctx.room.reportBody(crew[1]!, crew[0]!);
    expect(ctx.room.currentPhase).toBe(GamePhase.MEETING);
    // death is now public
    expect(ctx.room.viewFor(crew[2]!).players.find((p) => p.id === crew[0])!.isDead).toBe(true);

    expectError(() => ctx.room.vote(crew[0]!, imp!), 'NOT_ALLOWED'); // dead can't vote
    ctx.room.vote(crew[1]!, imp!);
    expectError(() => ctx.room.vote(crew[1]!, null), 'ALREADY_DONE'); // no double voting
    // votes stay secret during the meeting
    expect(ctx.room.viewFor(crew[2]!).meeting!.votedIds).toEqual([crew[1]]);
    ctx.room.vote(crew[2]!, imp!);
    ctx.room.vote(crew[3]!, imp!);
    ctx.room.vote(imp!, null); // everyone alive voted → result
    expect(ctx.room.currentPhase).toBe(GamePhase.RESULT);
    const result = ctx.room.viewFor(crew[1]!).result!;
    expect(result.ejectedId).toBe(imp);
    expect(result.ejectedWasImpostor).toBe(true);

    ctx.advance(RESULT_DURATION_MS);
    expect(ctx.room.currentPhase).toBe(GamePhase.FINISHED);
    expect(ctx.room.viewFor(crew[1]!).gameOver).toMatchObject({
      winner: 'CREW',
      reason: 'IMPOSTORS_ELIMINATED',
    });
    expect(ctx.events.summaries).toHaveLength(1);
  });

  it('ejects nobody on a tie or when skip wins', () => {
    const ctx = setup(5);
    ctx.begin();
    ctx.room.getPlayer(ctx.ids[1]!)!.x = SKYWARD_MAP.emergencyButton.x + 40;
    ctx.room.getPlayer(ctx.ids[1]!)!.y = SKYWARD_MAP.emergencyButton.y + 50;
    ctx.room.callEmergency(ctx.ids[1]!);
    const [a, b, c, d, e] = ctx.ids as [string, string, string, string, string];
    ctx.room.vote(a, b);
    ctx.room.vote(b, a);
    ctx.room.vote(c, null);
    ctx.room.vote(d, null);
    ctx.room.vote(e, null);
    expect(ctx.room.viewFor(a).result!.ejectedId).toBeNull();
    ctx.advance(RESULT_DURATION_MS);
    expect(ctx.room.currentPhase).toBe(GamePhase.PLAYING);
  });

  it('allows only one emergency meeting per player by default', () => {
    const ctx = setup(5);
    ctx.begin();
    const b = SKYWARD_MAP.emergencyButton;
    ctx.moveTo(ctx.ids[1]!, b.x + 40, b.y + 50);
    ctx.room.callEmergency(ctx.ids[1]!);
    ctx.advance(31_000); // voting timeout → result
    ctx.advance(RESULT_DURATION_MS);
    ctx.moveTo(ctx.ids[1]!, b.x + 40, b.y + 50);
    expectError(() => ctx.room.callEmergency(ctx.ids[1]!), 'NOT_ALLOWED');
  });

  it('relays chat only during meetings and only from the living', () => {
    const ctx = setup(4);
    ctx.begin();
    expectError(() => ctx.room.chat(ctx.ids[0]!, 'hi'), 'INVALID_STATE');
    const b = SKYWARD_MAP.emergencyButton;
    ctx.moveTo(ctx.ids[0]!, b.x + 40, b.y + 50);
    ctx.room.callEmergency(ctx.ids[0]!);
    ctx.room.chat(ctx.ids[0]!, 'Who was in Electrical?');
    expect(ctx.events.chats[0]!.text).toBe('Who was in Electrical?');
  });
});

describe('GameRoom: tasks', () => {
  it('validates proximity and minimum duration, and wins by tasks', () => {
    const ctx = setup(4);
    ctx.room.updateSettings(ctx.host, { tasksPerPlayer: 1 });
    ctx.begin();
    const crew = ctx.byRole(Role.CREWMATE);
    for (const id of crew) {
      const taskId = ctx.room.getPlayer(id)!.tasks[0]!.id;
      const task = SKYWARD_MAP.tasks.find((t) => t.id === taskId)!;
      ctx.moveTo(id, 0, 0);
      expectError(() => ctx.room.startTask(id, taskId), 'TOO_FAR');
      ctx.moveTo(id, task.x, task.y);
      ctx.room.startTask(id, taskId);
      expectError(() => ctx.room.completeTask(id, taskId), 'NOT_ALLOWED'); // too fast
      ctx.advance(3_000);
      if (ctx.room.currentPhase === GamePhase.PLAYING) ctx.room.completeTask(id, taskId);
    }
    expect(ctx.room.currentPhase).toBe(GamePhase.FINISHED);
    expect(ctx.room.viewFor(crew[0]!).gameOver!.reason).toBe('TASKS');
  });

  it('does not let impostors complete tasks', () => {
    const ctx = setup(4);
    ctx.begin();
    const imp = ctx.byRole(Role.IMPOSTOR)[0]!;
    const taskId = ctx.room.getPlayer(imp)!.tasks[0]!.id;
    expectError(() => ctx.room.startTask(imp, taskId), 'NOT_ALLOWED');
  });
});

describe('GameRoom: sabotage and win conditions', () => {
  it('impostors win when the reactor is not fixed in time', () => {
    const ctx = setup(4);
    ctx.begin();
    const imp = ctx.byRole(Role.IMPOSTOR)[0]!;
    expectError(() => ctx.room.triggerSabotage(imp, 'REACTOR'), 'COOLDOWN');
    ctx.advance(INITIAL_KILL_COOLDOWN_MS);
    ctx.room.triggerSabotage(imp, 'REACTOR');
    expectError(() => ctx.room.callEmergency(ctx.byRole(Role.CREWMATE)[0]!), 'NOT_ALLOWED');
    ctx.advance(REACTOR_MELTDOWN_MS);
    expect(ctx.room.viewFor(imp).gameOver).toMatchObject({
      winner: 'IMPOSTORS',
      reason: 'REACTOR_MELTDOWN',
    });
  });

  it('requires both reactor panels to fix it', () => {
    const ctx = setup(4);
    ctx.begin();
    const imp = ctx.byRole(Role.IMPOSTOR)[0]!;
    const [c1] = ctx.byRole(Role.CREWMATE);
    ctx.advance(INITIAL_KILL_COOLDOWN_MS);
    ctx.room.triggerSabotage(imp, 'REACTOR');
    const panels = SKYWARD_MAP.sabotageStations.filter((s) => s.sabotage === 'REACTOR');
    ctx.moveTo(c1!, panels[0]!.x, panels[0]!.y);
    ctx.room.fixSabotage(c1!, panels[0]!.id);
    expect(ctx.room.viewFor(c1!).sabotage).not.toBeNull();
    ctx.moveTo(c1!, panels[1]!.x, panels[1]!.y);
    ctx.room.fixSabotage(c1!, panels[1]!.id);
    expect(ctx.room.viewFor(c1!).sabotage).toBeNull();
  });

  it('impostors win when they equal the crew', () => {
    const ctx = setup(3); // 1 impostor vs 2 crew
    ctx.begin();
    const imp = ctx.byRole(Role.IMPOSTOR)[0]!;
    const [c1] = ctx.byRole(Role.CREWMATE);
    const s = SKYWARD_MAP.spawns[0]!;
    ctx.moveTo(imp, s.x, s.y);
    ctx.moveTo(c1!, s.x + 20, s.y);
    ctx.advance(INITIAL_KILL_COOLDOWN_MS);
    ctx.room.kill(imp, c1!);
    expect(ctx.room.viewFor(imp).gameOver).toMatchObject({
      winner: 'IMPOSTORS',
      reason: 'CREW_OUTNUMBERED',
    });
  });
});

describe('GameRoom: movement and disconnects', () => {
  it('moves players on the server from input intents and ignores stale inputs', () => {
    const ctx = setup(4);
    ctx.begin();
    const id = ctx.ids[0]!;
    const startX = ctx.room.getPlayer(id)!.x;
    ctx.room.handleInput(id, { seq: 2, up: false, down: false, left: false, right: true });
    ctx.advance(50);
    ctx.advance(50);
    expect(ctx.room.getPlayer(id)!.x).toBeGreaterThan(startX);
    ctx.room.handleInput(id, { seq: 1, up: false, down: false, left: true, right: false }); // stale
    expect(ctx.room.getPlayer(id)!.input.right).toBe(true);
  });

  it('removes a disconnected player after the grace period and migrates host', () => {
    const ctx = setup(3);
    ctx.room.setConnected(ctx.host, false);
    ctx.advance(16_000);
    expect(ctx.room.getPlayer(ctx.host)).toBeUndefined();
    expect(ctx.room.viewFor(ctx.ids[1]!).hostId).toBe(ctx.ids[1]);
  });

  it('evaluates simultaneous timeouts as one batch (impostor among them → crew wins)', () => {
    const ctx = setup(4);
    ctx.begin();
    const others = ctx.ids.filter((id) => id !== ctx.host);
    for (const id of others) ctx.room.setConnected(id, false);
    ctx.advance(46_000);
    const over = ctx.room.viewFor(ctx.host).gameOver;
    const impostorLeft = others.some((id) => over?.roles[id] === Role.IMPOSTOR);
    expect(over?.winner).toBe(impostorLeft ? 'CREW' : 'IMPOSTORS');
    expect(ctx.room.viewFor(ctx.host).players).toHaveLength(4); // roles of leavers still revealed
  });

  it('crew wins when the impostor leaves mid-game', () => {
    const ctx = setup(4);
    ctx.begin();
    ctx.room.removePlayer(ctx.byRole(Role.IMPOSTOR)[0]!);
    expect(ctx.room.currentPhase).toBe(GamePhase.FINISHED);
  });
});
