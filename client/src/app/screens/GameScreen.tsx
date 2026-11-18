import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { RoomView } from '@stellar/shared';
import { createGameBridge } from '../../game/bridge/GameBridge';
import type { UseTarget } from '../../game/world/proximity';
import { useGameSession } from '../../net/useSession';
import { GameOverOverlay } from '../hud/GameOverOverlay';
import { Hud } from '../hud/Hud';
import { MeetingOverlay } from '../hud/MeetingOverlay';
import { ResultOverlay } from '../hud/ResultOverlay';
import { RoleReveal } from '../hud/RoleReveal';
import { TaskModal } from '../tasks/TaskModal';

// Phaser is heavy — loaded in a separate chunk only when a game starts.
const PhaserGame = lazy(() => import('../../game/PhaserGame'));

/** React draws the interface on top; Phaser draws the world underneath. */
export function GameScreen({ room }: { room: RoomView }) {
  const session = useGameSession();
  const bridge = useMemo(() => createGameBridge(), []);
  const start = useMemo(() => ({ mode: 'online' as const, bridge, session }), [bridge, session]);
  const [task, setTask] = useState<Extract<UseTarget, { kind: 'task' }> | null>(null);

  // The server is the source of truth: the window is open only while the server
  // confirms this task is active (a meeting or death cancels it automatically).
  const activeTask =
    task && room.phase === 'PLAYING' && room.you.activeTaskId === task.taskId ? task : null;
  const inputLocked = room.phase !== 'PLAYING' || activeTask !== null;

  useEffect(() => {
    bridge.emit('ui:inputLocked', { locked: inputLocked });
  }, [bridge, inputLocked]);

  return (
    <div className="game-screen">
      <div className="game-stage">
        <Suspense fallback={<div className="game-loading">Загрузка корабля…</div>}>
          <PhaserGame start={start} />
        </Suspense>
        {room.phase === 'PLAYING' && (
          <Hud room={room} bridge={bridge} onOpenTask={setTask} modalOpen={activeTask !== null} />
        )}
        {activeTask && (
          <TaskModal
            taskId={activeTask.taskId}
            title={activeTask.title}
            type={activeTask.type}
            onClose={() => setTask(null)}
          />
        )}
        {room.phase === 'STARTING' && <RoleReveal room={room} />}
        {room.phase === 'MEETING' && room.meeting && <MeetingOverlay room={room} />}
        {room.phase === 'RESULT' && room.result && <ResultOverlay room={room} />}
        {room.phase === 'FINISHED' && room.gameOver && <GameOverOverlay room={room} />}
      </div>
    </div>
  );
}
