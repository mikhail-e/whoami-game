# Браузерные тесты (Playwright) — спецификация

Этап 3 перехода whoami на практики wog-wwi-solo и western-setup. Документ живёт только пока идёт работа: при слиянии ветки он удаляется, а то, что остаётся верным, переходит в `docs/testing.md` и CLAUDE.md (решение «документы — принципы, а не история»).

## Цель

После любой правки `npm test` за несколько минут отвечает, работает ли игра по-настоящему: в настоящем браузере, на телефоне и на компьютере, с несколькими игроками в одной партии. Тот же набор после выкладки проверяет прод.

Сейчас 14 из 29 наборов Jest ищут текст в исходниках, ещё несколько проверяют копию кода игры, вставленную в тест, а партию двух игроков проверяют руками.

Поведение игры не меняется. Исключения: подпись поля `#shareLink` (находка axe) и то, что тесты найдут сломанным — о таком сообщается владельцу отдельно, с тестом, до исправления.

## Решения владельца

- **Браузеры:** только Chromium — телефон (Pixel 7) и компьютер (Desktop Chrome), как в wog. WebKit (движок Safari) не проверяется.
- **Подход A:** Playwright поднимает отдельный сервер `node server.js`; тесты действуют только как игроки — через страницы и кнопки. Без доступа к памяти сервера и без тестовых адресов на сервере.
- **Дубли заменяются сразу:** старые тесты, которые ищут текст в исходниках или проверяют копию кода и чьё поведение покрывает браузерный тест, удаляются в этом же этапе.
- **`api.test.js`** переводится со своей копии маршрутов на настоящий `server.js` в этом же этапе.

## Устройство

- **Пакеты (devDependencies):** `@playwright/test`, `@axe-core/playwright` — версии как в wog (`~1.63.0`, `~4.13.0`). Браузер ставится один раз: `npx playwright install chromium`.
- **Файлы:**
  - `playwright.config.js` — CommonJS, как весь проект;
  - `tests/e2e/*.spec.js` — браузерные тесты, `tests/e2e/helpers.js` — помощники;
  - Jest не трогает `tests/e2e/` (`testPathIgnorePatterns` в `package.json`);
  - ESLint: отдельный блок для `tests/e2e/**` — Node и CommonJS плюс глобальные имена браузера (колбэки `page.evaluate()` выполняются в странице).
- **Сервер тестов:** `webServer` запускает `node server.js` с `PORT=3100` и ждёт ответа `/api/version`. `reuseExistingServer: false` — каждый прогон с текущим кодом сервера; запущенный `npm start` (3000) не мешает. При заданном `BASE_URL` свой сервер не поднимается.
- **Проекты:** `mobile` (`devices['Pixel 7']`) первым — игра mobile-first; `desktop` (`devices['Desktop Chrome']`). Каждый тест идёт в обоих.
- **Общие настройки `use`:** `baseURL` (по умолчанию `http://localhost:3100`), `locale: 'en-US'`, `reducedMotion: 'reduce'` (Bootstrap тогда открывает окна без анимации), `serviceWorkers: 'block'`, `trace: 'retain-on-failure'`.
- **Команды (`package.json`):**
  - `test` = `npm run lint && jest && playwright test`;
  - `test:e2e`, `test:e2e:headed`, `test:e2e:ui`;
  - `test:e2e:prod` = `BASE_URL=https://whoami-game.onrender.com playwright test`; при `BASE_URL` таймауты больше — бесплатный Render просыпается до минуты.
- **`.gitignore`:** `test-results/`, `playwright-report/`, `blob-report/`, `playwright/.cache/`.

## Как пишутся тесты

### Игроки и общая страховка

Фикстура `newPlayer(name)` (расширение `test` в `helpers.js`) открывает новый контекст браузера с настройками устройства и `baseURL` текущего проекта и возвращает игрока `{ name, page }`. У каждого контекста свой localStorage, а значит свой ID игрока. После теста контексты закрываются.

Для каждой страницы каждого игрока фикстура собирает ошибки JavaScript (`pageerror`), `console.error` и неожиданные окна `alert`/`confirm`. Тест падает, если что-то собрано. Тест, который ждёт такое событие, объявляет это явно (`expectDialog(player, text)` или опция фикстуры).

### Помощники (`tests/e2e/helpers.js`)

