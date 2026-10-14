# Вход в начатую игру — дизайн

Спецификация фичи на время работы. Перед слиянием в `develop` файл уходит из репозитория, а то, что останется верным, переходит в CLAUDE.md (правило «Docs hold principles, not history»).

## Цель

Сейчас в начатую игру войти нельзя: `/api/join-game` отвечает «Game has already started». Кто опоздал, ждёт конца раунда. Новое правило: новичок просится в начатую игру, **любой игрок комнаты** (не только нажавший Start) впускает его или отказывает. Впущенному игроки дают персонажа, и он играет дальше со всеми.

## Решения владельца

- **Персонаж — после входа, кнопкой.** Впустить и дать персонажа — два отдельных шага. На карточке впущенного у остальных привычная «+ Назначить персонажа». После старта персонажа можно назначить только тому, у кого его нет, и после этого он закреплён.
- **«Впустить» и «Отказать».** Решает первый ответивший. Отказанный возвращается на главную с сообщением и может попроситься снова.
- **Подход: зал ожидания на сокете.** Запрос живёт ровно столько, сколько открыта страница ожидания новичка. Сокет ожидающего в канал комнаты не входит.
- **Вид** (варианты на временной странице): запрос у игроков — **окно поверх игры** (1C); у новичка — **печать «?» с бегущей вокруг дугой** (2A); своя карточка впущенного без персонажа — **конверт без печати «пока пусто»** (3C).
- Без изменений: игрок из списка (перезагрузка, вторая вкладка) и вышедший из этого раунда (`recentlyLeft`) входят как раньше, без подтверждения. В лобби подтверждение не нужно.

## Поток

1. Новичок на главной жмёт Join. `/api/join-game` в начатой игре для незнакомого ID отвечает `200 { success: false, waitingForApproval: true }`. Запрос на этом шаге не записывается. Главная сохраняет данные игрока, как при входе, и открывает `/game/CODE`.
2. Страница комнаты получает тот же ответ, показывает экран ожидания и, как только сокет подключён, шлёт `ask-to-join`. Сервер записывает запрос и рассылает игрокам `join-requested`.
3. Исходы:
   - **Впустить** (`admit-player`): новичок добавлен в конец списка. Игрокам — `player-joined` и `join-request-closed { outcome: 'admitted' }`; новичку — `join-request-ended { outcome: 'retry' }`. Страница новичка повторяет HTTP-вход (теперь удачный) и дальше идёт обычным путём: `join-room` → `game-state`.
   - **Отказать** (`decline-player`): игрокам — `join-request-closed { outcome: 'declined' }`, новичку — `join-request-ended { outcome: 'declined' }`. Страница новичка уходит на `/?join=CODE&error=join-declined`.
   - **Новичок ушёл** («Отменить» — переход на главную, или закрыл страницу): отключение его последнего сокета ожидания снимает запрос; игрокам — `join-request-closed { outcome: 'withdrawn' }`.
   - **Перезапуск игры** или **комната исчезла** (вышел последний игрок, ушёл последний «призрак»): запросы снимаются, страницам ожидания — `join-request-ended { outcome: 'retry' }`. Повторный HTTP-вход сам решает: в лобби — обычный вход, комнаты нет — обычное «Game not found».
4. Переподключение ожидающего (телефон проснулся): старый сокет снял запрос, новый шлёт `ask-to-join` заново — у игроков окно закроется и откроется снова.

У новичка всего два исхода: `declined` (на главную) и `retry` (повторить HTTP-вход и следовать его ответу).

## Сервер

### Данные (`game-logic.js`)

- `game.joinRequests`: `Map<playerId, { name, avatar, secretHash, requestedAt }>`. Создаётся в `createGame` и `restoreGame` пустым. В копии на диске и в копию браузера не попадает (`serializeGame` не меняется): после перезапуска сервера страница ожидания переподключится и попросится заново.
- Сокеты — забота `server.js`, `game-logic.js` о них не знает.

### Функции (`game-logic.js`)

