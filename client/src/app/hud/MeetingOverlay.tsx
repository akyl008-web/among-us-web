import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CHAT_MESSAGE_MAX_LENGTH, type RoomView } from '@stellar/shared';
import { errorText } from '../../net/errors';
import { useGameSession, useSessionState } from '../../net/useSession';
import { Avatar } from '../components/Avatar';
import { useCountdown } from '../components/useCountdown';

/** Discussion chat + secret ballot. Dead players watch but cannot vote or talk. */
export function MeetingOverlay({ room }: { room: RoomView }) {
  const session = useGameSession();
  const { chat, roomReceivedAt } = useSessionState();
  const meeting = room.meeting!;
  const seconds = useCountdown(meeting.stageRemainingMs, roomReceivedAt);
  const [selected, setSelected] = useState<string | null | undefined>(undefined);
  const [text, setText] = useState('');
  const chatEnd = useRef<HTMLDivElement>(null);

  const voting = meeting.stage === 'VOTING';
  const hasVoted = meeting.yourVote !== undefined;
  const canVote = voting && room.you.alive && !hasVoted;
  const nameOf = (id: string | null) => room.players.find((p) => p.id === id)?.name ?? '—';

  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollIntoView,
    // and React would treat a returned value as a cleanup function.
    void chatEnd.current?.scrollIntoView({ block: 'end' });
  }, [chat.length]);

  const vote = (targetId: string | null) => {
    session.vote(targetId).catch((err: unknown) => session.toast(errorText(err), 'danger'));
    setSelected(undefined);
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText('');
    session.sendChat(value).catch((err: unknown) => session.toast(errorText(err), 'danger'));
  };

  return (
    <div className="overlay meeting">
      <header className="meeting-header">
        <h1>{meeting.reason === 'BODY' ? 'Найдено тело!' : 'Экстренное собрание'}</h1>
        <p className="muted">
          {meeting.reason === 'BODY'
            ? `${nameOf(meeting.calledById)} нашёл тело: ${nameOf(meeting.bodyOwnerId)}`
            : `Созвал: ${nameOf(meeting.calledById)}`}
        </p>
        <div className="meeting-timer">
          {voting ? 'Голосование' : 'Обсуждение'}: <strong>{seconds ?? 0} с</strong>
        </div>
      </header>

      <div className="meeting-body">
        <div className="vote-grid">
          {room.players.map((p) => {
            const voted = meeting.votedIds.includes(p.id);
            const clickable = canVote && !p.isDead;
            return (
              <button
                key={p.id}
                type="button"
                className={`vote-card${p.isDead ? ' vote-card--dead' : ''}${selected === p.id ? ' vote-card--selected' : ''}${meeting.yourVote === p.id ? ' vote-card--mine' : ''}`}
                disabled={!clickable}
                onClick={() => setSelected(p.id)}
              >
                <Avatar color={p.color} size={38} dead={p.isDead} />
                <span className="vote-name">
                  {p.name}
                  {p.id === room.you.id && <span className="muted"> (вы)</span>}
                </span>
                {voted && <span className="tag tag--voted">голос</span>}
                {selected === p.id && (
                  <span className="vote-confirm">
                    <span
                      className="btn btn--danger btn--small"
                      onClick={(e) => {
                        e.stopPropagation();
                        vote(p.id);
                      }}
                    >
                      Голосовать
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="meeting-footer">
          {canVote && (
            <button type="button" className="btn btn--ghost" onClick={() => vote(null)}>
              Пропустить голосование
            </button>
          )}
          {!voting && <span className="hint">Голосование откроется после обсуждения.</span>}
          {hasVoted && (
            <span className="hint">Ваш голос учтён. Он останется тайным до итогов.</span>
          )}
          {!room.you.alive && <span className="hint">Призраки не голосуют.</span>}
        </div>

        <section className="chat panel panel--compact">
          <div className="chat-log">
            {chat.length === 0 && <p className="muted">Обсудите, кто вёл себя подозрительно.</p>}
            {chat.map((m) => (
              <p key={m.id} className="chat-line">
                <Avatar color={m.color} size={18} /> <strong>{m.name}:</strong> {m.text}
              </p>
            ))}
            <div ref={chatEnd} />
          </div>
          {room.you.alive && (
            <form className="chat-form" onSubmit={send}>
              <input
                className="input"
                maxLength={CHAT_MESSAGE_MAX_LENGTH}
                placeholder="Сообщение…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button type="submit" className="btn">
                Отправить
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