| Помощник | Что делает |
|---|---|
| `createRoom(player)` | главная → имя → «Create New Game» → ждёт комнату; возвращает код |
| `joinRoom(player, code)` | `/game/КОД` → перенаправление на `/?join=КОД` → имя → «Join Game» → ждёт комнату |
| `assignCharacter(player, toName, character)` | «+» на карточке игрока `toName` → ввод → Enter → ждёт стикер |
| `startGame(player)` | «Start Game» → ждёт стикер 🎭 |
| `revealOwnCharacter(player)` | клик по 🎭 → окно → подтверждение |
| `leaveGame(player)` | «Leave» → окно → подтверждение → ждёт главную |
| `startedGame(names)` | комната, вход всех, персонажи всем (каждый следующему по кругу), старт; возвращает игроков, код и кто кому кого назначил |
| `playerCard(page, name)` | карточка `.player-card` с этим именем |
| `waitForPlayers(page, count)` | ждёт, пока в списке `count` карточек |
| `text(key, lang = 'en')` | строка из `translations.js` (через `require`) с подстановкой `{placeholder}` |
| `stubShare(page, behaviour)` | до загрузки страницы подменяет `navigator.share`: записывает вызовы, может бросить `AbortError` или убрать API совсем |

### Правила набора

1. Ожидания берутся из данных игры (`translations.js`, ответы сервера), а не переписываются руками.
2. Тест на исправление падает на старом коде (проверка: `git stash push public server.js game-logic.js`, прогон, `git stash pop`).
3. Никаких фиксированных пауз (`waitForTimeout`): ждать условие; `expect(...)` сам повторяет проверку.
4. Каждый тест создаёт свою комнату — тесты параллельны и не мешают друг другу, в том числе на проде.
5. Системное окно «Поделиться» не открывается никогда: `navigator.share` подменяется через `stubShare`.
6. Пропуск только с причиной: `test.skip(условие, 'почему')`.
7. Селекторы: роли и подписи (`getByRole`), `id`, `data-*`. Если зацепиться не за что — добавить подпись (`aria-label` с переводом) или `data-*`.

## Сценарии

| Файл | Что проверяет | Заменяет |
|---|---|---|
| `landing.spec.js` | 12 плиток аватаров, первая выбрана; клик выбирает; «Перемешать» — `<button>` с подписью, иконка скрыта от диктора (`aria-hidden`), даёт другой набор, не отправляет форму (URL не меняется); 4 колонки на телефоне, 6 на компьютере, плитки квадратные. «Join Game» выключена, пока код не из 6 символов; при полном коде выключена «Create New Game»; код переводится в верхний регистр. `?join=КОД` подставляет код; `?error=room-not-found` показывает сообщение. Пустое имя — окно с текстом `pleaseEnterName`. Имя длиннее `MAX_NAME_LENGTH` обрезается при вводе. Имя и аватар запоминаются после создания и после входа и стоят первыми при следующем визите; подделанный сохранённый аватар (не из набора и не фото) игнорируется | `avatar-shuffle.test.js`, `avatar-persistence.test.js`, тест «index.html does not hardcode a name maxlength» из `input-limits.test.js` |
| `custom-avatar.spec.js` | Загрузка картинки (PNG создаётся в тесте) — плитка с `<img>`, выбрана; кнопка загрузки — `<button type="button">` с подписью, поле файла принимает только картинки. После создания комнаты фото на своей карточке у обоих игроков. После «Перемешать» фото остаётся первой плиткой. До создания или входа фото не сохраняется в localStorage. Сохранённое «фото» с HTML или `javascript:` не становится ни разметкой, ни `<img>` | части «Upload button markup» и «Rendering is XSS-safe (client wiring)» из `custom-avatar.test.js` |
| `room.spec.js` | Вход по ссылке; оба видят обоих в порядке входа; два игрока с одинаковым именем — две карточки. На своей карточке нет «+». Enter сохраняет персонажа; клик мимо поля сохраняет; Enter и сразу потеря фокуса — одно сохранение: страница отправляет одно событие `assign-character` (Playwright видит кадры WebSocket); Escape возвращает прежний текст; пустой или из пробелов текст убирает персонажа (снова «+»). Свой персонаж скрыт, остальные видят. Поле персонажа ограничено `MAX_CHARACTER_LENGTH`. «Start Game» выключена с одним игроком и пока у кого-то нет персонажа, включается, когда персонажи есть у всех | `blur-event.test.js`, `start-game-button.test.js`, тест «game-room.js uses the constant» из `input-limits.test.js` |
| `game.spec.js` | После старта свой стикер — `.character-sticker.mystery` с 🎭, светлый фон и пунктирная рамка без цвета игрока; чужие — в цветах игроков; персонажей больше нельзя редактировать; шаг 4 инструкции показывает тот же 🎭. Открыть своего: окно → «Cancel» ничего не открывает; подтверждение — свой персонаж виден, остальные получают уведомление с именем и персонажем. Перезапуск: окно → партия снова в ожидании, персонажи сброшены | `mystery-sticker.test.js` |
| `leave-and-return.spec.js` | Выход: окно → главная `/?join=КОД` с подставленным именем; у остальных игрок исчезает. Последний вышедший удаляет комнату: ссылка ведёт на главную с сообщением. Вышедший из начатой партии возвращается с тем же персонажем, цветом и местом в списке; новый игрок в начатую партию не попадает (окно с ошибкой). Перезагрузка страницы — тот же игрок, без двойника; испорченный `playerId` в localStorage заменяется UUID v4 без двойника; два профиля — разные ID | `frontend-player-id.test.js`, часть «Leaving keeps the way back open (client wiring)» из `leave-game.test.js` |
| `share.spec.js` | «Share» вызывает `navigator.share` со ссылкой на комнату; `AbortError` — ни окна, ни ошибки; без Web Share API ссылка копируется и кнопка показывает `copiedSuccess`; «Copy Link» тоже | `share-button.test.js` |
| `language.spec.js` | Браузер `ru-RU` → русский; `de-DE` → английский; сохранённый выбор важнее языка браузера; неверный сохранённый язык игнорируется. Переключатель меняет `data-i18n`, плейсхолдеры, `title` и `aria-label`, а также карточки и статус в комнате; выбор сохраняется после перезагрузки. Уведомление об открытом персонаже содержит имя и персонажа на обоих языках. `i18n.getText` для неизвестного ключа возвращает сам ключ | `localization.test.js` (проверка ключей en/ru остаётся в `translations-real.test.js`) |
| `accessibility.spec.js` | axe, теги WCAG 2.0/2.1 A и AA: главная, комната в ожидании, комната после старта, окна reveal, restart и leave. Сначала падает на `#shareLink` без подписи; исправление — `aria-label` через `data-i18n-aria-label` с ключом en и ru | — |
| `site.spec.js` | `/game/НЕТ_ТАКОЙ` → главная с сообщением `roomNotFound`; подвал обеих страниц показывает `v` + версию из ответа `/api/version` | тесты подвала и `fetch` из `app-version.test.js` |

