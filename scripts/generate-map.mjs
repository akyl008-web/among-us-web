// Generates the "Skyward" ship map as a real Tiled JSON map + PNG tileset.
// Output can be opened and edited in Tiled (https://www.mapeditor.org/).
// After the team starts editing the map in Tiled, stop re-running this script.
//
//   node scripts/generate-map.mjs
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const OUT_DIR = resolve('shared/src/maps');
const T = 32; // tile size
const W = 72; // map width in tiles
const H = 48; // map height in tiles

// ---------- Tileset (gid = index + 1) ----------
const TILE = {
  CORRIDOR: 1,
  CAFETERIA: 2,
  MEDBAY: 3,
  REACTOR: 4,
  ELECTRICAL: 5,
  NAVIGATION: 6,
  STORAGE: 7,
  SECURITY: 8,
  WALL: 9,
  WALL_FACE: 10,
  TABLE: 11,
  CONSOLE: 12,
  CRATE: 13,
};
const TILE_COUNT = 13;
const COLLIDING = [TILE.WALL, TILE.WALL_FACE, TILE.TABLE, TILE.CONSOLE, TILE.CRATE];

// ---------- PNG encoder (RGBA, no dependencies) ----------
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- Tile painting ----------
const img = Buffer.alloc(TILE_COUNT * T * T * 4);
const IMG_W = TILE_COUNT * T;
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
function px(tile, x, y, color, a = 255) {
  if (x < 0 || y < 0 || x >= T || y >= T) return;
  const i = (y * IMG_W + (tile - 1) * T + x) * 4;
  const [r, g, b] = hex(color);
  const alpha = a / 255;
  img[i] = Math.round(img[i] * (1 - alpha) + r * alpha);
  img[i + 1] = Math.round(img[i + 1] * (1 - alpha) + g * alpha);
  img[i + 2] = Math.round(img[i + 2] * (1 - alpha) + b * alpha);
  img[i + 3] = 255;
}
function rect(tile, x, y, w, h, color, a) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) px(tile, xx, yy, color, a);
}
function floor(tile, base, line, accent) {
  rect(tile, 0, 0, T, T, base);
  rect(tile, 0, 0, T, 1, line);
  rect(tile, 0, 0, 1, T, line);
  rect(tile, 2, 2, 13, 13, accent, 60);
  rect(tile, 17, 17, 13, 13, accent, 60);
  for (const [x, y] of [
    [3, 3],
    [28, 3],
    [3, 28],
    [28, 28],
  ])
    rect(tile, x, y, 2, 2, line);
}
floor(TILE.CORRIDOR, 0x2a3150, 0x1c2238, 0x3a4470);
floor(TILE.CAFETERIA, 0x3a3f5c, 0x2a2e45, 0x5a6190);
floor(TILE.MEDBAY, 0x2f5560, 0x214049, 0x5fb3c4);
floor(TILE.REACTOR, 0x553a35, 0x3d2925, 0xd2794f);
floor(TILE.ELECTRICAL, 0x4f4a2f, 0x3a3620, 0xd8c050);
floor(TILE.NAVIGATION, 0x2d3d66, 0x1f2b4c, 0x6a8ee8);
floor(TILE.STORAGE, 0x4a3f33, 0x352d24, 0x9a8466);
floor(TILE.SECURITY, 0x2f4d3d, 0x21382c, 0x5cc48e);
// wall (top view)
rect(TILE.WALL, 0, 0, T, T, 0x151a2e);
rect(TILE.WALL, 2, 2, T - 4, T - 4, 0x1d2440);
rect(TILE.WALL, 0, 0, T, 2, 0x2a3358);
// wall face (wall with floor below: shows a front face for depth)
rect(TILE.WALL_FACE, 0, 0, T, T, 0x1d2440);
rect(TILE.WALL_FACE, 0, 0, T, 12, 0x151a2e);
rect(TILE.WALL_FACE, 0, 12, T, 2, 0x4a5a90);
rect(TILE.WALL_FACE, 0, 28, T, 4, 0x0f1324);
for (let x = 4; x < T; x += 10) rect(TILE.WALL_FACE, x, 18, 4, 6, 0x5b6db0);
// table
rect(TILE.TABLE, 0, 0, T, T, 0x3a3f5c);
rect(TILE.TABLE, 3, 3, T - 6, T - 6, 0x8a93c2);
rect(TILE.TABLE, 5, 5, T - 10, T - 10, 0xb5bde6);
rect(TILE.TABLE, 3, T - 6, T - 6, 3, 0x5a6190);
// console
rect(TILE.CONSOLE, 0, 0, T, T, 0x1d2440);
rect(TILE.CONSOLE, 3, 4, T - 6, 18, 0x0f172a);
rect(TILE.CONSOLE, 5, 6, T - 10, 14, 0x22d3ee, 180);
rect(TILE.CONSOLE, 7, 9, 8, 2, 0xe0f2fe);
rect(TILE.CONSOLE, 7, 13, 14, 2, 0xe0f2fe, 160);
rect(TILE.CONSOLE, 3, 24, T - 6, 6, 0x2e3a63);
for (let x = 6; x < T - 6; x += 6) rect(TILE.CONSOLE, x, 26, 3, 2, 0xfacc15);
// crate
rect(TILE.CRATE, 0, 0, T, T, 0x4a3f33);
rect(TILE.CRATE, 2, 2, T - 4, T - 4, 0x8b6b3e);
rect(TILE.CRATE, 2, 2, T - 4, 3, 0xb08a52);
for (let i = 2; i < T - 2; i++) {
  px(TILE.CRATE, i, i, 0x5c4526);
  px(TILE.CRATE, T - 1 - i, i, 0x5c4526);
}

