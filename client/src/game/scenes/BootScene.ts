import Phaser from 'phaser';
import type { GameBridge } from '../bridge/GameBridge';

export const BOOT_SCENE_KEY = 'BootScene';

/**
 * Stage 1 placeholder scene: starfield + a placeholder astronaut built from
 * shapes, proving Phaser renders and talks to React through the bridge.
 * Player movement arrives in stage 2.
 */
export class BootScene extends Phaser.Scene {
  private bridge!: GameBridge;
  private fpsTimer = 0;
  private unsubscribePause: (() => void) | undefined;

  constructor() {
    super(BOOT_SCENE_KEY);
  }

  init(data: { bridge: GameBridge }): void {
    this.bridge = data.bridge;
  }

  create(): void {
    const { width, height } = this.scale;

    // Starfield
    const stars = this.add.graphics();
    for (let i = 0; i < 160; i += 1) {
      const alpha = Phaser.Math.FloatBetween(0.3, 1);
      stars.fillStyle(0xffffff, alpha);
      stars.fillCircle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.FloatBetween(0.5, 1.8),
      );
    }

    // Placeholder astronaut (temporary — replaced by sprite sheet in stage 2)
    const body = this.add.container(width / 2, height / 2);
    body.add([
      this.add.rectangle(-26, 6, 14, 34, 0x0284c7).setOrigin(0.5),
      this.add.ellipse(0, 0, 48, 64, 0x38bdf8),
      this.add.ellipse(8, -10, 30, 18, 0xe0f2fe),
      this.add.rectangle(-10, 30, 14, 14, 0x38bdf8),
      this.add.rectangle(10, 30, 14, 14, 0x38bdf8),
    ]);
    this.tweens.add({
      targets: body,
      y: height / 2 - 10,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(width / 2, height / 2 + 80, 'Phaser OK', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#a5b4fc',
      })
      .setOrigin(0.5);

    this.unsubscribePause = this.bridge.on('ui:pause', ({ paused }) => {
      if (paused) this.scene.pause();
      else this.scene.resume();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribePause?.());

    this.bridge.emit('game:ready', { sceneKey: BOOT_SCENE_KEY });
  }

  override update(_time: number, delta: number): void {
    this.fpsTimer += delta;
    if (this.fpsTimer >= 1000) {
      this.fpsTimer = 0;
      this.bridge.emit('game:fps', { fps: Math.round(this.game.loop.actualFps) });
    }
  }
}
