# Browser Tests (Playwright) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm test` drives the real game in Chromium on a phone and a desktop with several players per room, replaces the Jest tests that only read source text or test copied code, and the same suite checks production after a release.

**Architecture:** Playwright starts its own `node server.js` on port 3100; every player is a separate browser context created by a `newPlayer` fixture that also fails the test on any page error, `console.error` or unexpected dialog. Helpers in `tests/e2e/helpers.js` act only through pages and buttons, so `BASE_URL=https://whoami-game.onrender.com` runs the same suite against production.

**Tech Stack:** `@playwright/test ~1.63.0`, `@axe-core/playwright ~4.13.0`, Jest 30 (unit tests), ESLint 10, CommonJS everywhere.

**Spec:** `docs/superpowers/specs/2026-10-11-browser-tests-design.md` — read it first; this plan refers to its scenario table.

## Global Constraints

- CommonJS (`require`) in every new file, like the rest of the project; `npm run lint` (`--max-warnings 0`) stays clean.
- Projects: `mobile` = `devices['Pixel 7']` (listed first), `desktop` = `devices['Desktop Chrome']`. Chromium only.
- `use`: `locale: 'en-US'`, `reducedMotion: 'reduce'`, `serviceWorkers: 'block'`, `trace: 'retain-on-failure'`, `baseURL: process.env.BASE_URL || 'http://localhost:3100'`.
- Local server: `node server.js` with `PORT=3100`, ready on `http://localhost:3100/api/version`, `reuseExistingServer: false`; no `webServer` when `BASE_URL` is set.
- No `waitForTimeout` anywhere in `tests/e2e/` (Task 11 greps for it).
- Expected texts come from `public/js/translations.js` via `text()`; never typed into a test.
- Every new user-facing string gets both `en` and `ru` keys (`tests/translations-real.test.js`).
- Every test creates its own room; tests run in parallel (`fullyParallel: true`).
- A scenario that fails on the current code because the GAME is wrong (not the test): stop, show the owner the failing test and the cause, fix only after their yes (spec: "о таком сообщается владельцу отдельно").
- Each task ends with `npm test` green and one commit; commit messages in English, outcome-style like the history, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **HTML in a name or a character** (`<img src=x onerror=alert(1)>`) must show as plain text on every player's screen, in notifications too, and never run — Task 4 adds `a name and a character with HTML stay text on every screen`.
2. **A room link typed in lower case** (`/game/abc123`) should open the same room; the client reads the code from the URL as-is and may reject it — Task 4 adds `a lower-case room link opens the room`.
3. **A player joins while someone has the character input open**: list rebuilds are skipped during an edit, so the newcomer must appear once the edit ends — Task 4 adds `a player who joins during an edit appears once the edit ends`.
4. **A file that is not an image** picked in the photo upload must show the read error and leave the grid usable — Task 3 adds `a file that is not an image shows the read error`.
5. **A deleted room must stay deleted**: the last leaver removes the room from memory, but a disk backup written by the keep-alive loop (`games/CODE.json`) is not removed, so `/game/CODE` can bring the room back with the old players — Task 7 (owner's decision at plan review).

---

### Task 1: Playwright infrastructure, players fixture, site checks

**Files:**
- Create: `playwright.config.js`, `tests/e2e/helpers.js`, `tests/e2e/site.spec.js`
- Modify: `package.json` (devDependencies, scripts, `jest.testPathIgnorePatterns`), `eslint.config.mjs`, `.gitignore`, `tests/app-version.test.js`
- Delete: `tests/i18n-initialization.test.js` (replaced by the fixture's page-error guard)

**Interfaces:**
- Produces (`tests/e2e/helpers.js`, `module.exports`):
  - `test` — `base.extend` with fixture `newPlayer: (name: string, options?: { locale?: string }) => Promise<Player>`; `Player = { name, page, context, expectDialog(match: string|RegExp): void, allowConsoleError(match: RegExp): void }`. Each call opens `browser.newContext({ ...testInfo.project.use, locale })` so the device and `baseURL` follow the project. After `use()`: close every context, then throw if any player collected an unexpected `pageerror`, `console.error` (not matched by `allowConsoleError`) or dialog (not queued by `expectDialog`; queued dialogs are accepted in order, unexpected ones dismissed).
  - `expect` — re-exported from `@playwright/test`.
  - `text(key: string, lang = 'en', placeholders = {}) => string` — `require('../../public/js/translations.js').translations`, same `{name}` substitution as `Localization.getText`.

- [ ] **Step 1: Install and wire Playwright**

`npm install -D @playwright/test@~1.63.0 @axe-core/playwright@~4.13.0`, `npx playwright install chromium`.
`package.json` scripts: `"test": "npm run lint && jest && playwright test"`, `"test:e2e": "playwright test"`, `"test:e2e:headed": "playwright test --headed"`, `"test:e2e:ui": "playwright test --ui"`, `"test:e2e:prod": "BASE_URL=https://whoami-game.onrender.com playwright test"`; `"jest": { "testPathIgnorePatterns": ["/node_modules/", "/tests/e2e/"] }`.
`playwright.config.js`: the Global Constraints values plus `testDir: './tests/e2e'`, `testMatch: '**/*.spec.js'`, `forbidOnly: !!process.env.CI`, `retries: 0`, `reporter: [['list'], ['html', { open: 'never' }]]`, `timeout: BASE_URL ? 120_000 : 30_000`, `expect.timeout: BASE_URL ? 15_000 : 5_000`. A header comment says why: own port, fresh server, prod via `BASE_URL`, cold start on the free plan.
`eslint.config.mjs`: the Jest block's `files` becomes `["tests/*.js"]`; a new block `files: ["tests/e2e/**/*.js", "playwright.config.js"]`, `sourceType: "commonjs"`, globals `node` + `browser` (callbacks of `page.evaluate()` run in the page), `rules: sharedRules`.
`.gitignore`: `test-results/`, `playwright-report/`, `blob-report/`, `playwright/.cache/` under a commented "Playwright reports" section.

- [ ] **Step 2: Write `tests/e2e/site.spec.js` (fails: no helpers yet)**

```js
test('a link to a room that does not exist leads home with a message', async ({ newPlayer }) => {
    const alice = await newPlayer('Alice');
    await alice.page.goto('/game/ZZZZZ9');
    await expect(alice.page).toHaveURL(/\/\?error=room-not-found$/);
    await expect(alice.page.locator('.alert-danger')).toContainText(text('roomNotFound'));
});
test('both pages show the version the server answers', async ({ newPlayer, request }) => {
    const { version } = await (await request.get('/api/version')).json();
    // landing and a created room (create via the UI: name + #createNewGame)
    // -> expect(page.locator('footer [data-app-version]')).toHaveText(`v${version}`)
});
test('the guard fails a test on a page error', ...) // test.fail(): page.evaluate(() => setTimeout(() => { throw new Error('boom'); }))
```

- [ ] **Step 3: Run it** — `npx playwright test tests/e2e/site.spec.js` → FAIL (`Cannot find module './helpers'`).

- [ ] **Step 4: Implement `tests/e2e/helpers.js`** with the Interfaces above.

- [ ] **Step 5: Run** — `npx playwright test tests/e2e/site.spec.js` → 6 passed (3 tests × 2 projects; the guard test is an expected failure).

- [ ] **Step 6: Trim old tests** — `tests/app-version.test.js` keeps only `GET /api/version answers the version from package.json`; delete `tests/i18n-initialization.test.js`.

- [ ] **Step 7: `npm test`** → ESLint clean, Jest green, Playwright green. **Commit** "Run the game in a real browser: Playwright with a players fixture".

### Task 2: Landing page

**Files:**
- Create: `tests/e2e/landing.spec.js`
- Modify: `tests/e2e/helpers.js`, `tests/input-limits.test.js`
- Delete: `tests/avatar-shuffle.test.js`, `tests/avatar-persistence.test.js`

**Interfaces:**
- Produces:
  - `seedStorage(player: Player, entries: Record<string,string>) => Promise<void>` — opens `/`, writes the entries to localStorage, stays on the page (callers reload or navigate next).
  - `createRoom(player: Player) => Promise<string>` — `/`, fill `#playerName` with `player.name`, click `#createNewGame`, wait for `/game/CODE` and the own `.player-card`; returns `CODE`.
  - `joinRoom(player: Player, code: string) => Promise<void>` — `/game/CODE`, expect the redirect to `/?join=CODE`, fill the name, click `#joinBtn`, wait for `/game/CODE` and the own `.player-card`.
  - `playerCard(page, name: string) => Locator` — `.player-card` whose `.player-name` text is exactly `name`.
  - `waitForPlayers(page, count: number) => Promise<void>` — `expect(page.locator('.player-card')).toHaveCount(count)`.

- [ ] **Step 1: Write `landing.spec.js`** — one test per row item of the spec's `landing.spec.js` scenario. Names and the assertion that decides each:
  - `twelve avatars, the first one selected` — `#avatarSelector .avatar-option` count 12; first has `.selected`; `#selectedAvatar` value equals its `data-avatar`.
  - `clicking an avatar selects it` — `.selected` moves; `#selectedAvatar` follows.
  - `shuffle is a labelled button that deals another set without submitting the form` — role `button`, accessible name `text('shuffleAvatars')`, its `svg` has `aria-hidden="true"`; after click the set of `data-avatar` values differs and the URL is unchanged.
  - `the grid has 4 columns on a phone and 6 on a desktop; tiles are square` — `getComputedStyle(grid).gridTemplateColumns.split(' ').length` is 4 for `mobile`, 6 for `desktop` (`testInfo.project.name`); a tile's `boundingBox` width equals height (±1px).
  - `Join needs a 6-character code, which disables Create` — `#joinBtn` disabled for `''`, `'abc'`; for `'abc123'` value becomes `ABC123`, `#joinBtn` enabled, `#createNewGame` disabled.
  - `a ?join= link fills in the code` — `/?join=abc123` → `#roomCode` `ABC123`, `#joinBtn` enabled.
  - `an empty name asks for a name` — `expectDialog(text('pleaseEnterName'))`, click `#createNewGame`, URL still `/`.
  - `a name longer than the limit is cut` — fill 200 × `'a'` into `#playerName` with `pressSequentially`; value length 128.
  - `the name and the avatar are remembered after creating a room` and `... after joining a room` — create (or join) with a non-first avatar, open `/` again: `#playerName` has the name, the first tile is that avatar and selected.
  - `a tampered saved avatar is ignored` — `seedStorage(p, { 'whoami-player-avatar': JSON.stringify('<b>x</b>') })`, reload: no tile with that `data-avatar`, 12 tiles.

- [ ] **Step 2: Run** `npx playwright test tests/e2e/landing.spec.js` → the tests that need `seedStorage` FAIL; add `seedStorage`, rerun → PASS. Any other failure is a finding (Global Constraints).

- [ ] **Step 3:** delete `avatar-shuffle.test.js`, `avatar-persistence.test.js`; in `input-limits.test.js` delete `index.html does not hardcode a name maxlength`.

- [ ] **Step 4: `npm test`**, **commit** "Landing page in the browser: avatars, buttons, remembered choices".

### Task 3: Custom photo avatar

**Files:**
- Create: `tests/e2e/custom-avatar.spec.js` (test images are built in code: no binary files in the repository)
- Modify: `tests/e2e/helpers.js`, `tests/custom-avatar.test.js`

**Interfaces:**
- Consumes: `newPlayer`, `seedStorage`, `createRoom`, `joinRoom`, `playerCard`, `text` (Tasks 1–2).
- Produces: `pngFile(width = 64, height = 64) => { name, mimeType: 'image/png', buffer }` — a valid PNG built with `zlib`.

- [ ] **Step 1: Write the tests** (spec row `custom-avatar.spec.js`):
  - `an uploaded photo becomes the selected first tile` — `#uploadAvatar` is a `button` with `type="button"` and name `text('uploadAvatar')`; `#avatarFileInput` has `accept="image/*"`; `setInputFiles(pngFile())`; first tile contains `img[src^="data:image/jpeg;base64,"]` and is selected.
  - `the photo stays first after shuffle`.
  - `the photo is not saved until the player creates or joins a room` — after upload, `localStorage['whoami-player-avatar']` is unchanged; after `createRoom` it is the data URL.
  - `both players see the photo on the card` — Bob joins; on both pages `playerCard(page,'Alice') img` exists.
  - `a saved "photo" with HTML or javascript: is never rendered` — seed `'data:image/png;base64,"><img src=x onerror=alert(1)>'` and `'javascript:alert(1)'`: no extra tile, no dialog (guard), `#avatarSelector img` count 0.
  - Review Focus 4: `a file that is not an image shows the read error` — `setInputFiles({ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') })` → `.alert-danger` contains `text('avatarReadFailed')`; 12 tiles, one selected.

- [ ] **Step 2: Run** → FAIL (`pngFile` missing) → implement → PASS.

- [ ] **Step 3:** in `custom-avatar.test.js` delete the describes "Upload button markup (index.html)" and "Rendering is XSS-safe (client wiring)" (and their now-unused file reads).

- [ ] **Step 4: `npm test`**, **commit** "Photo avatars in the browser".

### Task 4: Room and character assignment

**Files:**
- Create: `tests/e2e/room.spec.js`
- Modify: `tests/e2e/helpers.js`, `tests/input-limits.test.js`
- Delete: `tests/blur-event.test.js`, `tests/start-game-button.test.js`

**Interfaces:**
- Consumes: `createRoom`, `joinRoom`, `playerCard`, `waitForPlayers` (Task 2).
- Produces: `assignCharacter(player, toName: string, character: string) => Promise<void>` (`.add-character-btn` in `playerCard(toName)`, fill `.character-input`, Enter, wait until the card shows `character`); `countSentEvents(page, eventName: string) => () => number` (counts Socket.IO packets naming `eventName` in `websocket` `framesent` payloads and in polling `request` POST bodies, registered before the action).

- [ ] **Step 1: Write the tests** (spec row `room.spec.js`):
  - `both players see both cards in join order` — on both pages `.player-name` texts equal `['Alice','Bob']`.
  - `two players may have the same name` — two `Sam`: 2 cards on both pages.
  - `no + on your own card`.
  - `Enter saves a character; the target does not see it, the others do` — three players; Alice assigns `Napoleon` to Bob: Carol's page shows it in Bob's card, Bob's page has no `Napoleon` text.
  - `clicking away saves the character` — fill, then click `#gameStatus` (outside the input) → the card shows it on both pages.
  - `Enter followed by losing focus saves once` — `const sent = countSentEvents(alice.page, 'assign-character')`; fill, press Enter; `expect.poll(sent).toBe(1)` and it stays 1 after the edit closes.
  - `Escape restores the previous character` — edit `Napoleon` → type `Caesar` → Escape → shows `Napoleon` on both pages.
  - `an empty or blank character removes it` — edit to `'   '` + Enter → the card shows `.add-character-btn` again on both pages.
  - `the character field stops at the limit` — `.character-input` `maxLength` is 128 and a 200-char `pressSequentially` leaves 128.
  - `Start Game waits for two players and a character for everyone` — disabled alone; disabled with Bob but no characters; disabled with one of two assigned and with a blank one; enabled when both assigned.
  - Review Focus 1: `a name and a character with HTML stay text on every screen` — name `<b>Bob</b>`, character `<img src=x onerror=alert(1)>`: the literal strings appear as text; `playerCard` contains no `b` or `img` element from them; no dialog.
  - Review Focus 2: `a lower-case room link opens the room` — Bob opens `/game/${code.toLowerCase()}` and joins → both see 2 cards.
  - Review Focus 3: `a player who joins during an edit appears once the edit ends` — Alice and Bob in the room; Alice opens the input on Bob's card; Carol joins; Alice presses Enter → `waitForPlayers(alice.page, 3)`.

- [ ] **Step 2: Run** → helper-missing FAIL → implement → run. Review Focus 2 and 3 may fail on the current game: stop and report (Global Constraints).

- [ ] **Step 3:** delete `blur-event.test.js`, `start-game-button.test.js`; in `input-limits.test.js` delete `game-room.js uses the constant instead of a hardcoded number`.

- [ ] **Step 4: `npm test`**, **commit** "Room and character assignment in the browser".

### Task 5: The started game

**Files:**
- Create: `tests/e2e/game.spec.js`
- Modify: `tests/e2e/helpers.js`
- Delete: `tests/mystery-sticker.test.js`

**Interfaces:**
- Produces: `startGame(player)` (click `#startGame`, wait for own `.character-sticker.mystery`), `revealOwnCharacter(player)` (click own `.mystery` → `#revealModal.show` → `#confirmReveal` → wait for own `.character-sticker.revealed`), `startedGame(newPlayer, names: string[]) => Promise<{ players: Record<string, Player>, code: string, characters: Record<string, string> }>` (first name creates, the rest join, each assigns the next player in the circle a character from `['Napoleon','Cleopatra','Gandalf','Sherlock','Frida','Einstein']`, first player starts; `characters[name]` is what that player wears).

- [ ] **Step 1: Write the tests** (spec row `game.spec.js`):
  - `your own sticker turns into the light dashed 🎭` — own sticker has `.mystery`, text `🎭`, no `color-*` class, computed `borderStyle` contains `dashed`; the `#gameSteps li` number 4 contains `🎭`.
  - `the others' characters keep their player colors` — each other card's sticker has a `color-<name>` class and its character text.
  - `characters cannot be edited after the start` — clicking another player's sticker opens no `.character-input`.
  - `Cancel in the reveal window reveals nothing` — `.mystery` click → `#revealModal` → `.btn-secondary` → still `.mystery`; the others got no notification.
  - `revealing shows your character and tells everyone` — after `revealOwnCharacter`, own sticker text is `characters.Alice`; Bob's page `.alert.position-fixed` contains `text('playerRevealedNotification','en',{ playerName: 'Alice', character: characters.Alice })`.
  - `restart returns the room to assigning` — `#restartGame` → `#restartModal` → `#confirmRestart` → on both pages no `.character-sticker`, `.add-character-btn` count 1, `#startGame` disabled.

- [ ] **Step 2: Run** → FAIL → implement helpers → PASS. **Step 3:** delete `mystery-sticker.test.js`. **Step 4: `npm test`**, **commit** "The started game in the browser: mystery sticker, reveal, restart".

### Task 6: Leaving, returning, reloading

**Files:**
- Create: `tests/e2e/leave-and-return.spec.js`
- Modify: `tests/e2e/helpers.js`, `tests/leave-game.test.js`
- Delete: `tests/frontend-player-id.test.js`

**Interfaces:**
- Produces: `leaveGame(player)` (`#leaveGame` → `#leaveModal.show` → `#confirmLeave` → wait for URL not starting with `/game/`).

- [ ] **Step 1: Write the tests** (spec row `leave-and-return.spec.js`):
  - `leaving goes home with the code and the name filled in` — URL `/?join=CODE`, `#playerName` = name; the others: one card fewer and a notification `text('playerLeftNotification','en',{ playerName })`.
  - `the last player to leave deletes the room` — both leave; `/game/CODE` → `/?error=room-not-found`.
  - `a leaver returns to the started round with the same character, color and place` — from `startedGame(['Alice','Bob','Carol'])`, Bob leaves and joins again from `/?join=CODE`: Alice's page shows Bob's character with the same `color-*` class at the same index of `.player-name`.
  - `a newcomer cannot join a started game` — `expectDialog(/already started/i)`; Dave stays on `/`.
  - `reloading keeps the same player` — `localStorage.playerId` matches `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`, after `page.reload()` it is the same and both pages still show 2 cards; in a started game the reloaded player still sees `.mystery` and the others' characters.
  - `a broken stored player ID is replaced without a double` — `seedStorage(bob, { playerId: 'player_123' })`, join: Bob's stored ID is a UUID v4, rooms show 2 cards; reload → still 2.
  - `two browsers get two different player IDs`.

- [ ] **Step 2: Run** → FAIL → implement `leaveGame` → PASS (except Task 7's case below). **Step 3:** delete `frontend-player-id.test.js`; in `leave-game.test.js` delete the describe "Leaving keeps the way back open (client wiring)" and its file reads. **Step 4: `npm test`**, **commit** "Leaving, returning and reloading in the browser".

### Task 7: A deleted room stays deleted (owner decides at plan review)

**Files:**
- Modify: `server.js` (leave-game handler; ghost removal in `keepGamesAlive`)
- Create: `tests/game-backup.test.js`

**Interfaces:**
- Produces: `deleteGameBackup(gameId: string) => void` in `server.js`, exported next to `app`; removes `games/<gameId>.json` if it exists, never throws.

- [ ] **Step 1: Failing test** `tests/game-backup.test.js`: `a deleted game's backup file is removed` — write `games/TESTBK.json`, call `deleteGameBackup('TESTBK')`, file is gone; `a missing backup is not an error` — `expect(() => deleteGameBackup('NOFILE')).not.toThrow()`.
- [ ] **Step 2: Run** `npx jest tests/game-backup.test.js` → FAIL (`deleteGameBackup is not a function`).
- [ ] **Step 3: Implement** and call it where `result.gameDeleted` / `removal.gameDeleted` is true.
- [ ] **Step 4: `npm test`**, **commit** "A room deleted by its last leaver no longer comes back from its backup".

### Task 8: Share and copy

**Files:**
- Create: `tests/e2e/share.spec.js`
- Modify: `tests/e2e/helpers.js`
- Delete: `tests/share-button.test.js`

**Interfaces:**
- Produces: `stubShare(page, behaviour: 'record' | 'abort' | 'unsupported') => Promise<void>` — `addInitScript` before navigation: `'record'` stores each `navigator.share` argument in `window.shareCalls`, `'abort'` rejects with `new DOMException('closed', 'AbortError')`, `'unsupported'` deletes `navigator.share`.

- [ ] **Step 1: Write the tests:** `Share opens the share sheet with the room link` (`shareCalls[0].url` ends with `/game/CODE`; button is `type="button"` with name `text('share')`); `closing the share sheet is silent` (`'abort'`: no dialog, no alert, no console error — the guard); `without Web Share the link is copied` (`'unsupported'` + `context.grantPermissions(['clipboard-read','clipboard-write'])`: button text becomes `text('copiedSuccess')`, `#shareLink` value ends with `/game/CODE`); `Copy Link confirms the copy` (same for `#copyLink`).
- [ ] **Step 2: Run** → FAIL → implement `stubShare` → PASS. **Step 3:** delete `share-button.test.js`. **Step 4: `npm test`**, **commit** "Share and copy in the browser".

### Task 9: Languages

**Files:**
- Create: `tests/e2e/language.spec.js`
- Delete: `tests/localization.test.js`

**Interfaces:** Consumes `newPlayer(name, { locale })`, `seedStorage`, `startedGame`, `revealOwnCharacter`, `text`.

- [ ] **Step 1: Write the tests:** `a Russian browser gets Russian` (`locale: 'ru-RU'` → `h1` text `text('title','ru')`); `an unknown language falls back to English` (`de-DE`); `the saved choice beats the browser language` (`seedStorage({ 'whoami-language': 'ru' })` with `en-US`); `an invalid saved language is ignored` (`'xx'` → English); `the switch changes texts, placeholders, titles and aria-labels and is remembered` (`.lang-toggle-btn` → `#playerName` placeholder `text('enterName','ru')`, `#shuffleAvatars` `title` and `aria-label` `text('shuffleAvatars','ru')`; reload → still Russian); `in a room the switch re-renders the status and the cards` (Alice `en-US` and Bob `ru-RU` in one room; after Alice switches to Russian her `#gameStatus` and `.player-card` texts equal Bob's); `the reveal notification reads in each player's language` (Alice `en`, Bob `ru`: Bob's notification equals `text('playerRevealedNotification','ru',{...})`); `an unknown key shows the key itself` (`page.evaluate(() => i18n.getText('noSuchKey'))` → `'noSuchKey'`).
- [ ] **Step 2: Run** → PASS expected (behaviour exists); if a test passes, break it on purpose once (e.g. `seedStorage` the wrong key) to see it fail, then restore. **Step 3:** delete `localization.test.js`. **Step 4: `npm test`**, **commit** "Languages in the browser".

### Task 10: Accessibility (axe) and the share link label

**Files:**
- Create: `tests/e2e/accessibility.spec.js`
- Modify: `public/game.html` (`#shareLink`), `public/js/translations.js` (new key `shareLinkLabel`: en `"Room link"`, ru `"Ссылка на комнату"`)

- [ ] **Step 1: Write the tests** with `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze()` and `expect(violations).toEqual([])` (map to `id: targets` for a readable diff): `the landing page`, `a room while players assign characters` (2 players), `a started game`, `the reveal window`, `the restart window`, `the leave window` (each window opened, `.show` present).
- [ ] **Step 2: Run** → FAIL on `label` for `#shareLink` only.
- [ ] **Step 3: Fix:** `data-i18n-aria-label="shareLinkLabel"` on `#shareLink`, plus the two translation strings.
- [ ] **Step 4: Run** → PASS; `npm test`; **commit** "Accessibility checks with axe; the share link field gets a label".

### Task 11: The API tests use the real server; documents

**Files:**
- Modify: `tests/api.test.js`, `docs/release.md`, `CLAUDE.md`, `README.md`, `.claude/skills/verify/SKILL.md`
- Create: `docs/testing.md`

- [ ] **Step 1:** in `api.test.js` replace `createTestApp()` and its copied routes with `const { app } = require('../server')`; drop the now-unused `express`/`game-logic` requires. Run `npx jest tests/api.test.js`. A test that behaves differently against the real server is a finding: report it before changing the test or the server.
- [ ] **Step 2: `docs/testing.md`** (Russian, the spec's "Документы" bullet): commands, the two projects, where a test goes, helpers table (the Interfaces of Tasks 1–8), the seven rules, debugging (`npx playwright show-trace test-results/<test>/trace.zip`, `npm run test:e2e:headed`, `whoami-debug`), production runs.
- [ ] **Step 3:** `docs/release.md` — after "Проверка после выкладки" step 2: `npm run test:e2e:prod`. `README.md` — `npx playwright install chromium` and the test commands. `CLAUDE.md` — Commands (`test:e2e*`), Architecture tree (`playwright.config.js`, `tests/e2e/`, `docs/testing.md`), rule 3 ("what the player sees changes → a browser test in `tests/e2e`"), Decisions ("browser tests in Chromium only: phone and desktop"), Gotchas (test server on 3100; `stubShare`; `reducedMotion`); remove references to deleted test files (`grep -n "\.test\.js" CLAUDE.md` and check each still exists). Verify skill: repeatable checks use `tests/e2e/helpers.js`.
- [ ] **Step 4: Checks:** `grep -rn "waitForTimeout" tests/e2e` → nothing; `npm test` → green; `ls tests/*.test.js` matches the spec's kept/trimmed lists.
- [ ] **Step 5: Commit** "API tests use the real server; testing documented".

### Finishing

At the merge into `develop` (`superpowers:finishing-a-development-branch`, git flow from `docs/release.md`): delete `docs/superpowers/specs/2026-10-11-browser-tests-design.md` and this plan in a last commit on the branch. After the next release, `npm run test:e2e:prod` against production is the spec's last "Готово, когда" item.
