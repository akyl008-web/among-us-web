# Stellar Suspects

Браузерная multiplayer-игра в жанре social deduction (до 10 игроков). Оригинальное название, карта и ассеты.

**Стек:** React 19 · Vite 8 · TypeScript 6 · Phaser 3.90 · Socket.IO 4.8 · Express 5 · Zod 4 · Vitest 5
(PostgreSQL + Prisma — этап 12).

## Быстрый старт (Windows 11 / PowerShell)

```powershell
node -v          # нужен v24.x LTS (минимум 22.12)
npm install
Copy-Item server/.env.example server/.env
npm run dev
```

Откройте http://localhost:5173 — все индикаторы в панели «Состояние систем» должны быть зелёными.

Подробно: [docs/SETUP_WINDOWS.md](docs/SETUP_WINDOWS.md).

## Скрипты (из корня)

| Команда                                          | Что делает                                                    |
| ------------------------------------------------ | ------------------------------------------------------------- |
| `npm run dev`                                    | shared (watch) + server (:3001) + client (:5173) одновременно |
| `npm run dev:server` / `dev:client`              | только один из приложений                                     |
| `npm run build`                                  | production-сборка всех пакетов                                |
| `npm start`                                      | запуск собранного сервера                                     |
| `npm run lint` / `format` / `typecheck` / `test` | качество кода                                                 |
| `npm run check`                                  | всё сразу — запускать перед PR                                |
| `npm run clean`                                  | удалить артефакты сборки                                      |

## Документация

- [Архитектура](docs/ARCHITECTURE.md)
- [Контракт Socket.IO событий](docs/EVENTS.md)
- [Правила командной работы и Git](docs/CONTRIBUTING.md)
- [Этапы и распределение задач](docs/ROADMAP.md)