Ожидаемый размер — около 60 тестов, каждый в двух проектах; весь `npm test` — около 1–3 минут.

## Старые тесты

**Удаляются целиком** (проверка «❓ больше нигде нет» из `mystery-sticker` не переносится: это история, а не поведение): `share-button`, `mystery-sticker`, `avatar-shuffle`, `avatar-persistence`, `start-game-button`, `blur-event`, `frontend-player-id`, `i18n-initialization` (его заменяет общая страховка фикстуры), `localization`.

**Урезаются:**

| Набор | Остаётся | Удаляется |
|---|---|---|
| `custom-avatar.test.js` | «isCustomAvatar validation gate», «Custom avatars flow through the game logic» | «Upload button markup», «Rendering is XSS-safe (client wiring)» |
| `leave-game.test.js` | все тесты `game-logic` | «Leaving keeps the way back open (client wiring)» |
| `app-version.test.js` | `GET /api/version` | подвал в HTML, `fetch` в `utils.js` |
| `input-limits.test.js` | совпадение констант и шаблона, согласованные значения | «game-room.js uses the constant», «index.html does not hardcode a name maxlength» |

**`api.test.js`:** вместо своей копии маршрутов — `require('../server').app`. Тесты, которые на настоящем сервере ведут себя иначе, чем на копии, — находка: о расхождении сообщается владельцу до правки теста или сервера.

**Не трогаются:** `game-logic`, `connection-tracker`, `duplicate-names`, `game-cleanup`, `input-validation`, `room-recreation`, `character-race-condition`, `character-update`, `improved-sticker-colors`, `translations-real`, `service-worker`, `manifest`, `shared-names`, `debug-log`, `timeout-protection`.

## Документы

- `docs/testing.md` (новый, по-русски): команды; проекты Playwright; куда писать тест (правило игры — Jest с `game-logic.js`; то, что видит игрок, — `tests/e2e`); помощники и правила набора; отладка (`npx playwright show-trace`, `test:e2e:headed`, `whoami-debug`); прогон против прода.
- `docs/release.md`: после выкладки — `npm run test:e2e:prod`.
- CLAUDE.md: команды, дерево файлов, правило 3 («изменилось то, что видит игрок — браузерный тест»), решение «браузерные тесты только в Chromium», gotchas (порт 3100, `stubShare`, `reducedMotion`); ссылки на удалённые тесты убираются.
- README: `npx playwright install chromium`, команды тестов.
- Навык `verify`: для повторяемых проверок — помощники `tests/e2e/helpers.js`.

## Вне этапа

- Контраст текста на градиенте (axe его не меряет; нужен замер по пикселям, как в wog).
- Копии серверных функций в `timeout-protection.test.js` — сначала вынести сохранение и очистку файлов из `server.js` в модуль.
- WebKit (Safari).
- Навык для написания браузерных тестов (как `e2e-test-writer` в wog) — `docs/testing.md` пока достаточно.

## Готово, когда

- `npm test` (ESLint → Jest → Playwright) проходит локально в обоих проектах.
- Каждый удалённый старый тест покрыт сценарием из таблицы выше.
- Ни одного `waitForTimeout` в `tests/e2e`.
- `api.test.js` работает с настоящим сервером.
- Документы обновлены; спецификация и план удалены при слиянии.
- После следующей выкладки `npm run test:e2e:prod` проходит против прода.
