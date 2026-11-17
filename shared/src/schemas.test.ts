import { describe, expect, it } from 'vitest';
import { pingPayloadSchema, playerNameSchema, roomCodeSchema } from './schemas.js';

describe('shared schemas', () => {
  it('accepts a valid ping and rejects extra keys', () => {
    expect(pingPayloadSchema.safeParse({ clientTime: 1 }).success).toBe(true);
    expect(pingPayloadSchema.safeParse({ clientTime: 1, hack: true }).success).toBe(false);
    expect(pingPayloadSchema.safeParse({ clientTime: -5 }).success).toBe(false);
  });

  it('validates player names', () => {
    expect(playerNameSchema.parse('  Akyl  ')).toBe('Akyl');
    expect(playerNameSchema.safeParse('A').success).toBe(false);
    expect(playerNameSchema.safeParse('<script>').success).toBe(false);
  });

  it('normalizes and validates room codes', () => {
    expect(roomCodeSchema.parse('abc234')).toBe('ABC234');
    expect(roomCodeSchema.safeParse('ABCDE0').success).toBe(false); // 0 not in alphabet
    expect(roomCodeSchema.safeParse('ABC').success).toBe(false);
  });
});
