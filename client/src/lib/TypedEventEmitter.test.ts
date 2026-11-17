import { describe, expect, it, vi } from 'vitest';
import { TypedEventEmitter } from './TypedEventEmitter';

describe('TypedEventEmitter', () => {
  it('delivers payloads and supports unsubscribe', () => {
    const emitter = new TypedEventEmitter<{ hit: number }>();
    const fn = vi.fn();
    const off = emitter.on('hit', fn);
    emitter.emit('hit', 5);
    off();
    emitter.emit('hit', 6);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(5);
  });
});
