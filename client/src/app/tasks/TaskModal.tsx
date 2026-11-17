import { useCallback, useEffect, useState } from 'react';
import { TASK_MIN_DURATION_MS, type TaskType } from '@stellar/shared';
import { errorText } from '../../net/errors';
import { useGameSession } from '../../net/useSession';
import { HoldTask } from './HoldTask';
import { SequenceTask } from './SequenceTask';
import { WiresTask } from './WiresTask';

interface Props {
  taskId: string;
  title: string;
  type: TaskType;
  onClose: () => void;
}

/** Mini-game window. Completion is confirmed by the server (distance + minimal duration). */
export function TaskModal({ taskId, title, type, onClose }: Props) {
  const session = useGameSession();
  const [startedAt] = useState(() => performance.now());
  const [status, setStatus] = useState<'playing' | 'sending' | 'error'>('playing');
  const [error, setError] = useState<string | null>(null);

  const finish = useCallback(async () => {
    setStatus('sending');
    // Never send faster than the server's anti-cheat minimum.
    const wait = TASK_MIN_DURATION_MS[type] + 150 - (performance.now() - startedAt);
    if (wait > 0) await new Promise((r) => window.setTimeout(r, wait));
    try {
      await session.completeTask(taskId);
      session.toast(`Задание выполнено: ${title}`);
      onClose();
    } catch (err) {
      setStatus('error');
      setError(errorText(err));
    }
  }, [onClose, session, startedAt, taskId, title, type]);

  const cancel = useCallback(() => {
    void session.cancelTask().catch(() => {});
    onClose();
  }, [onClose, session]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancel]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal task-modal">
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={cancel} aria-label="Закрыть">
            ×
          </button>
        </header>
        {status === 'playing' && type === 'HOLD' && <HoldTask onDone={() => void finish()} />}
        {status === 'playing' && type === 'SEQUENCE' && (
          <SequenceTask onDone={() => void finish()} />
        )}
        {status === 'playing' && type === 'WIRES' && <WiresTask onDone={() => void finish()} />}
        {status === 'sending' && <p className="hint">Проверка…</p>}
        {status === 'error' && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
