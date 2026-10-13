# Оформление «афиша салонной игры» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Who am I? получает вывеску из escapist-web и целиком переходит в её стиль: занавес, кремовая бумага, Oswald, бирки на булавках, конверт с печатью, новые иконки и картинка превью.

**Architecture:** Вывеска — SVG прямо в трёх страницах (намеренные копии под тестом). Весь облик — переписанный `public/css/style.css`: токены на `:root`, Bootstrap перекрашивается своими переменными (`--bs-btn-*`, `--bs-secondary-color`), без `!important`. Скрипты меняются точечно: конверт, кнопка «+ Задать персонажа», класс раскрытой карточки, билет кода комнаты. Иконки и картинка превью снимаются Playwright-скриптами с исходников в `scripts/`.

**Tech Stack:** vanilla JS, Bootstrap 5 (локальный), Express, Jest, Playwright (Chromium), шрифты woff2 из Fontsource.

**Spec:** `docs/superpowers/specs/2026-10-13-playbill-look-design.md` — значения цветов, размеров и текстов берутся оттуда. Одобренный вид — временная страница `public/_look.html` + `public/_look/look.css` (в git нет; открыть на `npm start` → `http://localhost:3000/_look.html`): CSS переносится оттуда, с заменой `.pb-title` → `.sheet-title` и без обёртки `.pb`.

## Global Constraints

