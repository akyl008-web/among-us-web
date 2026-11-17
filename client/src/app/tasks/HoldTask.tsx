import { useEffect, useRef, useState } from 'react';

/** Hold the button until the bar fills (scan, download, fuel). Releasing early resets progress. */
export function HoldTask({
  onDone,
  durationMs = 3000,
}: {
  onDone: () => void;
  durationMs?: number;
}) {
  const [progress, setProgress] = useState(0);
  const holding = useRef(false);
  const doneRef = useRef(false);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      setProgress((p) => {
        if (doneRef.current) return 1;
        const next = holding.current
          ? Math.min(1, p + dt / durationMs)
          : Math.max(0, p - dt / (durationMs / 2));
        if (next >= 1 && !doneRef.current) {
          doneRef.current = true;
          window.setTimeout(onDone, 0);
        }
        return next;
      });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [durationMs, onDone]);

  const press = () => {
    holding.current = true;
  };
  const release = () => {
    holding.current = false;
  };

  return (
    <div className="task-hold">
      <div className="progress progress--big">
        <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <button
        type="button"
        className="btn btn--primary btn--big hold-button"
        onPointerDown={press}
        onPointerUp={release}
        onPointerLeave={release}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') press();
        }}
        onKeyUp={release}
      >
        {progress >= 1 ? 'Готово!' : 'Удерживайте'}
      </button>
    </div>
  );
}
