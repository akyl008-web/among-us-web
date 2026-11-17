import Phaser from 'phaser';
import type { MoveInput } from '@stellar/shared';

type MoveKeys = Record<
  'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT',
  Phaser.Input.Keyboard.Key
>;

/**
 * Reads WASD + arrow keys and produces a MoveInput (intent).
 * Key capture is disabled so React text inputs (chat, name) still receive W/A/S/D.
 */
export class KeyboardInput {
  private readonly keys: MoveKeys;
  private enabled = true;

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input plugin is disabled in the Phaser config');
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = keyboard.addKeys(
      { W: K.W, A: K.A, S: K.S, D: K.D, UP: K.UP, DOWN: K.DOWN, LEFT: K.LEFT, RIGHT: K.RIGHT },
      false,
    ) as MoveKeys;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  read(): MoveInput {
    if (!this.enabled || isTypingInDom()) {
      return { up: false, down: false, left: false, right: false };
    }
    const k = this.keys;
    return {
      up: k.W.isDown || k.UP.isDown,
      down: k.S.isDown || k.DOWN.isDown,
      left: k.A.isDown || k.LEFT.isDown,
      right: k.D.isDown || k.RIGHT.isDown,
    };
  }
}

/** True while the user is typing into a form field rendered by React. */
function isTypingInDom(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el.getAttribute('contenteditable') === 'true'
  );
}
