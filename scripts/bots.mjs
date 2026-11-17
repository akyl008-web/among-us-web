// Dev/QA tool: connects N bot players to a room so you can test alone.
//   npm run bots -- <ROOM_CODE> [count=2] [--still] [--hunt] [--url=http://localhost:3001]
// Bots wander around, and skip-vote in meetings. They use the same public
// Socket.IO API as the real client, so the server validates them like anyone else.
import { io } from 'socket.io-client';

const args = process.argv.slice(2);
const code = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a));
const count = Number(args.find((a) => /^\d+$/.test(a)) ?? 2);
const still = args.includes('--still');
const hunt = args.includes('--hunt'); // impostor bots try to eliminate anyone in range
const url = args.find((a) => a.startsWith('--url='))?.slice(6) ?? 'http://localhost:3001';

if (!code) {
  console.error('Usage: npm run bots -- <ROOM_CODE> [count] [--still]');
  process.exit(1);
}

const NAMES = ['Nova', 'Orbit', 'Pixel', 'Comet', 'Quasar', 'Rover', 'Zenith', 'Vega', 'Atlas'];
const DIRS = [
  { up: true, down: false, left: false, right: false },
  { up: false, down: true, left: false, right: false },
  { up: false, down: false, left: true, right: false },
  { up: false, down: false, left: false, right: true },
  { up: false, down: false, left: false, right: false },
];

for (let i = 0; i < count; i++) {
  const name = NAMES[i % NAMES.length];
  const socket = io(url, { transports: ['websocket'] });
  let seq = 0;
  let room = null;
  let voted = false;

  socket.on('connect', async () => {
    const res = await socket.emitWithAck('room:join', { code, name });
    console.log(`[${name}]`, res.ok ? `joined ${code}` : `join failed: ${res.error}`);
    if (!res.ok) socket.disconnect();
  });
  socket.on('room:state', (view) => {
    if (view.phase !== room?.phase)
      console.log(`[${name}] phase ${view.phase}${view.you.role ? ` (${view.you.role})` : ''}`);
    if (view.phase !== 'MEETING') voted = false;
    room = view;
    if (view.phase === 'MEETING' && view.meeting?.stage === 'VOTING' && view.you.alive && !voted) {
      voted = true;
      setTimeout(
        () => socket.emit('meeting:vote', { targetId: null }, () => {}),
        500 + Math.random() * 1500,
      );
    }
  });
  socket.on('room:closed', () => {
    console.log(`[${name}] removed from room`);
    process.exit(0);
  });

  if (hunt) {
    setInterval(() => {
      if (room?.phase !== 'PLAYING' || room.you.role !== 'IMPOSTOR' || !room.you.alive) return;
      if (!room.sabotage && room.you.sabotageCooldownMs === 0)
        socket.emit('sabotage:trigger', { type: 'LIGHTS' }, () => {});
      for (const p of room.players) {
        if (p.id !== room.you.id && !room.impostorIds.includes(p.id)) {
          socket.emit('impostor:kill', { targetId: p.id }, (res) => {
            if (res.ok) console.log(`[${name}] eliminated ${p.name}`);
          });
        }
      }
    }, 500);
  }

  if (!still) {
    setInterval(() => {
      if (room?.phase !== 'PLAYING') return;
      const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
      socket.emit('player:input', { seq: ++seq, ...dir });
    }, 700);
  }
}
