# Socket.IO контракт

Источник истины: [`shared/src/events.ts`](../shared/src/events.ts), схемы в [`shared/src/schemas.ts`](../shared/src/schemas.ts).

Request/response идут через acknowledgement с ответом `Ack<T>`:

```ts
{ ok: true, data: T } | { ok: false, error: ErrorCode, message?: string }
```

## Клиент → сервер

| Событие                                        | Payload                            | Кто может              | Проверки сервера                                                   |
| ---------------------------------------------- | ---------------------------------- | ---------------------- | ------------------------------------------------------------------ |
| `room:create`                                  | `{ name, color? }`                 | не в комнате           | имя (Zod), уникальный код                                          |
| `room:join`                                    | `{ code, name, color? }`           | не в комнате           | код, комната WAITING, ≤ 10 игроков; лимит 5 попыток, затем 1 в 5 с |
| `room:reconnect`                               | `{ code, playerId, sessionToken }` | владелец токена        | сравнение токена за постоянное время                               |
| `room:leave`                                   | —                                  | игрок                  | —                                                                  |
| `lobby:update`                                 | `{ name?, color? }`                | игрок, WAITING         | цвет свободен                                                      |
| `lobby:settings`                               | частичные `RoomSettings`           | хост, WAITING          | диапазоны значений                                                 |
| `game:start`                                   | —                                  | хост                   | число игроков, предателей меньше, чем экипажа                      |
| `game:returnToLobby`                           | —                                  | хост, FINISHED         | —                                                                  |
| `player:input`                                 | `{ seq, up, down, left, right }`   | живой/призрак, PLAYING | устаревший `seq` игнорируется; до 40/с                             |
| `task:start` / `task:complete` / `task:cancel` | `{ taskId }`                       | живой член экипажа     | своё задание, дистанция ≤ 80, минимальная длительность             |
| `impostor:kill`                                | `{ targetId }`                     | живой предатель        | цель жива и не предатель, ≤ 90 px, перезарядка                     |
| `body:report`                                  | `{ bodyId }`                       | живой                  | тело есть, ≤ 120 px                                                |
| `meeting:call`                                 | —                                  | живой                  | у кнопки, есть попытки, нет саботажа                               |
| `meeting:vote`                                 | `{ targetId \| null }`             | живой, стадия VOTING   | один голос, цель жива                                              |
| `meeting:chat`                                 | `{ text }`                         | живой, MEETING         | 1–140 символов, 4 сообщения, затем 1 в 2 с                         |
| `sabotage:trigger`                             | `{ type: LIGHTS \| REACTOR }`      | живой предатель        | нет активного саботажа, перезарядка 30 с                           |
| `sabotage:fix`                                 | `{ stationId }`                    | живой                  | станция активного саботажа, ≤ 80 px                                |
| `system:ping`                                  | `{ clientTime }`                   | все                    | —                                                                  |

## Сервер → клиент

| Событие           | Когда                     | Содержимое                                                |
| ----------------- | ------------------------- | --------------------------------------------------------- |
| `system:hello`    | при подключении           | версия, socketId, userId (если вошёл)                     |
| `room:state`      | при любом изменении       | `RoomView`, **личное** представление игрока               |
| `game:snapshot`   | 20 Гц в PLAYING           | позиции видимых игроков, тела, `ackSeq`                   |
| `meeting:message` | сообщение в чате собрания | `ChatMessage`                                             |
| `game:notice`     | события                   | `KILLED`, `KILL_CONFIRMED`, `HOST_CHANGED`, `PLAYER_LEFT` |
| `room:closed`     | игрока удалили            | `{ reason }`                                              |

## REST

| Метод     | Путь                      | Описание                                               |
| --------- | ------------------------- | ------------------------------------------------------ |
| GET       | `/api/health`             | статус, тип хранилища                                  |
| POST      | `/api/auth/register`      | `{ username, password }` → `{ token, user }`           |
| POST      | `/api/auth/login`         | то же; одинаковая ошибка для неверного логина и пароля |
| GET/PATCH | `/api/profile/me`         | профиль и история со своими ролями (Bearer-токен)      |
| GET       | `/api/profiles/:username` | публичный профиль **без ролей**                        |
| GET       | `/api/leaderboard`        | топ-10 по победам                                      |

**Правило:** новое событие добавляется в shared (тип + Zod-схема) в одном PR с серверным обработчиком и тестом.
