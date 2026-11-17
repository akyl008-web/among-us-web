import { useState } from 'react';

const WIRES = [
  { id: 'red', color: '#ef4444' },
  { id: 'blue', color: '#3b82f6' },
  { id: 'yellow', color: '#facc15' },
  { id: 'pink', color: '#f472b6' },
];

/** Connect each wire on the left with the socket of the same color on the right. */
export function WiresTask({ onDone }: { onDone: () => void }) {
  const [right] = useState(() => [...WIRES].sort(() => Math.random() - 0.5));
  const [selected, setSelected] = useState<string | null>(null);
  const [connected, setConnected] = useState<string[]>([]);

  const pickRight = (id: string) => {
    if (!selected) return;
    if (selected === id) {
      const next = [...connected, id];
      setConnected(next);
      if (next.length === WIRES.length) onDone();
    }
    setSelected(null);
  };

  return (
    <div className="task-wires">
      <p className="hint">Выберите провод слева, затем гнездо того же цвета справа.</p>
      <div className="wires">
        <div className="wire-column">
          {WIRES.map((w) => (
            <button
              key={w.id}
              type="button"
              className={`wire${selected === w.id ? ' wire--selected' : ''}${connected.includes(w.id) ? ' wire--done' : ''}`}
              style={{ background: w.color }}
              disabled={connected.includes(w.id)}
              onClick={() => setSelected(w.id)}
              aria-label={`Провод ${w.id}`}
            />
          ))}
        </div>
        <div className="wire-links" aria-hidden>
          {WIRES.map((w) => (
            <div
              key={w.id}
              className="wire-link"
              style={{ background: connected.includes(w.id) ? w.color : 'transparent' }}
            />
          ))}
        </div>
        <div className="wire-column">
          {right.map((w) => (
            <button
              key={w.id}
              type="button"
              className={`wire wire--socket${connected.includes(w.id) ? ' wire--done' : ''}`}
              style={{ borderColor: w.color }}
              disabled={connected.includes(w.id) || !selected}
              onClick={() => pickRight(w.id)}
              aria-label={`Гнездо ${w.id}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
