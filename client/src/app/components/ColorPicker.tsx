import { PLAYER_COLORS, type PlayerColor } from '@stellar/shared';
import { Avatar } from './Avatar';

interface Props {
  value: PlayerColor;
  taken?: PlayerColor[];
  onChange: (color: PlayerColor) => void;
}

export function ColorPicker({ value, taken = [], onChange }: Props) {
  return (
    <div className="color-picker" role="radiogroup" aria-label="Цвет персонажа">
      {PLAYER_COLORS.map((color) => {
        const isTaken = taken.includes(color) && color !== value;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={color === value}
            aria-label={color}
            disabled={isTaken}
            className={`color-swatch${color === value ? ' color-swatch--active' : ''}`}
            onClick={() => onChange(color)}
          >
            <Avatar color={color} size={30} />
          </button>
        );
      })}
    </div>
  );
}
