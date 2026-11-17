# Установка на Windows 11 (PowerShell)

## 1. Инструменты

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
winget install Microsoft.VisualStudioCode
```

Перезапустите PowerShell и проверьте:

```powershell
node -v   # v24.x
npm -v    # 10+ / 11+
git --version
```

Git один раз:

```powershell
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global core.autocrlf false   # переводы строк контролирует .gitattributes (LF)
```

## 2. Проект

```powershell
git clone https://github.com/<org>/among-us-web.git
cd among-us-web
npm install
Copy-Item server/.env.example server/.env
```

## 3. Запуск

> В `server/.env` по умолчанию `MIN_PLAYERS=3`: удобно тестировать втроём. Для настоящей игры уберите строку (будет 4).

```powershell
npm run dev
```

Ожидаемо в терминале:

- `[server] ... Server listening on http://localhost:3001 (development)`
- `[client] VITE v8.x ready ... Local: http://localhost:5173/`

В браузере на http://localhost:5173: заголовок **Stellar Suspects**, звёздное поле с парящим персонажем и надписью «Phaser OK», панель справа: HTTP `ok`, Socket.IO `connected`, Ping в мс, Phaser FPS ≈ 60.

Отдельные проверки:

```powershell
Invoke-RestMethod http://localhost:3001/api/health   # status: ok
npm run check                                         # format + lint + typecheck + tests
npm run build; npm start                              # production-сервер
```

Остановка: `Ctrl+C` (concurrently остановит все три процесса).

### Играть одному (боты)

1. В браузере: введите имя, нажмите «Создать комнату», запомните код.
2. Во втором терминале: `npm run bots -- КОД 3` (3 бота бродят и голосуют «пропустить»).
3. В лобби нажмите «Начать игру». Управление: **WASD**, **E** — использовать, **R** — сообщить о теле, **Q** — устранить (предатель).

Несколько настоящих игроков: откройте игру в нескольких вкладках или на других компьютерах в той же сети (`http://IP-компьютера:5173`).

### PostgreSQL (необязательно)

Без базы аккаунты и статистика хранятся в памяти. Подключение базы описано в [DEPLOY.md](DEPLOY.md#локальный-postgresql-для-разработки).

## 4. Частые ошибки

| Симптом                                                                      | Причина / решение                                                                                                                                           |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm : File ...npm.ps1 cannot be loaded because running scripts is disabled` | Политика выполнения PowerShell. Выполните сами: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` или используйте `npm.cmd` / cmd.exe                   |
| `EBADENGINE` / странные ошибки vitest                                        | Не та версия Node. Установите 24 LTS (`winget install OpenJS.NodeJS.LTS`)                                                                                   |
| `Port 3001 is already in use`                                                | `Get-NetTCPConnection -LocalPort 3001` → `Stop-Process -Id <PID>`, или поменяйте `PORT` в `server/.env` (и `DEV_SERVER_PROXY_TARGET` в `client/.env.local`) |
| `Port 5173 is in use`                                                        | Закройте старый `npm run dev` (strictPort включён специально)                                                                                               |
| `Cannot find module '@stellar/shared'`                                       | Запускайте через корневые скрипты (`npm run dev`), они сначала собирают shared. Либо `npm run build -w @stellar/shared`                                     |
| Socket.IO `disconnected`, HTTP `Failed to fetch`                             | Сервер не запущен или упал — смотрите вывод с префиксом `[server]`                                                                                          |
| Prettier ругается на все файлы после клонирования                            | Включился CRLF. `git config core.autocrlf false`, затем `git rm --cached -r . ; git reset --hard`                                                           |
| Брандмауэр Windows спрашивает доступ для Node                                | Разрешите для частных сетей (нужно для игры по LAN)                                                                                                         |