// ---------- Map layout ----------
const floorLayer = new Array(W * H).fill(0);
const wallLayer = new Array(W * H).fill(0);
const decorLayer = new Array(W * H).fill(0);
const idx = (x, y) => y * W + x;

const ROOMS = [
  { name: 'Cafeteria', tile: TILE.CAFETERIA, x: 28, y: 2, w: 18, h: 12 },
  { name: 'MedBay', tile: TILE.MEDBAY, x: 16, y: 6, w: 10, h: 9 },
  { name: 'Reactor', tile: TILE.REACTOR, x: 2, y: 17, w: 9, h: 13 },
  { name: 'Security', tile: TILE.SECURITY, x: 15, y: 29, w: 10, h: 8 },
  { name: 'Electrical', tile: TILE.ELECTRICAL, x: 49, y: 30, w: 11, h: 9 },
  { name: 'Navigation', tile: TILE.NAVIGATION, x: 63, y: 17, w: 8, h: 13 },
  { name: 'Storage', tile: TILE.STORAGE, x: 29, y: 37, w: 16, h: 9 },
];
const CORRIDORS = [
  { x: 10, y: 22, w: 54, h: 3 }, // main spine: Reactor <-> Navigation
  { x: 35, y: 13, w: 3, h: 25 }, // Cafeteria <-> Storage
  { x: 19, y: 14, w: 3, h: 9 }, // MedBay
  { x: 18, y: 24, w: 3, h: 6 }, // Security
  { x: 52, y: 24, w: 3, h: 7 }, // Electrical
];

for (const c of CORRIDORS)
  for (let y = c.y; y < c.y + c.h; y++)
    for (let x = c.x; x < c.x + c.w; x++) floorLayer[idx(x, y)] = TILE.CORRIDOR;
for (const r of ROOMS)
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) floorLayer[idx(x, y)] = r.tile;

// Walls: every empty tile touching floor (8-neighbourhood)
const isFloor = (x, y) => x >= 0 && y >= 0 && x < W && y < H && floorLayer[idx(x, y)] !== 0;
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    if (isFloor(x, y)) continue;
    let touches = false;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) if (isFloor(x + dx, y + dy)) touches = true;
    if (touches) wallLayer[idx(x, y)] = isFloor(x, y + 1) ? TILE.WALL_FACE : TILE.WALL;
  }

// Decor (colliding props)
const place = (tile, x, y, w = 1, h = 1) => {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) decorLayer[idx(xx, yy)] = tile;
};
place(TILE.TABLE, 36, 7, 2, 2); // central table with the emergency button
place(TILE.TABLE, 31, 4, 2, 2);
place(TILE.TABLE, 41, 4, 2, 2);
place(TILE.TABLE, 31, 10, 2, 2);
place(TILE.TABLE, 41, 10, 2, 2);
place(TILE.CRATE, 30, 38, 2, 1);
place(TILE.CRATE, 42, 43, 2, 2);
place(TILE.CRATE, 30, 44);

// ---------- Objects ----------
let nextObjectId = 1;
const prop = (name, value) => ({ name, type: typeof value === 'number' ? 'int' : 'string', value });
const point = (name, type, tx, ty, properties) => ({
  id: nextObjectId++,
  name,
  type,
  x: tx * T + T / 2,
  y: ty * T + T / 2,
  width: 0,
  height: 0,
  rotation: 0,
  visible: true,
  point: true,
  properties,
});

const roomObjects = ROOMS.map((r) => ({
  id: nextObjectId++,
  name: r.name,
  type: 'room',
  x: r.x * T,
  y: r.y * T,
  width: r.w * T,
  height: r.h * T,
  rotation: 0,
  visible: true,
}));

// Spawn ring around the central table (tile 36..37, 7..8)
const spawnObjects = [];
for (let i = 0; i < 10; i++) {
  const angle = (i / 10) * Math.PI * 2;
  spawnObjects.push({
    id: nextObjectId++,
    name: `spawn-${i}`,
    type: 'spawn',
    x: Math.round(37 * T + Math.cos(angle) * 110),
    y: Math.round(8 * T + Math.sin(angle) * 95),
    width: 0,
    height: 0,
    rotation: 0,
    visible: true,
    point: true,
  });
}

