# Заголовки безопасности и страница 404 — спецификация

Этап 4 перехода whoami на практики wog-wwi-solo и western-setup. Документ живёт только пока идёт работа: при слиянии ветки он удаляется, а то, что остаётся верным, переходит в CLAUDE.md и `docs/testing.md`.

## Цель

Браузер выполняет на страницах игры только скрипты и стили с её собственного сайта. Вредный код, подсунутый в страницу (например, через имя игрока), не запустится, даже если где-то пропущена проверка ввода. Сайт не показывает лишнего о себе, на незнакомый адрес отвечает своей страницей 404, а ссылка на комнату не может открыть файл вне папки копий комнат.

Сейчас:
- **Bootstrap.** Грузится с jsdelivr.
- **Buy Me a Coffee.** Виджет — чужой скрипт.
- **Разметка.** В ней три атрибута `style=`, баннер обновления собирается с `onclick`.
- **Заголовки.** Сервер не отправляет ни одного заголовка безопасности, зато отправляет `X-Powered-By: Express`.
- **Незнакомый адрес.** Ответ — голый «Cannot GET …».
- **Ссылка на комнату.** `GET /game/:roomCode` подставляет код из адреса в путь к файлу без проверки формата: `/game/..%2FИМЯ` читает `ИМЯ.json` уровнем выше папки копий.

Как игра выглядит и работает, не меняется. Исключения: кнопка кофе вместо виджета, страница 404 и Bootstrap 5.3.8 вместо 5.1.3. Если после обновления что-то сдвинется, это поправляется в `style.css`.

## Решения владельца

- **Как в Flying Solo (wog) и Western Setup.**
  - **Bootstrap:** копия файлов в `public/vendor/bootstrap/`, те же файлы 5.3.8, что у них (байт в байт).
  - **Заголовки:** тот же список и те же значения, что в `render.yaml` у wog.
- **Заголовки отправляет `server.js`.** Render добавляет заголовки из `render.yaml` только статичным сайтам, а whoami — сервер (web service).
- **Кофе:** кнопка-картинка со ссылкой, как в wog, вместо виджета. Без чужого скрипта.
- **Правило о тестах, читающих код, уточняется, как в wog.** Поведение проверяется через страницы, а не поиском по коду. Правила о том, как написан код, тест может проверять по тексту файлов. Старая формулировка «тест не читает исходники» запрещала и то, и другое.

## Устройство

### Заголовки безопасности (`server.js`)

**Где в коде.** Один обработчик `app.use(...)` стоит до `express.static`, поэтому заголовки получает каждый ответ Express:
- страницы;
- файлы из `public/`;
- API;
- страница 404;
- переадресации.

Над каждым заголовком комментарий «зачем», как в `render.yaml` у wog. Отдельного пакета (helmet) нет.

**Какие заголовки:**

| Заголовок | Значение |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |
| `X-Content-Type-Options` | `nosniff` |

**Чем CSP отличается от wog.** В `img-src` добавлен `blob:`: `game.js` открывает загруженное фото по временному адресу `URL.createObjectURL()`, прежде чем уменьшить. Остальное, как у wog:
- **`data:` в картинках.** Нужен Bootstrap (его значки нарисованы так) и фото-аватарам: они хранятся как `data:image/...`.
- **`connect-src 'self'`.** Разрешает Socket.IO и запросы, и WebSocket на тот же адрес. Старый Safari, где `'self'` не покрывал `wss:` (исправлено в WebKit в 2022), откатится на HTTP-опрос, и игра всё равно работает.

**`X-Powered-By` не отправляется:** `app.disable('x-powered-by')`.

**Ответы Socket.IO** (`/socket.io/...`) обрабатывает сам Socket.IO, до Express, поэтому заголовков у них нет. CSP действует на страницы, а не на эти ответы, так что защита от этого не страдает.

`Permissions-Policy` не трогает то, чем игра пользуется:
- **Web Share:** в списке нет `web-share`.
- **Выбор фото:** `<input type="file">` не зависит от `camera`.

### Bootstrap

**Файлы.** В `public/vendor/bootstrap/` кладутся `bootstrap.min.css`, `bootstrap.bundle.min.js` и `LICENSE`, скопированные из `wog-wwi-solo/app/vendor/bootstrap/`.

**Страницы.** `index.html`, `game.html` и `404.html` ссылаются на `/vendor/bootstrap/bootstrap.min.css` и `/vendor/bootstrap/bootstrap.bundle.min.js`. Ссылок на jsdelivr не остаётся.

**Внешний вид.** До замены снимаются обе страницы и окна (раскрытие персонажа, выход, перезапуск) на телефоне и компьютере. После замены снимаются снова и сравниваются глазами. Расхождения правятся в `style.css`. Снимки в репозиторий не попадают.

