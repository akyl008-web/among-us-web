# Архитектура

## Monorepo (npm workspaces)

```
among-us-web/
├─ shared/            @stellar/shared — контракт между клиентом и сервером
│  └─ src/  constants.ts · game.ts (GamePhase, Role, цвета) · schemas.ts (Zod) · events.ts (Socket.IO типы)
│           movement.ts (чистая математика движения: клиент и сервер считают одинаково)
├─ server/            @stellar/server — авторитетный игровой сервер
│  └─ src/
│     ├─ config/env.ts          валидация переменных окружения (Zod, fail-fast)
│     ├─ http/app.ts            Express: REST (/api/health), helmet, лимит тела
│     ├─ realtime/io.ts         Socket.IO: подключение, маршрутизация событий
│     ├─ realtime/handlers/     обработчики по доменам (system, позже room, game, meeting)
│     ├─ realtime/rateLimiter.ts token bucket на socket+событие
│     ├─ createServer.ts        composition root (используется в index.ts и тестах)
│     └─ index.ts               запуск, graceful shutdown
├─ client/            @stellar/client — React (UI) + Phaser (мир)
│  └─ src/
│     ├─ app/                   React-экраны и панели
│     ├─ game/                  Phaser: createGame.ts, PhaserGame.tsx (монтирование)
│     │  ├─ scenes/             BootScene (ресурсы) → ShipTestScene (мир, временно до этапа 3)
│     │  ├─ entities/Player.ts  спрайт + физика + анимации, принимает MoveInput
│     │  ├─ input/              KeyboardInput: WASD/стрелки → MoveInput (намерение)
│     │  └─ art/                временная процедурная графика и палитра
│     ├─ game/bridge/           GameBridge — типизированный мост React ↔ Phaser
│     ├─ net/                   socket.ts (типизированный клиент), хуки useConnection/useServerHealth
│     ├─ lib/                   утилиты без зависимостей от фреймворков
│     └─ styles/
├─ docs/
└─ scripts/           кроссплатформенные node-скрипты
```

## Ключевые решения

1. **Shared как единый контракт.** Типы событий Socket.IO (`ClientToServerEvents`, `ServerToClientEvents`) и Zod-схемы живут в одном месте. Переименовали событие — TypeScript сразу покажет ошибки и на клиенте, и на сервере. shared собирается `tsc -b` в `dist/`; в dev работает в watch-режиме.
2. **Авторитетный сервер.** Клиент отправляет только _намерения_ (`move`, `interact`, `vote`, `kill`). Сервер проверяет фазу матча, права, дистанцию, cooldown и сам меняет состояние. Роль, позиция, результат убийства/голосования клиенту не доверяются.
3. **Шаблон обработчика:** rate limit → `schema.safeParse(payload)` → проверка прав/состояния → действие → `ack({ ok, data | error })`. Ответ всегда типа `Ack<T>`.
4. **Слои сервера не смешиваются:** `http` (REST) · `realtime` (транспорт) · `game` (чистая логика правил, этап 7+, без Socket.IO — легко тестировать) · `db` (Prisma, этап 12).
5. **React ↔ Phaser через GameBridge.** React не импортирует Phaser, сцены не импортируют React. Общение — типизированные события `ui:*` (команды из UI) и `game:*` (уведомления из мира). Phaser загружается лениво (отдельный чанк ~1.2 МБ).
6. **Один источник сокета** (`getSocket()`), Phaser-сцены получают данные сети через bridge/сервисы, а не напрямую.
7. **Dev-прокси.** Браузер ходит только на :5173, Vite проксирует `/api` и `/socket.io` на :3001 — нет проблем с CORS и cookies.
8. **Безопасность с первого дня:** Zod для env и payload, `strictObject` (лишние поля отклоняются), `maxHttpBufferSize` 16 КБ, `express.json` 16 КБ, helmet, rate limiting, `.env` в `.gitignore`.

## Состояние матча (план)

`WAITING → STARTING → PLAYING ⇄ MEETING → RESULT → (PLAYING | FINISHED)`
Временное состояние матча — в памяти сервера (`RoomManager`), постоянные данные (профили, статистика) — PostgreSQL. Роли хранятся только на сервере и в `MatchParticipant` после окончания матча, никогда в публичном профиле.

## Движение (этап 2)

`KeyboardInput.read()` → `MoveInput { up, down, left, right }` → `Player.applyInput()` → `getVelocity()` из shared → Arcade Physics разрешает столкновения.

- `MoveInput` — это именно то, что клиент будет отправлять серверу на этапе 6 (`player:move`). Позицию клиент не отправляет никогда.
- Сервер будет использовать те же `getVelocity` / `stepPosition` из shared, поэтому предсказание на клиенте и авторитетная симуляция совпадают.
- Хитбокс — 26×14 у ног, глубина спрайта = `y`, поэтому персонаж ниже по экрану рисуется поверх.

## Замена временной графики

`client/src/game/art/characterTextures.ts` рисует персонажа кодом. Чтобы подключить настоящий спрайт-лист, загрузите его в `BootScene.preload()` под ключом `character-<color>` с кадрами `idle-0, idle-1, walk-0..walk-3` размером 48×60. Остальной код менять не нужно.

## Отладка

- `?debug` — показать хитбоксы Arcade Physics.
- `?color=<red|blue|...>` — цвет персонажа (до появления лобби).
- В dev-режиме `window.__stellarGame` в консоли браузера — экземпляр Phaser.Game.
