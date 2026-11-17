# Socket.IO контракт

Источник истины — [`shared/src/events.ts`](../shared/src/events.ts). Этот файл — человекочитаемое описание.

Именование: `<domain>:<action>`. Request/response — через acknowledgement с ответом `Ack<T>`:

```ts
{ ok: true, data: T } | { ok: false, error: 'VALIDATION_FAILED' | 'RATE_LIMITED' | 'INTERNAL', message?: string }
```

## Реализовано (этап 1)

| Событие        | Направление | Payload                       | Ответ                             |
| -------------- | ----------- | ----------------------------- | --------------------------------- |
| `system:hello` | S → C       | `{ serverVersion, socketId }` | — (при подключении)               |
| `system:ping`  | C → S       | `{ clientTime: number }`      | `Ack<{ clientTime, serverTime }>` |

Лимит: 10 событий burst, 5/с на сокет и событие.

## Запланировано

| Этап | События                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- |
| 6–7  | `room:create`, `room:join`, `room:leave`, `room:update` (S→C), `room:settings`, `lobby:setColor`, `lobby:setName`, `game:start` |
| 6    | `player:move` (C→S, вектор ввода), `game:state` (S→C, снапшот с тиками)                                                         |
| 8    | `task:start`, `task:complete`, `task:progress` (S→C)                                                                            |
| 9    | `impostor:kill`, `sabotage:trigger`, `sabotage:fix`, `role:assigned` (S→C, только владельцу)                                    |
| 10   | `meeting:call`, `body:report`, `meeting:start` (S→C), `meeting:vote`, `meeting:result` (S→C)                                    |
| 11   | `game:over` (S→C)                                                                                                               |

**Правило:** новое событие добавляется в shared (тип + Zod-схема) в одном PR с серверным обработчиком и тестом.
