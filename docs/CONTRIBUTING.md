# Командная работа

## Роли (5 человек)

| #   | Роль                | Зона ответственности (папки)                                                          |
| --- | ------------------- | ------------------------------------------------------------------------------------- |
| 1   | Team Lead / Backend | `server/src/game`, `server/src/rooms`, архитектура, ревью `shared/`                   |
| 2   | Frontend            | `client/src/app` — меню, лобби, HUD, голосование                                      |
| 3   | Game Dev            | `client/src/game` — сцены, персонажи, карта, коллизии                                 |
| 4   | Multiplayer         | `server/src/realtime`, `client/src/net`, `shared/src/events.ts`, интеграционные тесты |
| 5   | UI/UX / QA / Assets | Figma, `client/public/assets`, Tiled-карта, тест-планы, баг-репорты                   |

**Если людей меньше:** 4 человека — #4 объединяется с #1; 3 человека — (#1+#4), (#2+#5), #3; 2 — backend+multiplayer / frontend+game+assets.

## Ветки

- `main` — всегда рабочая, защищена (только через PR, CI зелёный, 1 approve).
- `develop` — интеграционная ветка, в неё мержатся фичи.
- Фичи: `feat/<area>-<short>` (`feat/client-lobby-ui`), исправления `fix/...`, `docs/...`, `chore/...`, `test/...`.
- Релиз этапа: PR `develop → main` + тег `stage-N`.

## Коммиты — Conventional Commits

```
feat(server): add room:create handler with zod validation
fix(client): destroy phaser game on unmount
```

## Pull Request

1. Ветка от свежего `develop`, маленький объём (до ~400 строк).
2. Перед PR: `npm run check` должен пройти.
3. Заполнить шаблон PR, приложить скриншот/GIF для UI.
4. Минимум 1 ревьюер; изменения в `shared/` — обязательно ревью Team Lead и Multiplayer Dev.
5. Squash merge.

## Критерии приёмки (Definition of Done)

- [ ] `npm run check` зелёный (format, lint, typecheck, tests), CI зелёный.
- [ ] Новые события — типы и Zod-схема в shared, серверная валидация, тест.
- [ ] Нет `any` без комментария, нет секретов в коде, нет `console.log` для отладки.
- [ ] Логика игры — на сервере; клиент не решает исход действий.
- [ ] Документация (`docs/`) обновлена, если менялся контракт или запуск.
- [ ] Проверено вручную в двух вкладках браузера (для multiplayer-фич).