- `addPlayerToGame`: в начатой игре для ID, которого нет ни в списке, ни в `recentlyLeft`, вместо ошибки возвращает `{ success: false, waitingForApproval: true }`. Перед этим — та же проверка заполненности, что ниже у запроса.
- `requestToJoin(games, gameId, playerName, avatar, playerId, playerSecret)`:
  - комнаты нет → `Game not found`;
  - ID или секрет не UUID → существующее `Missing required fields` (страница игры всегда шлёт верные; такое приходит только из рукописного сообщения);
  - имя и аватар через `sanitizePlayerName` / `sanitizeAvatar`, как при входе;
  - игра в лобби, ID уже в списке или в `recentlyLeft` → `{ success: false, retryJoin: true }` (обычный вход теперь пройдёт);
  - запрос с этим ID уже есть: тот же секрет → успех без нового запроса (вторая вкладка); другой секрет → `This player is playing in another browser`;
  - игроков вместе с ожидающими (без этого ID) уже 12 → `Game is full`;
  - иначе записывает запрос и возвращает `{ success: true, request: { playerId, name, avatar } }`.
- `admitPlayer(games, gameId, playerId, admittedBy)`: впускающий должен быть игроком комнаты; запроса нет (уже ответили, ушёл, перезапуск) → `This request has already been answered`. Добавляет игрока тем же кодом, что новый вход (общая внутренняя функция: цвет `assignUniqueColor`, `joinedAt` сейчас, конец списка, офлайн до `join-room`), записывает его хеш секрета в `game.secrets`, удаляет запрос. Возвращает `{ success, player, players, characters, revealedPlayers }`.
- `declinePlayer(games, gameId, playerId, declinedBy)`: те же проверки; удаляет запрос; возвращает `{ success, playerName }`.
- `withdrawJoinRequest(game, playerId)`: удаляет запрос; `true`, если он был.
- `listJoinRequests(game)`: `[{ playerId, name, avatar }]` по порядку запросов — **без** хеша секрета.
- `assignCharacter`: после старта назначить можно только непустого персонажа и только игроку без персонажа; иначе прежнее `Cannot change characters after the game has started`.
- `restartGame`: дополнительно возвращает `endedJoinRequests` (ID ожидавших) и очищает `joinRequests`.
- `removePlayerFromGame`: когда комната удаляется (`gameDeleted`), результат несёт `endedJoinRequests`. Так их получают и выход последнего игрока, и уборка «призраков».

### HTTP (`server.js`)

`/api/join-game` отдаёт `{ success: false, waitingForApproval: true }` со статусом 200 (это не ошибка) и ничего не рассылает.

### Сокеты (`server.js`)

Ожидающие сокеты учитывает второй экземпляр `createConnectionTracker()` — `waiting`: тот же учёт «сокет ↔ (комната, игрок)», несколько вкладок на один запрос, «ушёл последний сокет». `playerHandler` смотрит только в `connections`, поэтому ожидающий не может действовать как игрок.

| Событие | Кто → кому | Что |
|---|---|---|
| `ask-to-join` `{ gameId, playerId, playerSecret, playerName, avatar }` | новичок → сервер (`safeHandler`) | Сокет, уже зарегистрированный как игрок, игнорируется. Успех: `waiting.register`, игрокам `join-requested`. `retryJoin`: сокету `join-request-ended { outcome: 'retry' }`. Ошибка: сокету `error` |
| `join-requested` `{ playerId, name, avatar }` | сервер → комната | Показать запрос |
| `admit-player` `{ playerId }` | игрок → сервер (`playerHandler`) | `admitPlayer`; комнате `player-joined` и `join-request-closed { playerId, outcome: 'admitted', playerName }`; сокетам ожидания `join-request-ended { outcome: 'retry' }` (`waiting.unregisterPlayer`) |
| `decline-player` `{ playerId }` | игрок → сервер (`playerHandler`) | `declinePlayer`; комнате `join-request-closed { outcome: 'declined' }`; сокетам ожидания `join-request-ended { outcome: 'declined' }` |
| `join-request-closed` `{ playerId, outcome, playerName? }` | сервер → комната | Закрыть запрос; при `admitted` — уведомление |
| `join-request-ended` `{ outcome: 'retry' \| 'declined' }` | сервер → страница ожидания | См. «Поток» |

