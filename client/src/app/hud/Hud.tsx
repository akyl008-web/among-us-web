import { useEffect, useState } from 'react';
import { Role, SKYWARD_MAP, type RoomView } from '@stellar/shared';
import type { GameBridge } from '../../game/bridge/GameBridge';
import { NO_PROXIMITY, type Proximity, type UseTarget } from '../../game/world/proximity';
import { errorText } from '../../net/errors';
import { useGameSession, useSessionState } from '../../net/useSession';
import { useCountdown } from '../components/useCountdown';

interface Props {
  room: RoomView;
  bridge: GameBridge;
  onOpenTask: (target: Extract<UseTarget, { kind: 'task' }>) => void;
  modalOpen: boolean;
}

const isTyping = () => {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
};

/** In-game interface: role, tasks, progress, sabotage alerts and action buttons (E / R / Q). */
export function Hud({ room, bridge, onOpenTask, modalOpen }: Props) {
  const session = useGameSession();
  const { roomReceivedAt } = useSessionState();
  const [proximity, setProximity] = useState<Proximity>(NO_PROXIMITY);
  const [location, setLocation] = useState<string | null>(null);
  const [sabotageOpen, setSabotageOpen] = useState(false);

  const isImpostor = room.you.role === Role.IMPOSTOR;
  const killCd = useCountdown(room.you.killCooldownMs, roomReceivedAt);
  const sabotageCd = useCountdown(room.you.sabotageCooldownMs, roomReceivedAt);
  const reactorLeft = useCountdown(room.sabotage?.remainingMs, roomReceivedAt);

  useEffect(() => {
    const offA = bridge.on('game:proximity', setProximity);
    const offB = bridge.on('game:location', ({ room: r }) => setLocation(r));
    return () => {
      offA();
      offB();
    };
  }, [bridge]);

  const act = (fn: () => Promise<unknown>) => {
    fn().catch((err: unknown) => session.toast(errorText(err), 'danger'));
  };

  const activate = () => {
    const target = proximity.use;
    if (!target) return;
    if (target.kind === 'task') {
      act(async () => {
        await session.startTask(target.taskId);
        onOpenTask(target);
      });
    } else if (target.kind === 'emergency') act(() => session.callMeeting());
    else act(() => session.fixSabotage(target.stationId));
  };
  const report = () => proximity.reportBodyId && act(() => session.report(proximity.reportBodyId!));
  const kill = () => proximity.killTargetId && act(() => session.kill(proximity.killTargetId!));

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modalOpen || isTyping() || e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === 'e' || key === 'у') activate();
      else if (key === 'r' || key === 'к') report();
      else if ((key === 'q' || key === 'й') && isImpostor) kill();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const progress =
    room.taskProgress.total > 0 ? room.taskProgress.done / room.taskProgress.total : 0;
  const useLabel =
    proximity.use?.kind === 'task'
      ? 'Задание'
      : proximity.use?.kind === 'emergency'
        ? 'Собрание'
        : proximity.use
          ? 'Починить'
          : 'Использовать';
  const taskTitle = (id: string) => SKYWARD_MAP.tasks.find((t) => t.id === id);

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-progress panel panel--compact">
          <span>Общий прогресс заданий</span>
          <div className="progress">
            <div
              className="progress-fill progress-fill--ok"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
        <div className={`role-chip ${isImpostor ? 'role-chip--impostor' : ''}`}>
          {!room.you.alive ? 'Призрак' : isImpostor ? 'Предатель' : 'Экипаж'}
          {location && <span className="muted"> · {location}</span>}
        </div>
      </div>

      {room.sabotage && (
        <div className="sabotage-alert" role="alert">
          {room.sabotage.type === 'REACTOR'
            ? `АВАРИЯ РЕАКТОРА! Почините обе панели в Reactor · ${reactorLeft ?? 0} с`
            : 'Свет отключён! Почините щиток в Electrical'}
        </div>
      )}

      <aside className="task-list panel panel--compact">
        <h3>{room.you.fakeTasks ? 'Задания (для вида)' : 'Задания'}</h3>
        <ul>
          {room.you.tasks.map((t) => {
            const info = taskTitle(t.id);
            return (
              <li key={t.id} className={t.done ? 'done' : ''}>
                {info?.room}: {info?.title}
              </li>
            );
          })}
        </ul>
        {!room.you.alive && <p className="hint">Вы призрак: можно наблюдать, но не действовать.</p>}
      </aside>

      {room.you.alive && (
        <div className="actions">
          {isImpostor && (
            <>
              <div className="sabotage-wrap">
                <button
                  type="button"
                  className="action action--sabotage"
                  disabled={!!room.sabotage || (sabotageCd ?? 0) > 0}
                  onClick={() => setSabotageOpen((v) => !v)}
                >
                  Саботаж
                  {(sabotageCd ?? 0) > 0 && <span className="cooldown">{sabotageCd}</span>}
                </button>
                {sabotageOpen && (
                  <div className="sabotage-menu panel panel--compact">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setSabotageOpen(false);
                        act(() => session.sabotage('LIGHTS'));
                      }}
                    >
                      Отключить свет
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger"
                      onClick={() => {
                        setSabotageOpen(false);
                        act(() => session.sabotage('REACTOR'));
                      }}
                    >
                      Авария реактора
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="action action--kill"
                disabled={!proximity.killTargetId || (killCd ?? 0) > 0}
                onClick={kill}
              >
                Устранить <kbd>Q</kbd>
                {(killCd ?? 0) > 0 && <span className="cooldown">{killCd}</span>}
              </button>
            </>
          )}
          <button
            type="button"
            className="action action--report"
            disabled={!proximity.reportBodyId}
            onClick={report}
          >
            Сообщить <kbd>R</kbd>
          </button>
          <button
            type="button"
            className="action action--use"
            disabled={!proximity.use}
            onClick={activate}
          >
            {useLabel} <kbd>E</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
