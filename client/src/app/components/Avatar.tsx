import type { PlayerColor } from '@stellar/shared';
import { PLAYER_COLOR_HEX } from '../../game/art/palette';

const toCss = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;

/** SVG version of the in-game astro-bot, for UI (lobby, meeting, results). */
export function Avatar({
  color,
  size = 40,
  dead = false,
}: {
  color: PlayerColor;
  size?: number;
  dead?: boolean;
}) {
  const body = toCss(PLAYER_COLOR_HEX[color]);
  return (
    <svg
      width={size}
      height={size * 1.15}
      viewBox="0 0 48 56"
      role="img"
      aria-label={color}
      className={dead ? 'avatar avatar--dead' : 'avatar'}
    >
      <line x1="20" y1="8" x2="16" y2="2" stroke="#0b0e1a" strokeWidth="2" />
      <circle cx="16" cy="2.5" r="2.5" fill="#fde047" />
      <rect x="12" y="44" width="10" height="10" rx="4" fill="#0b0e1a" opacity="0.7" />
      <rect x="26" y="44" width="10" height="10" rx="4" fill="#0b0e1a" opacity="0.7" />
      <rect x="7" y="7" width="34" height="42" rx="14" fill="#0b0e1a" opacity="0.6" />
      <rect x="9" y="9" width="30" height="38" rx="12" fill={body} />
      <rect x="12" y="12" width="6" height="14" rx="3" fill="#fff" opacity="0.35" />
      <rect x="19" y="16" width="22" height="13" rx="6" fill="#0b0e1a" />
      <rect x="21" y="18" width="18" height="9" rx="4" fill={dead ? '#334155' : '#7dd3fc'} />
      {!dead && <rect x="23" y="19" width="9" height="4" rx="2" fill="#bae6fd" />}
      {dead && <path d="M24 19 L36 26 M36 19 L24 26" stroke="#e2e8f0" strokeWidth="2" />}
    </svg>
  );
}