- `disconnect`: `waiting.unregister` → если ушёл последний сокет запроса, `withdrawJoinRequest` и комнате `join-request-closed { outcome: 'withdrawn' }`.
- `restart-game`, `leave-game` с удалением комнаты и уборка «призраков», опустошившая комнату: каждому из `endedJoinRequests` — `join-request-ended { outcome: 'retry' }` через `waiting.unregisterPlayer`.
- `game-state` (ответ на `join-room`) несёт `joinRequests: listJoinRequests(game)`: перезагруженная страница игрока видит ожидающих сразу.
- Ожидающий сокет не шлёт `join-room`: сервер ответил бы на него `player-left` (такого игрока нет), и страница ушла бы на главную.

## Страницы

### Главная (`game.js`)

- `joinGame()`: при `waitingForApproval` — то же, что при успехе (сохранить данные игрока, перейти на `/game/CODE`).
- `?error=join-declined` → `showError` с текстом «Игроки не впустили вас в игру» (как `room-not-found`); код комнаты подставлен (`?join=CODE`).

### Комната: новичок (`game.html`, `game-room.js`)

- Экран ожидания — статичная разметка в `game.html` (`#waitingSheet`, скрыт по умолчанию, тексты через `data-i18n`): лист «Игра уже идёт», аватар и имя новичка (заполняет скрипт через `textContent` / `img.src` за `isCustomAvatar`), печать с дугой (`.seal-spinner`, `aria-hidden`), текст ожидания в `role="status"`, кнопка «Отмена» (`#cancelJoinRequest`).
- Пока страница ждёт, на `body` класс (например, `waiting-for-admission`): стили прячут билет с кодом и все листы комнаты, кроме `#waitingSheet`.
- `joinGameRoom()` различает три исхода: вошёл → `join-room`; ждёт → экран ожидания и `ask-to-join`; иначе — как сейчас (ошибка, восстановление комнаты). При каждом `connect` страница повторяет свой шаг.
- `join-request-ended`: `declined` → `/?join=CODE&error=join-declined`; `retry` → повторить `joinGameRoom()` и следовать ответу (вошёл — убрать экран ожидания, показать комнату).
- «Отмена» — переход на `/?join=CODE`; запрос снимет отключение сокета.
- `error` от сервера, пока страница ждёт (`Game is full` и т. п.): `alert` с текстом ошибки и на главную.
- Дуга крутится и при `prefers-reduced-motion` (медленнее): без движения экран выглядит зависшим — ради этого крутилка и нужна.

### Комната: впущенный без персонажа

- Своя карточка: конверт без печати (`character-sticker mystery open-envelope`) с надписью «пока пусто», `title` «Персонажа пока нет — его даст другой игрок». Нажать нельзя.
- Строка статуса: «Игра идёт — ждём, пока вам дадут персонажа».
- Когда персонажа назначили, конверт запечатан, как у всех (прежняя ветка `updatePlayersList`).

### Комната: игроки

- На чужой карточке без персонажа «+ Назначить персонажа» показывается и в начатой игре (сейчас только в лобби). Проверка `currentGame.state !== 'waiting'` в `openCharacterInput` уступает правилу сервера: в начатой игре отправить можно только персонажа для игрока, у которого его нет.
- Окно запроса — статичная разметка в `game.html` (`#joinRequestModal`, `data-bs-backdrop="static"`, `data-bs-keyboard="false"`, без ×): «🚪 Просится в игру», аватар и имя (через `textContent` / `img.src`), «хочет войти в игру», «Впустить в начатую игру?», кнопки «Отказать» (`btn-outline-primary`) и «Впустить» (`btn-primary`). Ход — через `sendMove('admit-player' | 'decline-player', { playerId })`.
- Очередь: запросы копятся по порядку, запрос с уже известным `playerId` (вторая вкладка новичка, его переподключение) не задваивается; окно показывает первый. Следующий — после ответа на текущий. Если открыто другое окно (раскрытие, перезапуск, выход), запрос ждёт его закрытия (`hidden.bs.modal`).
- `join-request-closed`: убрать запрос из очереди; если он на экране — закрыть окно и показать следующий. При `admitted` — уведомление «👋 Даша теперь в игре».
- `game-restarted`: очередь очищается (запросы сняты на сервере).
- `game-state`: очередь берётся из `joinRequests`.

## Тексты (en / ru)

