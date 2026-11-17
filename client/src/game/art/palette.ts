import type { PlayerColor } from '@stellar/shared';

/** Body colors for each player color. Visual data only — lives on the client. */
export const PLAYER_COLOR_HEX: Readonly<Record<PlayerColor, number>> = {
  red: 0xef4444,
  blue: 0x3b82f6,
  green: 0x22c55e,
  pink: 0xf472b6,
  orange: 0xf97316,
  yellow: 0xfacc15,
  black: 0x475569,
  white: 0xe2e8f0,
  purple: 0xa855f7,
  cyan: 0x22d3ee,
};

export const VISOR_COLOR = 0xbae6fd;
export const VISOR_GLOW = 0x7dd3fc;