### Кнопка Buy Me a Coffee

**Что убирается.** Скрипт виджета с `cdnjs.buymeacoffee.com` уходит из `index.html`.

**Что встаёт на его место.** В подвал главной страницы, над версией, встаёт ссылка:
- `<a href="https://www.buymeacoffee.com/mikhail.e" target="_blank" rel="noopener noreferrer" class="bmc-button">`;
- внутри картинка `public/img/bmc-button.svg`.

**Картинка.** Это копия `wog-wwi-solo/app/assets/icons/bmc-button.svg`, у которой фон перекрашен из `#D4B896` в жёлтый виджета `#FFDD00`. Она лежит в `img/`, а не в `icons/`: service worker кеширует только `icons/`, и правило о версии кеша (CLAUDE.md, правило 1) её не касается.

**Подпись для экранного диктора.** У ссылки `data-i18n-aria-label="buyCoffee"`:
- en: «Support the author: buy me a coffee»;
- ru: «Поддержать автора: угостить кофе».

У картинки `alt="Buy Me a Coffee"` — название сервиса.

**Стиль** (`.bmc-button` в `style.css`) по образцу wog. Тень и обводка фокуса для клавиатуры. Подъём при наведении — только для мыши, `@media (hover: hover) and (pointer: fine)`.

### Чистка разметки

Нужно, чтобы CSP `style-src 'self'` и `script-src 'self'` ничего не блокировали:
- **`index.html`, поле `#roomCode`.** `style="text-transform…; letter-spacing…; font-size…"` переезжает в правило `style.css`.
- **`game.html`, `#roomCode`.** `style="font-family: monospace; font-weight: bold"` становится правилом `style.css`.
- **`game.html`, `#restartGame`.** `style="display: none;"` становится правилом `#restartGame { display: none; }` в `style.css`. `game-room.js` по-прежнему показывает кнопку через `element.style.display`: CSP не запрещает скриптам менять `element.style`.
- **`pwa.js`, баннер обновления.** Кнопка «Обновить» вместо `onclick="window.location.reload()"` в HTML-строке получает обработчик через `addEventListener('click', ...)` после сборки баннера.

Остаётся как есть: `notification.style.cssText` в `utils.js` и `element.style.*` в `game-room.js`. Это изменение стиля скриптом, CSP его разрешает.

### Страница 404 (`public/404.html`)

**Как выглядит.** Как остальные страницы игры: Bootstrap, `style.css`, тот же фон. На ней:
- заголовок `data-i18n="notFoundTitle"`;
- строка `data-i18n="notFoundText"`;
- ссылка-кнопка `data-i18n="openGame"` на `/`.

**Тексты:**

| Ключ | en | ru |
|---|---|---|
| `notFoundTitle` | Page not found | Страница не найдена |
| `notFoundText` | There is nothing at this address. The game is on the main page. | По этому адресу ничего нет. Игра — на главной странице. |
| `openGame` | Open the game | Открыть игру |

**Язык.** Подключён `translations.js`, поэтому язык выбирается так же, как на других страницах, и появляется переключатель языка. `utils.js` не нужен: версии в подвале у страницы нет.

**Ссылки.** Все начинаются с `/`, так что страница работает на любой глубине адреса. В `head` стоит `<meta name="robots" content="noindex">`.

**Как отдаётся.** Последним в `server.js`, после всех маршрутов, стоит обработчик: `res.status(404).sendFile(public/404.html)` на любой запрос, которому никто не ответил, в том числе на незнакомый адрес под `/api/`.

### Ссылка на комнату (`GET /game/:roomCode`)

Код из адреса переводится в заглавные и проверяется `gameLogic.isValidRoomCode()`. Код не того формата получает то же, что несуществующая комната: переадресацию на `/?error=room-not-found`, без обращения к диску и к памяти. Код правильного формата обрабатывается как сейчас.

## Тесты

### Jest

**`tests/code-structure.test.js` (новый, как `code-structure.spec.js` в wog).** Читает `public/*.html` и `public/js/*.js` как текст и проверяет:
- **Нет встроенных обработчиков.** Шаблон `/<[^>]*\son[a-z]+\s*=/gi`: `onclick="..."` и подобные в разметке и в HTML-строках скриптов.
- **Нет атрибутов стиля.** Шаблон `/<[^>]*\sstyle\s*=/gi`.

Каждое найденное место выводится с именем файла.

**`tests/game-backup.test.js`, новый тест.** Его песочница уже держит папку копий и место рядом с ней. Рядом с папкой кладётся файл в форме комнаты `CANARY.json`. Запрос `GET /game/..%2FCANARY` к настоящему `app` (supertest) должен ответить переадресацией на `/?error=room-not-found`, а не страницей игры. Без исправления тест падает: сервер прочитал бы файл и отдал `game.html`.