| Ключ | en | ru |
|---|---|---|
| `gameAlreadyOn` | The game is already on | Игра уже идёт |
| `waitingForAdmission` | Waiting for the players to let you in. They have your request. | Ждём, пока игроки вас впустят. Им уже пришёл ваш запрос. |
| `joinRequestTitle` | 🚪 Asking to join | 🚪 Просится в игру |
| `joinRequestText` | wants to join the game | хочет войти в игру |
| `joinRequestQuestion` | Let them into the started game? | Впустить в начатую игру? |
| `admitPlayer` | Let in | Впустить |
| `declinePlayer` | Decline | Отказать |
| `playerAdmittedNotification` | 👋 {playerName} is in the game now | 👋 {playerName} теперь в игре |
| `joinDeclined` | The players did not let you into the game | Игроки не впустили вас в игру |
| `envelopeEmpty` | empty for now | пока пусто |
| `noCharacterYet` | No character yet - another player will give you one | Персонажа пока нет — его даст другой игрок |
| `waitingForCharacter` | Game in progress - waiting for someone to give you a character | Игра идёт — ждём, пока вам дадут персонажа |
| `restartAction3` (меняется) | New players can join without asking | Новые игроки смогут входить без спроса |

Новая ошибка сервера `This request has already been answered` → `serverErrors.ru`: «На этот запрос уже ответили». Кнопка отмены ожидания — существующий ключ `cancel`.

## Тесты

**Jest** (`game-logic.js`, новый файл `tests/late-join.test.js`; ответ маршрута проверяет браузерный тест — начать игру можно только по сокету, а в память сервера тесты не лезут):
- запрос записывается только для незнакомого ID в начатой игре; игрок из списка, вышедший из раунда и лобби → `retryJoin`;
- имя и аватар проверяются; 12 вместе с ожидающими → `Game is full`; вторая вкладка с тем же секретом не создаёт второго запроса, с чужим — отказ;
- впустить и отказать: только игрок комнаты; без запроса → `This request has already been answered`; второй ответ — та же ошибка; впущенный в конце списка, с цветом и записанным секретом;
- `assignCharacter` после старта: можно игроку без персонажа, нельзя поменять, убрать или назначить пустого;
- перезапуск и удаление комнаты возвращают `endedJoinRequests`; `restoreGame` начинает без запросов; `serializeGame` их не пишет; `listJoinRequests` без хеша секрета;
- `addPlayerToGame`: начатая игра и незнакомый ID → `waitingForApproval`, игрок из списка и вышедший входят как раньше;
- новые тексты ошибок имеют русские копии (`translations-real.test.js`).

**Браузер** (`tests/e2e/late-join.spec.js`, телефон и компьютер; каждый новый тест хотя бы раз ломается на испорченном коде):
- главный путь: Даша просится, видит печать с дугой и ни одной карточки; впускает Боря (не нажимавший Start); у Даши пустой конверт, у остальных «+ Назначить персонажа» на её карточке; ей назначают персонажа — конверт запечатан, Даша может его открыть;
- отказ: Даша на главной с сообщением и подставленным кодом; просится снова;
- решает первый: Алиса впустила — окно у Бори закрылось само;
- «Отмена» и закрытая страница новичка закрывают окно у всех;
- два новичка — окна по очереди;
- перезапуск, пока Даша ждёт, — Даша входит в лобби;
- перезагруженная страница игрока видит ожидающего;
- окно не закрывается ни Escape, ни щелчком по фону;
- сокет ожидающего не может впустить себя: `You are not in this game` (как `impersonation.spec.js`);
- axe: экран ожидания и окно запроса (`accessibility.spec.js`).

## Документация

- CLAUDE.md: новый пункт «Joining a started game» в «How it works»; новые события в «Socket.IO events»; тонкость про `assignCharacter` («кроме игрока без персонажа»); «Returning to a started game» — сказать, что вышедший возвращается без подтверждения.
- `docs/testing.md`: ничего нового в правилах; помощники для нового сценария (если появятся) — в таблицу.

## Вне рамок

- Ограничение частоты запросов и запрет на повторный запрос после отказа (идея «Rate limit» в CLAUDE.md остаётся общей).
- Сохранение запросов при перезапуске сервера.
- Выгнать игрока, отозвать впуск.