- Ветка `feature/playbill-look` (уже создана от `develop`); каждая задача — свой коммит, в конце сообщения строка `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Пока на диске лежит временная страница, `npm run lint` падает на `public/_look/look.js`. До задачи 7 линтер запускается так: `npx eslint . --max-warnings 0 --ignore-pattern "public/_look*"`; Jest — `npx jest`; браузерные — `npx playwright test`. Полный `npm test` — в задаче 7, после удаления страницы.
- CSP не меняется: шрифты, стили, скрипты — только файлы сайта; никаких `style="…"`, `on…="…"`, `<style>` внутри SVG (CLAUDE.md, правило 8).
- Каждый `:hover` — только внутри `@media (hover: hover) and (pointer: fine)` (`styles.spec.js`).
- Каждый текст интерфейса — в `en` и `ru` (`translations-real.test.js`); тексты в тестах — через `text(ключ, язык)`.
- Правило каждого цвета игрока остаётся буквально `.character-sticker.color-<имя> {` (`improved-sticker-colors.test.js`).
- Отладка — `debugLog()`, не `console.log` в `public/js`.
- Курсива нет нигде; красный — только акценты и опасные действия (спец §1).
- Новый тест хотя бы раз ломают: проверяют, что он падает на старом коде или на испорченном (docs/testing.md, правило 2).
- Глазами каждую задачу с видимым результатом сверяют с временной страницей: телефон (Pixel 7) и компьютер, `npm start`.

## Review Focus

1. Длинный персонаж (128 символов без пробелов) в наклонённой бирке на телефоне не вылезает за карточку игрока → тест в задаче 4.
2. Переключение языка в комнате до старта перерисовывает «+ Задать персонажа» по-русски → тест в задаче 4.
3. После старта билет с кодом комнаты прячется (селектор меняется с `.badge.bg-light`) → тест в задаче 3.
4. Русский текст рисуется Oswald, а не системным шрифтом (файлы кириллицы грузятся) → тест в задаче 1.
5. До кнопки «+ Задать персонажа» доходит клавиатура, Enter открывает поле ввода → тест в задаче 4.

---

### Task 1: Шрифты

**Files:**
- Create: `public/fonts/` — из пакетов Fontsource 5.3.0: `abril-fatface-latin-400-normal.woff2`, `oswald-{latin,cyrillic}-{400,600,700}-normal.woff2`, `LICENSE-oswald.txt`, `LICENSE-abril-fatface.txt` (файлы `LICENSE` пакетов). Скачать: `npm pack @fontsource/oswald @fontsource/abril-fatface` во временной папке вне проекта, распаковать, скопировать `package/files/…` и `package/LICENSE`.
- Modify: `public/css/style.css` (начало файла)
- Test: `tests/e2e/styles.spec.js`

**Interfaces:**
- Produces: семейства `'Oswald'` (400/600/700, latin+cyrillic через `unicode-range`) и `'Abril Fatface'` (400, latin) для всех следующих задач; `body` уже рисуется Oswald 400, `1.0625rem`, `line-height: 1.45`.

- [ ] **Step 1: Тест**

```js
// The game draws with its own fonts (public/fonts/): a missing file or a CSP
// block would silently fall back to a system font, Cyrillic first of all
test('the pages draw with their own fonts, Cyrillic included', async ({ newPlayer }) => {
    const { page } = await newPlayer('Алиса', { locale: 'ru-RU' });
    await page.goto('/');
    await waitForLanding(page);

    const loaded = await page.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].filter(face => face.status === 'loaded').map(face =>
            `${face.family.replace(/["']/g, '')} ${face.weight} ${/U\+0?400/i.test(face.unicodeRange) ? 'cyrillic' : 'latin'}`);
    });

    expect(loaded).toEqual(expect.arrayContaining(['Oswald 400 latin', 'Oswald 400 cyrillic', 'Oswald 600 cyrillic']));
});
```

- [ ] **Step 2: Убедиться, что падает** — `npx playwright test tests/e2e/styles.spec.js` → FAIL (шрифтов нет, `loaded` пуст).

- [ ] **Step 3: Реализация.** В начале `style.css` — комментарий (откуда шрифты, почему локально: CSP `font-src 'self'`), `@font-face` для каждого файла: Oswald — `font-display: swap`, `unicode-range` латиницы `U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD` и кириллицы `U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116`; Abril Fatface — `font-display: block`, без `unicode-range`. Пути `url('../fonts/…')`. Старый `font-family: 'Segoe UI', …` у `body` → `'Oswald', 'Arial Narrow', sans-serif`, плюс `--bs-body-font-family` на `:root` тем же значением (Bootstrap ставит шрифт у `body` и кнопок через неё).

- [ ] **Step 4: Прогон** — тот же тест → PASS в обоих проектах; `npx playwright test tests/e2e/site-headers.spec.js` → PASS (CSP не ругается).

- [ ] **Step 5: Коммит** — `git add public/fonts public/css/style.css tests/e2e/styles.spec.js`, сообщение «Oswald and Abril Fatface served by the game itself».

---

### Task 2: Вывеска

**Files:**
- Modify: `public/index.html`, `public/game.html`, `public/404.html`, `public/css/style.css`, `public/js/translations.js` (ключ `title`)
- Create: `tests/brand-sign.test.js`
- Modify tests: `tests/e2e/language.spec.js`, `tests/e2e/styles.spec.js`

**Interfaces:**
- Consumes: `'Abril Fatface'`, `'Oswald'` (задача 1).
- Produces: `<svg class="brand-sign" …>` в трёх страницах; классы `.brand` (обёртка), `.brand--room` (уменьшенная в комнате), `.brand-sign__name`, `.brand-sign__small`, `.tagline` (подзаголовок главной, `data-i18n="subtitle"`).

- [ ] **Step 1: Jest-тест `tests/brand-sign.test.js`** (сверка намеренных копий, как в `input-limits.test.js`): читает три страницы, вынимает `/<svg class="brand-sign"[\s\S]*?<\/svg>/g`, сравнивает с пробелами, сжатыми в один.

```js
test.each(PAGES)('%s has the sign exactly once', page => expect(signsOf(page)).toHaveLength(1));
test('the three copies are the same drawing', () => {
    const [first, ...rest] = PAGES.map(page => normalize(signsOf(page)[0]));
    for (const copy of rest) expect(copy).toBe(first);
});
test('a screen reader hears one picture named "Who am I?"', () => {
    const sign = signsOf('index.html')[0];
    expect(sign).toMatch(/role="img"/);
    expect(sign).toMatch(/aria-label="Who am I\?"/);
});
// No font of the game has ★: a typed star would be drawn by the system font, different on every phone
test('the stars are drawn, not typed', () => expect(signsOf('index.html')[0]).not.toContain('★'));
```

- [ ] **Step 2: Правка `language.spec.js`.** `h1` теперь вывеска и не переводится. `heading(page)).toHaveText(text('title', X))` заменяется: на главной — `subtitle(page)).toHaveText(text('subtitle', X))`, где `const subtitle = page => page.locator('[data-i18n="subtitle"]')`; в комнате (тесты «reveal notification…» и «close buttons…») — `await expect(page).toHaveTitle(text('gameRoom', X))`. Новый тест:

```js
test('the sign stays English in Russian: it is the logo', async ({ newPlayer }) => {
    const { page } = await newPlayer('Алиса', { locale: 'ru-RU' });
    await page.goto('/');
    await expect(subtitle(page)).toHaveText(text('subtitle', 'ru'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Who am I?');
});
```
В `styles.spec.js` (тест задачи 1) — ожидание дополняется `'Abril Fatface 400 latin'`.

- [ ] **Step 3: Убедиться, что падает** — `npx jest tests/brand-sign.test.js` → FAIL (вывески нет); `npx playwright test tests/e2e/language.spec.js` → новый тест FAIL.

- [ ] **Step 4: Реализация.**
  - SVG — копия `<svg class="brand-sign" …>` из `public/_look.html` (раздел 404 или шаблоны: все одинаковые; звёзды — `<polygon transform="translate(113 39)" …>` и `translate(487 39)`). Над вывеской в `index.html` — комментарий: три копии (index, game, 404) держит одинаковыми `tests/brand-sign.test.js`; рисунок — из `escapist-web/plates/whoami.svg`, звёзды нарисованы, потому что ★ нет в шрифтах; шрифты — классами, потому что `<style>` в SVG запретила бы CSP.
  - `index.html`: вместо `<h1 class="text-white mb-3" data-i18n="title">` и `<p class="text-white-50" …>` → `<h1 class="brand">` с вывеской (без `data-i18n` — иначе перевод заменит SVG текстом) и `<p class="tagline" data-i18n="subtitle">`.
  - `game.html`: `<h1 class="brand brand--room">` с вывеской (бейдж с кодом пока не трогать — задача 3).
  - `404.html`: `<p class="brand">` с вывеской вместо `<p class="h1 text-white …">`.
  - Во всех трёх `<head>`: `<link rel="preload" href="/fonts/abril-fatface-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>`.
  - `style.css`: `.brand-sign` (block, `width: 100%`, `max-width: 560px`, `height: auto`, `margin-inline: auto`, `filter: drop-shadow(0 8px 14px rgba(0, 0, 0, .45))`), `.brand--room .brand-sign` — `max-width: 300px`, с 768 px — `360px`; `.brand-sign__name { font-family: 'Abril Fatface', serif }`, `.brand-sign__small { font-family: 'Oswald', sans-serif; font-weight: 600 }`; `.tagline` (цвет задаст задача 3).
  - `translations.js`: `title` → `"Who am I?"` / `"Кто я?"`.

- [ ] **Step 5: Прогон** — `npx jest tests/brand-sign.test.js tests/translations-real.test.js` → PASS; `npx playwright test tests/e2e/language.spec.js tests/e2e/styles.spec.js tests/e2e/not-found.spec.js tests/e2e/accessibility.spec.js` → PASS. Фон ещё фиолетовый — это нормально.

- [ ] **Step 6: Коммит** — «The sign from escapist-web replaces the 🎭 heading».

---

### Task 3: Бумажный облик страниц

Всё, кроме бирок и конверта: занавес, листы, заголовки листов, поля, кнопки, аватары, правила, подвал, билет кода комнаты, карточки игроков, окна, уведомления, 404.

**Files:**
- Modify: `public/css/style.css` (переписывается всё, кроме шрифтов, вывески и правил наклеек — их трогает задача 4), `public/index.html`, `public/game.html`, `public/404.html`, `public/js/game-room.js:446` (поиск билета), `public/js/translations.js:477-478` (класс переключателя)
- Test: `tests/e2e/game.spec.js`

**Interfaces:**
- Consumes: шрифты, `.brand*` (задачи 1–2).
- Produces: токены на `:root` с именами из спец §2 (`--paper`, `--paper-light`, `--tag-paper`, `--envelope`, `--ink`, `--ink-hover`, `--ink-soft`, `--red`, `--red-deep`, `--cream`, `--gold`, `--revealed-paper`, `--on-page`, `--on-page-soft`) — задача 4 и `scripts/og-image.html` пользуются ими; класс заголовка листа `.sheet-title`; билет `.room-ticket` с `#roomCode` внутри.

- [ ] **Step 1: Тест** (`game.spec.js`; из `helpers.js` дополнительно взять `createRoom`, `joinRoom`, `assignCharacter`, `startGame`):

```js
test('the room code ticket shows in the lobby and hides once the game starts', async ({ newPlayer }) => {
    const alice = await newPlayer('Alice');
    const bob = await newPlayer('Bob');
    const code = await createRoom(alice);
    await joinRoom(bob, code);
    await expect(alice.page.locator('.room-ticket')).toContainText(code);

    await assignCharacter(alice, 'Bob', 'Napoleon');
    await assignCharacter(bob, 'Alice', 'Cleopatra');
    await startGame(alice);

    await expect(alice.page.locator('.room-ticket')).toBeHidden();
});
```

- [ ] **Step 2: Убедиться, что падает** — `npx playwright test tests/e2e/game.spec.js -g "ticket"` → FAIL (`.room-ticket` нет). После разметки билета и до правки `game-room.js` он должен падать на второй проверке (билет не прячется).

- [ ] **Step 3: Реализация** — значения из спец §2 и §5, CSS — из `public/_look/look.css`:
  - `:root`: токены; Bootstrap — `--bs-body-color: var(--on-page)`, `--bs-secondary-color: var(--ink-soft)` (так `text-muted` в разметке и в `game-room.js` становится `--ink-soft` без правок), `--bs-body-font-family` (задача 1).
  - `body`: фон — занавес из спец §2 (`min-height: 100vh` остаётся), цвет `--on-page`. Старые фиолетовые градиенты уходят.
  - `.game-card` (лист), `.sheet-title` (звёзды `::before`/`::after` через `clip-path: polygon(50% 0%, 61.7% 33.8%, 97.5% 34.5%, 69% 56.2%, 79.4% 90.5%, 50% 70%, 20.6% 90.5%, 31% 56.2%, 2.5% 34.5%, 38.3% 33.8%)`), `.form-label`, `.form-control` (+ `::placeholder` `#7d6858`, `:focus`), `input#roomCode` (разрядка `.25em`), `.form-text` (`--ink-soft`).
  - Кнопки через `--bs-btn-*`: `.btn` (Oswald 600, прописные, `.08em`, радиус 3 px, рамка 2 px); `.btn-primary, .btn-warning` — чернила; `.btn-outline-primary, .btn-outline-secondary, .btn-secondary` — обводка (выключенная: текст `#6f5c4d`, рамка `#a8916c`, `--bs-btn-disabled-opacity: 1`); `.btn-danger`, `.btn-outline-danger` — красные. `.avatar-shuffle-btn` — размеры как сейчас.
  - `.avatar-option` / `.selected` (спец §5), `ol li::marker` (Oswald 700, `--red`), `.tagline` (`--on-page-soft`), подвал: `.lang-toggle-btn` (прозрачная, обводка и текст `--on-page`; в `translations.js` из разметки переключателя убрать `btn-outline-light`), `.bmc-button` — как сейчас, версия `--on-page-soft`. Старые правила `.language-switcher .lang-toggle-btn` с `!important` удаляются.
  - `game.html`: `<div class="badge bg-light text-dark fs-6 px-3 py-2">…</div>` → `<div class="room-ticket"><span data-i18n="roomCode">Room Code</span><span id="roomCode"></span></div>`; стиль билета — спец §5 (код — `.room-ticket #roomCode`, старое `span#roomCode` удаляется). `game-room.js:446`: `document.querySelector('.room-ticket')`.
  - Заголовки листов во всех страницах: класс `sheet-title` вместо `text-center mb-4` и т. п.; уровень (`h3`/`h5`/`h6`) не меняется. `footer` — без `text-white`.
  - `.player-card` (фон `--paper-light`, рамка 1.5 px `--ink`, радиус 3 px; `.player-card.revealed` — фон `--revealed-paper`, класс выставит задача 4), `.player-name` (Oswald 600 `1.2rem`); наведение — лёгкий подъём, как сейчас, в `@media (hover: hover) and (pointer: fine)`.
  - `.modal-content` — лист как `.game-card` (через `--bs-modal-bg`, `--bs-modal-color`, `--bs-modal-border-radius: 2px`, `outline` −8 px); `.modal-title` — Oswald 600 прописные `.1em`, линейка снизу. Мобильный блок `.mobile-friendly-modal` / `.mobile-modal-btn` сохраняет раскладку, цвета берёт из кнопок.
  - `.alert` — бумажная полоска с кромкой 8 px (спец §5); `.alert-danger/-success/-info/-warning` — только цвет кромки.
  - `404.html`: лист с `<h1 class="sheet-title">` и главной кнопкой — разметка уже такая, меняются классы.
  - Мета `theme-color` пока не трогать (задача 5).

- [ ] **Step 4: Прогон** — `npx playwright test tests/e2e/game.spec.js tests/e2e/accessibility.spec.js tests/e2e/styles.spec.js tests/e2e/room.spec.js tests/e2e/language.spec.js` → PASS (axe — контраст всех страниц и окон); `npx jest tests/code-structure.test.js` → PASS. Глазами: главная, комната, окно «Покинуть игру», 404 — телефон и компьютер против `_look.html`.

- [ ] **Step 5: Коммит** — «The paper-on-curtain look: sheets, buttons, ticket, modals, alerts».

---

### Task 4: Бирки, конверт, «+ Задать персонажа»

**Files:**
- Modify: `public/css/style.css` (наклейки), `public/js/game-room.js` (~600–660: конверт, раскрытая карточка, кнопка; ~571: класс раскрытой карточки), `public/js/translations.js` (тексты спец §6), `tests/e2e/helpers.js` (комментарии про 🎭), `docs/testing.md` (таблица помощников: «свой 🎭» → «свой конверт»)
- Test: `tests/e2e/game.spec.js`, `tests/e2e/room.spec.js`, `tests/e2e/language.spec.js`

**Interfaces:**
- Consumes: токены и `.player-card` (задача 3).
- Produces: разметка конверта `<div class="character-sticker mystery"><span class="seal" aria-hidden="true">?</span></div>`; кнопка `<button type="button" class="btn btn-outline-primary add-character-btn">` с текстом `+ ${getText('assignCharacter', 'Assign character')}`; класс `revealed` на `.player-card` раскрытого игрока (вместо `bg-warning bg-opacity-25`). Класс `add-character-btn` сохраняется — на него опирается `assignCharacter()` в `helpers.js`. `scripts/og-image.html` (задача 6) повторяет разметку конверта.

- [ ] **Step 1: Тесты.**
  - `game.spec.js`: тест «your own sticker is the light dashed 🎭…» заменить:

```js
test('your own character is a sealed envelope that reveals it', async ({ newPlayer }) => {
    const { players: { Alice: alice } } = await startedGame(newPlayer, ['Alice', 'Bob']);
    const own = playerCard(alice.page, 'Alice').locator('.character-sticker');

    await expect(own).toHaveClass(/\bmystery\b/);
    await expect(own).not.toHaveClass(/\bcolor-/);
    await expect(own.locator('.seal')).toHaveText('?');
    await expect(own).toHaveAttribute('title', text('yourCharacterClickReveal'));
    // A light envelope: every channel of its paper is pale
    const paper = await own.evaluate(sticker => getComputedStyle(sticker).backgroundColor);
    for (const channel of paper.match(/\d+/g).slice(0, 3).map(Number)) expect(channel).toBeGreaterThanOrEqual(200);
    await expect(alice.page.locator('#gameSteps li').nth(3)).toHaveText(text('step4'));
});
```
  - В тест раскрытия (`game.spec.js`, где вызывается `revealOwnCharacter`) добавить: `await expect(playerCard(bob.page, 'Alice')).toHaveClass(/\brevealed\b/)`.
  - `room.spec.js:46`: `.toHaveText('🎭')` → `await expect(playerCard(bob.page, 'Bob').locator('.character-sticker.mystery .seal')).toBeVisible()`. Новые тесты:

```js
test('"Assign character" is a button the keyboard reaches', async ({ newPlayer }) => {
    const { players: [alice] } = await roomWith(newPlayer, ['Alice', 'Bob']);
    await playerCard(alice.page, 'Bob').getByRole('button', { name: text('assignCharacter') }).focus();
    await alice.page.keyboard.press('Enter');
    await expect(playerCard(alice.page, 'Bob').locator('.character-input')).toBeFocused();
});

// Tags lean a little; a long name must still wrap inside the card on a phone
test('a long character stays inside its card', async ({ newPlayer }) => {
    const { players: [alice] } = await roomWith(newPlayer, ['Alice', 'Bob']);
    await assignCharacter(alice, 'Bob', 'W'.repeat(128));
    const card = await playerCard(alice.page, 'Bob').boundingBox();
    const tag = await playerCard(alice.page, 'Bob').locator('.character-sticker').boundingBox();
    expect(tag.x).toBeGreaterThanOrEqual(card.x);
    expect(tag.x + tag.width).toBeLessThanOrEqual(card.x + card.width);
});
```
  - `language.spec.js`:

```js
test('in a lobby the switch re-renders "Assign character"', async ({ newPlayer }) => {
    const alice = await newPlayer('Alice');
    const bob = await newPlayer('Bob');
    await joinRoom(bob, await createRoom(alice));
    await waitForPlayers(alice.page, 2);
    await alice.page.locator('.lang-toggle-btn').click();
    await expect(playerCard(alice.page, 'Bob').getByRole('button', { name: text('assignCharacter', 'ru') })).toBeVisible();
});
```

- [ ] **Step 2: Убедиться, что падают** — `npx playwright test tests/e2e/game.spec.js tests/e2e/room.spec.js tests/e2e/language.spec.js` → новые/переписанные FAIL (печати нет, «+» — `div` без имени, `revealed` у карточки нет). «Long character» на старом коде может пройти: сломать на минуту (`overflow-wrap` убрать у бирки) и увидеть FAIL.

- [ ] **Step 3: Реализация.**
  - `style.css` (спец §5, CSS из `look.css`): `.character-sticker` — бирка; семь правил `.character-sticker.color-<имя> { --deep: … }` (значения спец §2); наклон `-1.5deg`, у `.player-card:nth-child(even)` — `1.2deg`; булавка `.character-sticker:not(.mystery)::before`; `.long-text`; `.editing` + одно правило `.character-input` (старые два удалить); `.revealed` — золотое кольцо; `.mystery` — конверт и `.seal`; `.add-character-btn` — `display: block; width: calc(100% - 12px); margin: 16px 6px 0; padding-block: 10px`. Наведение: бирка выпрямляется (`rotate(0)`) — только для мыши; старый `scale(1.05)` и фиолетовый `.add-character-btn:hover` удалить.
  - `game-room.js`: конверт — `textContent = '🎭'` заменить на дочерний `span.seal` (`aria-hidden="true"`, текст `?`), `cursor` через `style` можно оставить; кнопка — `document.createElement('button')`, `type = 'button'`, `className = 'btn btn-outline-primary add-character-btn'`, `textContent = '+ ' + getText('assignCharacter', 'Assign character')` (вместо `innerHTML = '+'`), `title` убрать (надпись уже говорит то же); `playerCard.classList.add('revealed')` вместо `bg-warning`, `bg-opacity-25`.
  - `translations.js`: ключи из спец §6 (`assignCharacter` ru, `clickPlus`, `assignInstructions`, `step4`, `gameInProgress`, `clickStickers`) — en и ru.
  - `helpers.js`: комментарии у `startGame`/`revealOwnCharacter` — «конверт» вместо «🎭»; `docs/testing.md` — строка `revealOwnCharacter`.

- [ ] **Step 4: Прогон** — `npx playwright test tests/e2e/game.spec.js tests/e2e/room.spec.js tests/e2e/language.spec.js tests/e2e/leave-and-return.spec.js tests/e2e/accessibility.spec.js tests/e2e/styles.spec.js` → PASS; `npx jest` → PASS. Глазами: комната до старта (кнопки, ввод), после старта (конверт, раскрытие) — телефон и компьютер.

- [ ] **Step 5: Коммит** — «Characters on pinned tags, your own in a sealed envelope, a real Assign button».

---

### Task 5: Иконки и цвет приложения

**Files:**
- Create: `scripts/icon.html` (рисунок, спец §7: SVG 192×192 из символа `#icon-seal` в `_look.html`; шрифт — `@font-face` с `../public/fonts/abril-fatface-latin-400-normal.woff2` в своём `<style>`: страница открывается как файл, не сайтом, CSP её не касается), `scripts/icons.js`, `public/icons/apple-touch-icon.png`
- Regenerate: `public/icons/icon-{48,72,96,144,192,512}x….png`, `public/favicon.ico`
- Delete: `public/icons/*.svg`
- Modify: `public/sw.js` (`CACHE_NAME`, `iconAssets`), `public/manifest.json`, `public/index.html`, `public/game.html`, `public/404.html`
- Test: `tests/e2e/site.spec.js`, `tests/manifest.test.js`

**Interfaces:**
- Produces: `node scripts/icons.js` — пишет все файлы иконок; `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`.

- [ ] **Step 1: Тесты.**

```js
// site.spec.js
test('the icons the pages name are served, the iPhone one as a PNG', async ({ newPlayer, request }) => {
    const { page } = await newPlayer('Alice');
    await page.goto('/');
    for (const [rel, type] of [['icon', 'image/x-icon'], ['apple-touch-icon', 'image/png']]) {
        const answer = await request.get(await page.locator(`link[rel="${rel}"]`).getAttribute('href'));
        expect(answer.status(), rel).toBe(200);
        expect(answer.headers()['content-type'], rel).toBe(type);
    }
});
```
(Если Express отдаёт `.ico` как `image/vnd.microsoft.icon` — ожидать его: тест про то, что файл отдаётся иконкой, а не про написание типа.)

```js
// manifest.test.js — the color is written in four places (three pages and the manifest)
test('the pages and the manifest name the same app color', () => {
    expect(manifest.theme_color).toBe('#7e1a13');
    expect(manifest.background_color).toBe(manifest.theme_color);
    for (const page of ['index.html', 'game.html', '404.html']) {
        const html = fs.readFileSync(path.join(__dirname, '..', 'public', page), 'utf8');
        expect(html.match(/<meta name="theme-color" content="([^"]+)">/)[1]).toBe(manifest.theme_color);
    }
});
```

- [ ] **Step 2: Убедиться, что падают** — `npx jest tests/manifest.test.js` и `npx playwright test tests/e2e/site.spec.js` → FAIL.

- [ ] **Step 3: Реализация.**
  - `scripts/icons.js` (по образцу `og-image.js`: шапка-комментарий, CommonJS, `chromium`): открыть `icon.html` файлом, дождаться `document.fonts.ready`, для каждого размера 16, 32, 48, 72, 96, 144, 180, 192, 512 — viewport размера, `page.screenshot({ type: 'png' })` → `icon-NxN.png` (180 → `apple-touch-icon.png`; 16 и 32 в файлы не пишутся, только в ICO). `favicon.ico` из PNG 16, 32, 48 — без библиотек:

```js
// ICO = 6-byte header + a 16-byte entry per image + the PNGs themselves
function icoFrom(pngs /* [{ size, data: Buffer }] */) {
    const header = Buffer.alloc(6); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
    let offset = 6 + 16 * pngs.length;
    const entries = pngs.map(({ size, data }) => {
        const entry = Buffer.alloc(16);
        entry[0] = entry[1] = size % 256;          // 0 means 256
        entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
        entry.writeUInt32LE(data.length, 8); entry.writeUInt32LE(offset, 12);
        offset += data.length;
        return entry;
    });
    return Buffer.concat([header, ...entries, ...pngs.map(p => p.data)]);
}
```
  - Запустить `node scripts/icons.js`; удалить `public/icons/*.svg`.
  - `sw.js`: `CACHE_NAME = 'whoami-game-v1.6.0'`; `iconAssets` — `/favicon.ico`, `/icons/apple-touch-icon.png` и шесть PNG из манифеста.
  - `manifest.json`: `theme_color` и `background_color` → `#7e1a13`. Страницы: `<meta name="theme-color" content="#7e1a13">` (×3), `<meta name="background-color" content="#7e1a13">` (index), `apple-touch-icon` → PNG (index, game).

- [ ] **Step 4: Прогон** — `npx jest tests/manifest.test.js tests/service-worker.test.js` → PASS; `npx playwright test tests/e2e/site.spec.js` → PASS; `npx eslint scripts --max-warnings 0` → чисто. Глазами: `icon-192x192.png`, `favicon.ico` во вкладке — против раздела «Иконка» на `_look.html`.

- [ ] **Step 5: Коммит** — «App icons: a wax seal on envelope paper; PNG for the iPhone; cache v1.6.0».

---

### Task 6: Картинка превью ссылки

**Files:**
- Modify: `scripts/og-image.html`, `public/index.html` и `public/game.html` (`og:image:alt`, `twitter:image:alt`)
- Regenerate: `public/img/og-image.jpg`

**Interfaces:**
- Consumes: `style.css` целиком (задачи 1–4), разметка конверта (задача 4), вывеска (задача 2).

- [ ] **Step 1: Исходник.** `og-image.html` (1200×630, свой `<style>` только для рамки кадра, как сейчас): фон — занавес (`body` из `style.css`), слева — вывеска (`.brand-sign`, ширина ~520 px) и строка «Guess your secret character with friends» (Oswald, `--on-page`); справа — `.game-card` с тремя `.player-card`: Anna — бирка `color-red` «Sherlock Holmes», Max — `color-blue` «Cleopatra», Kate (**You**) — конверт. Эмодзи-маска и старый заголовок уходят.
- [ ] **Step 2: Снимок** — `node scripts/og-image.js`; посмотреть `public/img/og-image.jpg`.
- [ ] **Step 3: Alt** в обеих страницах (`og:image:alt` и `twitter:image:alt`): `Who am I? sign on a theatre curtain, and player cards with pinned character tags: Sherlock Holmes, Cleopatra, and your own sealed in an envelope.`
- [ ] **Step 4: Прогон** — `npx playwright test tests/e2e/link-preview.spec.js` → PASS (размер ≤ 300 КБ, две карточки равны).
- [ ] **Step 5: Коммит** — «Link preview in the playbill look».

---

### Task 7: Документы, уборка, полный прогон

**Files:**
- Modify: `CLAUDE.md`, `docs/publishing.md`, `README.md` (если описывает внешний вид: `grep -n -i "purple\|gradient\|🎭" README.md`)
- Delete: `public/_look.html`, `public/_look/` (не в git), строку `/public/_look*` и её комментарий из `.git/info/exclude`, `docs/superpowers/specs/2026-10-13-playbill-look-design.md`, `docs/superpowers/plans/2026-10-13-playbill-look.md`

- [ ] **Step 1: CLAUDE.md** — только принципы, без истории и чисел:
  - Architecture: `public/fonts/` (Oswald latin+cyrillic, Abril Fatface latin; OFL), `scripts/icon.html` + `scripts/icons.js` (иконки и `favicon.ico`), строка `index.html` — «вывеска».
  - Rule 1: иконки теперь PNG/ICO, снимаются `node scripts/icons.js`.
  - Gotchas: вывеска — три намеренные копии (`tests/brand-sign.test.js`), всегда английская (логотип; `h1` не переводится, без `data-i18n`), звёзды нарисованы; шрифты — `font-display`, preload Abril, кириллица только у Oswald; цвета игроков — переменная `--deep` в правиле `.character-sticker.color-<имя>`; свой персонаж — конверт с печатью (заменяет описание «light dashed, 🎭»); «+ Задать персонажа» — `<button>` с классом `add-character-btn`; раскрытая карточка — класс `revealed`; `text-muted` красится через `--bs-secondary-color`; цвет приложения `#7e1a13` в трёх страницах и манифесте (`manifest.test.js`); красный — только акценты и опасные действия.
- [ ] **Step 2: `docs/publishing.md`** — новая композиция превью; вывеска приложения — `svg.brand-sign` на продакшене (её может снимать escapist-web).
- [ ] **Step 3: Уборка** — удалить временную страницу и строку в `.git/info/exclude`, удалить спецификацию и план (`git rm`).
- [ ] **Step 4: Полный прогон** — `npm test` → ESLint, Jest, Playwright — всё зелёное (вывод показать владельцу).
- [ ] **Step 5: Коммит** — «Docs for the playbill look; design notes leave the repository».
- [ ] **Step 6: Владелец смотрит** результат на `npm start` (телефон и компьютер). После его «да» — слияние по git flow (`superpowers:finishing-a-development-branch`: `git merge --no-ff` в `develop`, ветка удаляется). Релиз — отдельно, по `docs/release.md`, push в `master` только после подтверждения владельца.