### Браузерные (`tests/e2e/`)

**Новый `site-headers.spec.js`:**
- **Заголовки.** `/`, `/game/КОД` (настоящая комната), `/js/game.js`, `/vendor/bootstrap/bootstrap.min.css` и `/no-such/page` отвечают с `Content-Security-Policy`. Политика содержит `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `object-src 'none'` и `frame-ancestors 'none'`. Кроме того: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` с `camera=()`, и заголовка `X-Powered-By` нет.
- **Страж ловит нарушение CSP** (`test.fail`, как «the guard fails a test when a page throws»). Страница пытается поставить элементу атрибут `style`. Браузер блокирует это и пишет ошибку в консоль, а страж валит тест.
- **Баннер обновления.** Его показывает `window.pwaManager.showUpdateAvailable()`, тот же вызов, что делает приход новой версии. Это подмена, как `stubShare`: настоящий выпуск в тесте не устроить. Нажатие на кнопку «Обновить» (`text('updateNow')`) перезагружает страницу.

**Новый `not-found.spec.js`:**
- **Глубокий адрес.** `/no-such/page/here` отвечает кодом 404. Виден заголовок `text('notFoundTitle')`. Ни один файл страницы не ответил ошибкой. Фон — градиент из `style.css`. Кнопка `text('openGame')` ведёт на главную.
- **Русский язык.** У игрока с `locale: 'ru-RU'` заголовок `text('notFoundTitle', 'ru')`.

**`landing.spec.js`, новый тест.** Ссылка с подписью `text('buyCoffee')` ведёт на `https://www.buymeacoffee.com/mikhail.e` с `target="_blank"` и `rel`, содержащим `noopener`. По ссылке тест не переходит: это чужой сайт.

### Существующие тесты

- **CSP.** Все браузерные тесты идут под CSP. Нарушение даёт `console.error`, страж валит тест.
- **`accessibility.spec.js`.** `page.addStyleTag(...)` вставляет `<style>`, а CSP его блокирует. Правило `*, *::before, *::after { transition: none !important; }` добавляется в собственную таблицу стилей страницы через `document.styleSheets[...].insertRule(...)` в `page.evaluate`. Изменение стилей скриптом CSP разрешает. Проверка axe охватывает и кнопку кофе: контраст, подпись ссылки.
- **Прогон против прода.** `npm run test:e2e:prod` после выкладки проверяет заголовки и страницу 404 на Render.

Каждый новый тест один раз ломается нарочно, чтобы убедиться, что он умеет падать (`docs/testing.md`):
- **заголовки** — убрать обработчик заголовков;
- **404** — убрать обработчик 404;
- **баннер** — вернуть `onclick`;
- **code-structure** — вернуть `style=`;
- **ссылка на комнату** — убрать проверку формата.

## Документация

**CLAUDE.md:**
- **Архитектура:** `public/vendor/`, `public/img/`, `public/404.html`; заголовки в `server.js`.
- **«How it works»:** заголовки и обработчик 404.
- **Новое правило:**
  - никаких `style=` и `onclick=` ни в разметке, ни в HTML-строках скриптов, только классы в `style.css` и `addEventListener`; скрипт может менять `element.style`;
  - чужой код (скрипты, стили, шрифты) кладётся в `public/vendor/` и никогда не берётся с CDN;
  - новый источник (сайт, тип адреса) добавляется в CSP осознанно, с комментарием.
- **Gotchas:** список CSP и почему в ней `data:` и `blob:`; axe и `insertRule`.
- **Decisions:**
  - Bootstrap лежит у себя, а не на CDN: CSP `'self'`, никакого чужого кода на странице;
  - кофе — ссылка, а не виджет;
  - переписанное правило о тестах, читающих код (формулировка из «Решений владельца»).

**`docs/testing.md`:**
- то же правило;
- страж ловит и нарушения CSP;
- приём с `insertRule` для axe;
- в таблице «где живёт тест» — `code-structure.test.js`.

## Выпуск

Версия 1.3.0 (`npm version minor --no-git-tag-version` в ветке `release/1.3.0`). Остальное по `docs/release.md`. После выкладки — `npm run test:e2e:prod`.

## Чего нет в этом этапе

- **HSTS, COOP/COEP и прочие заголовки сверх списка wog.**
- **Ограничение CORS у Socket.IO** (`origin: "*"`). Входа и cookie у игры нет, так что чужой сайт не получит через браузер игрока больше, чем любой скрипт напрямую.
- **Найденные раньше мелочи.**
  - Ссылка маленькими буквами во вкладке, где уже есть сессия.
  - Непереведённое «Game has already started».
  - Залипшее наведение на телефоне.
  - Копии функций в `timeout-protection.test.js`.
- **Превью ссылок (OG-теги) — этап 5.**
