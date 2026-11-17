import { useState } from 'react';

const COUNT = 6;

const shuffled = <T,>(items: T[]): T[] => {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

/** Press the numbered buttons in ascending order. A mistake resets the sequence. */
export function SequenceTask({ onDone }: { onDone: () => void }) {
  const [order] = useState(() => shuffled([...Array(COUNT).keys()].map((n) => n + 1)));
  const [next, setNext] = useState(1);
  const [shake, setShake] = useState(false);

  const press = (n: number) => {
    if (next > COUNT) return;
    if (n !== next) {
      setNext(1);
      setShake(true);
      window.setTimeout(() => setShake(false), 300);
      return;
    }
    if (n === COUNT) onDone();
    setNext(n + 1);
  };

  return (
    <div className={`task-sequence${shake ? ' shake' : ''}`}>
      <p className="hint">Нажмите числа по порядку: 1 → {COUNT}</p>
      <div className="sequence-grid">
        {order.map((n) => (
          <button
            key={n}
            type="button"
            className={`seq-btn${n < next ? ' seq-btn--done' : ''}`}
            onClick={() => press(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
