import { useGameSession, useSessionState } from '../../net/useSession';

export function Toasts() {
  const { toasts } = useSessionState();
  const session = useGameSession();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`toast toast--${t.tone}`}
          onClick={() => session.dismissToast(t.id)}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}
