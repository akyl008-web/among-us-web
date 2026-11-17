# Деплой

## Вариант 1: Docker Compose (PostgreSQL + игра)

```powershell
Copy-Item .env.example .env
# впишите POSTGRES_PASSWORD и AUTH_SECRET (сгенерировать секрет:)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
docker compose up --build
```

Откройте http://localhost:3001. При старте контейнер сам применяет миграции (`prisma migrate deploy`).

## Вариант 2: любой Node-хостинг (Render, Railway, VPS)

1. Build command: `npm ci && npm run build`
2. Start command: `npm run db:deploy -w @stellar/server && npm start` (без базы просто `npm start`)
3. Переменные окружения:

| Переменная      | Значение                                                               |
| --------------- | ---------------------------------------------------------------------- |
| `NODE_ENV`      | `production`                                                           |
| `SERVE_CLIENT`  | `true` (сервер отдаёт собранный клиент)                                |
| `AUTH_SECRET`   | 64 hex-символа, **обязательно**                                        |
| `DATABASE_URL`  | строка подключения PostgreSQL                                          |
| `CLIENT_ORIGIN` | публичный адрес сайта, например `https://stellar.example.com`          |
| `TRUST_PROXY`   | `true`, если сервер стоит за обратным прокси (нужно для лимитов по IP) |
| `PORT`          | обычно задаёт хостинг                                                  |

WebSocket должен быть разрешён на хостинге (Render и Railway поддерживают его по умолчанию).

## Локальный PostgreSQL (для разработки)

1. Создайте базу `stellar_suspects` (pgAdmin или `createdb`).
2. В `server/.env`: `DATABASE_URL=postgresql://postgres:ПАРОЛЬ@localhost:5432/stellar_suspects`
3. Выполните `npm run db:migrate`, затем `npm run dev`. В логе сервера должно быть `storage postgres`.
4. Просмотр данных: `npm run db:studio`.

## Безопасность в production

- Секреты только в переменных окружения, `.env` в `.gitignore`.
- HTTPS обеспечивает хостинг или прокси. Socket.IO тогда работает через `wss://`.
- Helmet и CSP включены; лимиты по частоте на REST и на каждое событие сокета.