// Consoles next to wall-mounted tasks
const task = (id, title, taskType, room, tx, ty, consoleAt) => {
  if (consoleAt) place(TILE.CONSOLE, consoleAt[0], consoleAt[1]);
  return point(id, 'task', tx, ty, [
    prop('kind', 'task'),
    prop('title', title),
    prop('taskType', taskType),
    prop('room', room),
  ]);
};
const interactables = [
  task('cafe-download', 'Скачать данные', 'HOLD', 'Cafeteria', 29, 3, [28, 2]),
  task('cafe-wires', 'Починить проводку', 'WIRES', 'Cafeteria', 44, 12, [45, 13]),
  task('med-scan', 'Пройти сканирование', 'HOLD', 'MedBay', 18, 8, [17, 7]),
  task('med-samples', 'Проверить образцы', 'SEQUENCE', 'MedBay', 24, 8, [24, 6]),
  task('reactor-align', 'Выровнять поток', 'SEQUENCE', 'Reactor', 4, 19, [3, 18]),
  task('reactor-fuel', 'Заправить реактор', 'HOLD', 'Reactor', 6, 28, [6, 29]),
  task('sec-cams', 'Проверить камеры', 'HOLD', 'Security', 17, 30, [16, 29]),
  task('sec-wires', 'Починить проводку', 'WIRES', 'Security', 23, 35, [24, 36]),
  task('elec-wires', 'Починить проводку', 'WIRES', 'Electrical', 51, 32, [50, 31]),
  task('elec-calibrate', 'Откалибровать щиток', 'SEQUENCE', 'Electrical', 58, 37, [59, 38]),
  task('nav-chart', 'Проложить курс', 'SEQUENCE', 'Navigation', 69, 19, [70, 18]),
  task('nav-wires', 'Починить проводку', 'WIRES', 'Navigation', 69, 28, [70, 29]),
  task('storage-fuel', 'Наполнить канистры', 'HOLD', 'Storage', 31, 42, [29, 42]),
  task('storage-sort', 'Рассортировать груз', 'SEQUENCE', 'Storage', 43, 39, [44, 38]),
  point('emergency', 'emergency', 36.5, 7.5, [prop('kind', 'emergency')]),
  point('lights', 'sabotage', 55, 31, [prop('kind', 'sabotage-fix'), prop('sabotage', 'LIGHTS')]),
  point('reactor-left', 'sabotage', 3, 23, [
    prop('kind', 'sabotage-fix'),
    prop('sabotage', 'REACTOR'),
  ]),
  point('reactor-right', 'sabotage', 9, 18, [
    prop('kind', 'sabotage-fix'),
    prop('sabotage', 'REACTOR'),
  ]),
];
// The emergency point is at the table centre (between tiles) — fix to exact pixel centre of the 2x2 table.
const emergency = interactables.find((o) => o.name === 'emergency');
emergency.x = 37 * T;
emergency.y = 8 * T;
place(TILE.CONSOLE, 55, 30); // lights panel
place(TILE.CONSOLE, 2, 23); // reactor left
place(TILE.CONSOLE, 9, 17); // reactor right

// ---------- Tiled JSON ----------
const tileLayer = (id, name, data) => ({
  id,
  name,
  type: 'tilelayer',
  x: 0,
  y: 0,
  width: W,
  height: H,
  opacity: 1,
  visible: true,
  data,
});
const objectLayer = (id, name, objects) => ({
  id,
  name,
  type: 'objectgroup',
  draworder: 'topdown',
  x: 0,
  y: 0,
  opacity: 1,
  visible: true,
  objects,
});

const map = {
  compressionlevel: -1,
  type: 'map',
  version: '1.10',
  tiledversion: '1.11.2',
  orientation: 'orthogonal',
  renderorder: 'right-down',
  infinite: false,
  width: W,
  height: H,
  tilewidth: T,
  tileheight: T,
  nextlayerid: 7,
  nextobjectid: nextObjectId,
  properties: [prop('name', 'Skyward')],
  layers: [
    tileLayer(1, 'floor', floorLayer),
    tileLayer(2, 'walls', wallLayer),
    tileLayer(3, 'decor', decorLayer),
    objectLayer(4, 'rooms', roomObjects),
    objectLayer(5, 'spawns', spawnObjects),
    objectLayer(6, 'interactables', interactables),
  ],
  tilesets: [
    {
      firstgid: 1,
      name: 'skyward-tiles',
      image: 'skyward-tiles.png',
      imagewidth: IMG_W,
      imageheight: T,
      tilewidth: T,
      tileheight: T,
      tilecount: TILE_COUNT,
      columns: TILE_COUNT,
      margin: 0,
      spacing: 0,
      tiles: COLLIDING.map((gid) => ({
        id: gid - 1,
        properties: [{ name: 'collides', type: 'bool', value: true }],
      })),
    },
  ],
};

writeFileSync(resolve(OUT_DIR, 'skyward-tiles.png'), encodePng(IMG_W, T, img));
writeFileSync(resolve(OUT_DIR, 'skyward.json'), JSON.stringify(map));
console.log(`Map written: ${W}x${H} tiles, ${interactables.length} interactables`);
