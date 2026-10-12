# Security Headers and 404 Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every page of the game runs only scripts and styles from its own site, under the same security headers as Flying Solo. A missing address gets the game's own 404 page. A room link cannot open a file outside the backups folder.

**Architecture:**
- **Headers.** One Express middleware in `server.js` sets the headers on every Express response.
- **Third-party code.** Bootstrap 5.3.8 is copied from wog into `public/vendor/bootstrap/`. The Buy Me a Coffee widget script gives way to a plain link with an image.
- **Inline code.** Inline `style=` and `onclick` move to `style.css` and `addEventListener`.
- **404.** A last catch-all handler serves `public/404.html` with status 404.
- **Room links.** `GET /game/:roomCode` checks the code format before touching the disk.

**Tech Stack:** Express 4, Socket.IO 4, vanilla JS, Bootstrap 5.3.8 (local copy), Jest + supertest, Playwright 1.63 + axe. CommonJS everywhere.

**Spec:** `docs/superpowers/specs/2026-10-12-security-headers-design.md`. Read it first; this plan does not repeat its reasoning.

## Global Constraints

- **CSP, exactly:** `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`
- **Other headers:**
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
  - `X-Content-Type-Options: nosniff`
  - no `X-Powered-By`
- **Bootstrap:**
  - Files are byte-identical copies of `~/projects/wog-wwi-solo/app/vendor/bootstrap/{bootstrap.min.css,bootstrap.bundle.min.js,LICENSE}`, md5 `1b63eb49…`, `5cc1b73e…`, `1b1cb0e2…` in `ls` order.
  - Pages link `/vendor/bootstrap/bootstrap.min.css` and `/vendor/bootstrap/bootstrap.bundle.min.js`.
- **No new npm packages.**
- **Leave alone:**
  - `public/sw.js`;
  - `public/icons/`: the coffee image goes to `public/img/`.
- **Translations.** Every new UI string has `en` and `ru` keys in `public/js/translations.js`. Exact texts:
  - `notFoundTitle` — Page not found / Страница не найдена
  - `notFoundText` — There is nothing at this address. The game is on the main page. / По этому адресу ничего нет. Игра — на главной странице.
  - `openGame` — Open the game / Открыть игру
  - `buyCoffee` — Support the author: buy me a coffee / Поддержать автора: угостить кофе
- **Expected texts in tests** come from `text()` (`tests/e2e/helpers.js`), never typed by hand.
- **Break every new test once.** Each new test is broken once on purpose and seen to fail (`docs/testing.md`). Mutations are made on a committed tree and undone with `git checkout -- <file>` (a dirty tree once lost real edits).
- **Each task ends with `npm test` green and one commit.**
  - Commit messages are in English, outcome-style, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Under heavy machine load the browser tests time out on default workers. Rerun with `npx playwright test --workers=2` before suspecting the code.

## Review Focus

1. **Photo avatar under CSP.** The upload opens the file at a `blob:` address and the result is a `data:` URL. Both must stay allowed.
   - Covered by `tests/e2e/custom-avatar.spec.js`, which runs under CSP from Task 4 on.
   - Task 4 checks it explicitly: those tests must pass with the CSP in place.
2. **Bootstrap 5.3 changes how buttons, alerts and modals look.** Contrast must stay WCAG AA, and the windows must open and close as before.
   - Covered by `accessibility.spec.js` (axe) and the game/leave specs.
   - Appearance: before/after screenshots in Task 2.
3. **A lower-case room link** (`/game/abc123`) must still open the room after the format check.
   - Covered by `room.spec.js` ("a lower-case room link opens the room").
   - Task 1 runs it explicitly.
4. **An unknown address under `/api/`** must answer 404, not the game page or 200. Task 5 adds a request test.
5. **Socket.IO under `connect-src 'self'`.** Every multi-player browser test proves the live connection. Task 4 also checks that the WebSocket upgrade is not blocked: no CSP violation is reported during `startedGame`. The guard turns any violation into a failure.

---

### Task 1: The room link checks the code format before reading the disk

**Files:**
- Modify: `server.js` (route `GET /game/:roomCode`, ~line 38)
- Test: `tests/game-backup.test.js`

**Interfaces:**
- Consumes: `gameLogic.isValidRoomCode(code: string): boolean` (game-logic.js:466); `module.exports = { app, deleteGameBackup }` (server.js).
- Produces: nothing new.

- [ ] **Step 1: Write the failing test** in `tests/game-backup.test.js`.
  - Header comment: the file now covers the room link restoring from a backup too.
  - Require `supertest` and take `app` from `../server`.
  - Add `describe('GET /game/:roomCode', ...)`:

```js
test('a room link that is not a room code opens no file', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    // A file in the shape of a saved room, one folder above the backups
    fs.writeFileSync(canary, JSON.stringify({
        id: 'CANARY', players: [], characters: {}, state: 'waiting',
        revealedPlayers: [], created: new Date().toISOString(),
    }));

    const response = await request(app).get('/game/..%2FCANARY');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/?error=room-not-found');
    console.log.mockRestore();
});
```

- [ ] **Step 2: Run it and watch it fail.**
  - Run: `npx jest tests/game-backup.test.js`
  - Expected: FAIL. Status `200`: the server restored `CANARY.json` and sent `game.html`.

- [ ] **Step 3: Implement the check.** In the route, after `toUpperCase()` and before the memory/disk lookups:
  - when `!gameLogic.isValidRoomCode(roomCode)`, `return res.redirect('/?error=room-not-found')`;
  - add a one-line comment: the code becomes part of a file path.

- [ ] **Step 4: Run it and watch it pass**, together with the lower-case link.
  - Run: `npx jest tests/game-backup.test.js && npx playwright test room.spec.js -g "lower-case"`
  - Expected: PASS, 4 Jest tests and 2 browser tests (mobile + desktop).

- [ ] **Step 5: Mutation, then suite and commit.**
  - Comment out the new check on the committed tree and see the test fail. Restore the file.
  - Run `npm test` and expect green.
  - Commit: `A room link opens a backup only for a real room code`.

---

### Task 2: Nothing from other sites: local Bootstrap 5.3.8 and the coffee link

**Files:**
- Create:
  - `public/vendor/bootstrap/bootstrap.min.css`, `bootstrap.bundle.min.js`, `LICENSE` (copies)
  - `public/img/bmc-button.svg`
  - `tests/e2e/site-headers.spec.js`
- Modify:
  - `public/index.html`: Bootstrap links; widget `<script>` → link in the footer above `<span data-app-version>`
  - `public/game.html`: Bootstrap links
  - `public/css/style.css`: `.bmc-button`
  - `public/js/translations.js`: `buyCoffee`
  - `tests/e2e/landing.spec.js`

**Interfaces:**
- Produces:
  - the `/vendor/bootstrap/...` paths, used by Task 5's 404 page;
  - `tests/e2e/site-headers.spec.js` with its header comment, extended by Task 4.

- [ ] **Step 1: Screenshots before**, a throwaway script in the session scratchpad, never committed.
  - Start the server: `PORT=3200 node server.js` with `GAMES_DIR` set to a scratch folder.
  - With `NODE_PATH=<repo>/node_modules`, a Node script drives `require('@playwright/test').chromium` with the `Pixel 7` and `Desktop Chrome` devices.
  - Pages to capture:
    - the landing page (scrolled to the bottom too);
    - a two-player lobby;
    - a started game;
    - the reveal, leave and restart windows open.
  - Save them as `before-*.png`.

- [ ] **Step 2: Write the failing tests.**
  - First add the `buyCoffee` key en/ru to `translations.js` (Global Constraints), so `text('buyCoffee')` resolves and the test fails on the missing link, not on the key.
  - New `tests/e2e/site-headers.spec.js`, requiring `test, expect, text, createRoom, waitForLanding` from `./helpers`, with a header comment ("The site's own rules: only its own code on its pages, the security headers"):

```js
test('the pages load nothing from other sites', async ({ newPlayer, baseURL }) => {
    const alice = await newPlayer('Alice');
    const origin = new URL(baseURL).origin;
    const foreign = [];
    alice.page.on('request', request => {
        const url = request.url();
        if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) foreign.push(url);
    });

    await createRoom(alice);
    await alice.page.goto('/');
    await waitForLanding(alice.page);
    await alice.page.waitForLoadState('load');

    expect(foreign).toEqual([]);
});
```

In `tests/e2e/landing.spec.js`:

```js
test('the coffee button opens Buy Me a Coffee in a new tab', async ({ newPlayer }) => {
    const { page } = await newPlayer('Alice');
    await page.goto('/');
    const link = page.getByRole('link', { name: text('buyCoffee') });

    await expect(link).toHaveAttribute('href', 'https://www.buymeacoffee.com/mikhail.e');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /\bnoopener\b/);
});
```

- [ ] **Step 3: Run them and watch them fail.**
  - Run: `npx playwright test site-headers.spec.js landing.spec.js -g "other sites|coffee"`
  - Expected:
    - FAIL: `foreign` lists the `cdn.jsdelivr.net` and `cdnjs.buymeacoffee.com` URLs (plus whatever the widget loads);
    - FAIL: no link named `text('buyCoffee')`.

- [ ] **Step 4: Implement.**
  - **Bootstrap files.** Copy them with `cp` and verify the md5s against Global Constraints.
  - **Pages.** In both pages, swap the two jsdelivr tags for the local paths. `index.html` already uses relative paths for its own files; use `/vendor/...` anyway, as the 404 page will.
  - **Widget.** Delete the widget `<script>` and its comment.
  - **Footer link.** Inside `<footer>`, above the version, add:
    ```html
    <a href="https://www.buymeacoffee.com/mikhail.e" target="_blank" rel="noopener noreferrer" class="bmc-button" data-i18n-aria-label="buyCoffee" aria-label="Support the author: buy me a coffee">
    ```
    It holds `<img src="/img/bmc-button.svg" alt="Buy Me a Coffee">`, followed by `<br>` or a block layout so the version stays on its own line.
  - **Image.** `public/img/bmc-button.svg` is wog's SVG with the first `fill="#D4B896"` (the button background) replaced by `#FFDD00`. Check the other fills, and leave the text and cup colours readable on yellow.
  - **Styles.** `.bmc-button` in `style.css`, after wog's (`wog-wwi-solo/app/css/styles.css:2506-2535`). Use plain colours instead of wog's CSS variables. Size the image with a class rule (for example `.bmc-button img { height: 48px; }`), never a `style=`. The hover lift goes only inside `@media (hover: hover) and (pointer: fine)`.

- [ ] **Step 5: Run them and watch them pass.** Same command. Expected: PASS on mobile and desktop.

- [ ] **Step 6: Screenshots after**, same script, saved as `after-*.png`.
  - Compare every pair by reading the images.
  - Fix any visible regression from Bootstrap 5.3 in `style.css`. Typical spots: `.text-muted` colour, `.btn-close`, `.form-control`, alert and modal paddings.
  - Write each fix as a ledger ruling.

- [ ] **Step 7: Mutation, then suite and commit.**
  - Point one page back to jsdelivr and see "other sites" fail. Restore.
  - Run `npm test`: axe must stay green with the new button and Bootstrap 5.3.
  - Commit: `Bootstrap and the coffee button come from the game's own site`.

---

### Task 3: No inline styles or event handlers

**Files:**
- Create: `tests/code-structure.test.js`
- Modify:
  - `public/index.html:100` (`#roomCode` input style)
  - `public/game.html:39` (`#roomCode` span style) and `:92` (`#restartGame` style)
  - `public/js/pwa.js:92-106` (banner `onclick`)
  - `public/css/style.css`

**Interfaces:**
- Produces: the update banner button is a real `<button>` with the label `i18n.getText('updateNow')` and a click listener calling `window.location.reload()`. Task 4 clicks it by role and name.

- [ ] **Step 1: Write the failing test** `tests/code-structure.test.js`.
  - Header comment, from the spec: why `onclick=` / `style=` block a CSP, and that this test reads code text on purpose because the rule is about the text.
  - `const sources` = every `public/*.html` and `public/js/*.js` file as `[name, text]`, read with `fs.readdirSync` filtered by extension, so new files are covered automatically.

```js
test('no inline event handler attributes in the pages or in HTML built by public/js/', () => {
    const found = sources.flatMap(([file, source]) =>
        [...source.matchAll(/<[^>]*\son[a-z]+\s*=/gi)].map(match => `${file}: ${match[0].slice(0, 80)}`));
    expect(found).toEqual([]);
});

test('no inline style attributes in the pages or in HTML built by public/js/', () => {
    const found = sources.flatMap(([file, source]) =>
        [...source.matchAll(/<[^>]*\sstyle\s*=/gi)].map(match => `${file}: ${match[0].slice(0, 80)}`));
    expect(found).toEqual([]);
});
```

- [ ] **Step 2: Run it and watch it fail.**
  - Run: `npx jest tests/code-structure.test.js`
  - Expected: FAIL.
    - Handlers: `pwa.js: <button … onclick=`.
    - Styles: `index.html` (`#roomCode`) and `game.html` (`#roomCode`, `#restartGame`).
  - The regex must not flag `<meta name="theme-color" …>` or the `.style.` property in JS (no `<…` before it on the same tag). If it flags anything else, refine the regex and record a ruling.

- [ ] **Step 3: Implement.**
  - **`index.html` `#roomCode` input.** The styles become a rule in `style.css`. Select it by id within the landing page; `game.html` also has a `#roomCode` (a span), so use `input#roomCode`.
  - **`game.html` `#roomCode` span.** Rule `span#roomCode { font-family: monospace; font-weight: bold; }`.
  - **`#restartGame`.** Rule `#restartGame { display: none; }`, with the comment "game-room.js shows it once the game starts (element.style)".
  - **`pwa.js` banner.**
    - Build the "Update now" button with `document.createElement('button')`: `type="button"`, `className = 'btn btn-warning btn-sm'`, `textContent = updateNowText`, `addEventListener('click', () => window.location.reload())`.
    - The rest of the banner may stay an HTML string without handlers. Append the button into its `.ms-3` slot after `innerHTML`.

- [ ] **Step 4: Run it and watch it pass**, together with the screens that show those elements.
  - Run: `npx jest tests/code-structure.test.js && npx playwright test game.spec.js room.spec.js`
  - Expected: PASS. Restart still appears only after the start; the code badge still looks as before.

- [ ] **Step 5: Mutation, then suite and commit.**
  - Put `style="color: red"` back on one element and see the style test fail. Restore.
  - Put `onclick="x()"` into a string in `pwa.js` and see the handler test fail. Restore.
  - Run `npm test` and expect green.
  - Commit: `Pages and scripts carry no inline styles or event handlers`.

---

### Task 4: Security headers, the guard sees CSP violations

**Files:**
- Modify:
  - `server.js`: `app.disable('x-powered-by')`, the `SECURITY_HEADERS` middleware before `express.static`
  - `tests/e2e/helpers.js`: guard
  - `tests/e2e/site-headers.spec.js`, `tests/e2e/site.spec.js`, `tests/e2e/accessibility.spec.js`

**Interfaces:**
- Consumes: Task 3's banner button (role `button`, name `text('updateNow')`); Task 2's spec file.
- Produces: `const SECURITY_HEADERS = { 'Content-Security-Policy': …, 'Referrer-Policy': …, 'Permissions-Policy': …, 'X-Content-Type-Options': … }` in `server.js`, applied by `app.use((req, res, next) => { res.set(SECURITY_HEADERS); next(); })`.

- [ ] **Step 1: Write the failing tests.**

In `tests/e2e/site-headers.spec.js`:

```js
for (const address of ['/', '/js/game.js', '/vendor/bootstrap/bootstrap.min.css', '/no-such/page', 'a room']) {
    test(`${address} answers with the security headers`, async ({ newPlayer, request }) => {
        let url = address;
        if (address === 'a room') url = `/game/${await createRoom(await newPlayer('Alice'))}`;
        const headers = (await request.get(url)).headers();
        const policy = headers['content-security-policy'] || '';
        for (const rule of ["default-src 'self'", "script-src 'self'", "style-src 'self'", "object-src 'none'", "frame-ancestors 'none'"]) {
            expect(policy).toContain(rule);
        }
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
        expect(headers['permissions-policy']).toContain('camera=()');
        expect(headers['x-powered-by']).toBeUndefined();
    });
}

test('Update now on the update banner reloads the page', async ({ newPlayer }) => {
    const { page } = await newPlayer('Alice');
    await page.goto('/');
    await waitForLanding(page);
    // A release cannot be staged in a test: show the banner the way pwa.js
    // does when a new service worker is ready (a stand-in, like stubShare)
    await page.evaluate(() => { window.beforeReload = true; window.pwaManager.showUpdateAvailable(); });

    await page.getByRole('button', { name: text('updateNow') }).click();

    await expect.poll(() => page.evaluate(() => window.beforeReload)).toBeUndefined();
});
```

In `tests/e2e/site.spec.js`, next to the page-throws guard test:

```js
test('the guard fails a test when a page breaks the Content Security Policy', async ({ newPlayer }) => {
    test.fail(true, 'a style the policy blocks must fail the test');
    const alice = await newPlayer('Alice');

    await alice.page.goto('/');
    await alice.page.evaluate(() => document.body.setAttribute('style', 'outline: 1px solid red'));
    await expect(alice.page.locator('body')).toBeVisible();
});
```

- [ ] **Step 2: Run them and watch them fail.**
  - Run: `npx playwright test site-headers.spec.js site.spec.js`
  - Expected:
    - header tests FAIL (no `content-security-policy`, and `x-powered-by: Express`);
    - the guard test FAILS as "expected to fail, but passed": nothing blocks the style yet.
    - The banner test passes: there is no CSP yet. Its mutation comes in Step 6.

- [ ] **Step 3: Implement.**
  - **`server.js`.**
    - `app.disable('x-powered-by')` right after `const app = express()`.
    - `SECURITY_HEADERS` plus the middleware directly before `app.use(express.static(...))`.
    - A comment over each header, as in wog's `render.yaml`. Over the CSP, the spec's reasons: `data:` for Bootstrap's icons and photo avatars, `blob:` for the photo being processed, `connect-src 'self'` for Socket.IO. Add one line that Render adds `render.yaml` headers only to static sites.
  - **Guard** (the `newPlayer` fixture in `helpers.js`).
    - Right after `browser.newContext(...)`, `await context.addInitScript(...)` adds a `securitypolicyviolation` listener on `document`. It calls `console.error(\`Content Security Policy: ${event.violatedDirective} blocked ${event.blockedURI || 'inline code'}\`)`.
    - Comment: Chromium also logs violations itself; this makes the failure explicit and readable.
  - **`accessibility.spec.js` `violations()`.** Replace `addStyleTag` with a `page.evaluate` that finds the stylesheet whose `href` ends with `/css/style.css` and `insertRule`s the same transition-off rule at its end.
    - Comment: an injected `<style>` is inline code the CSP blocks; a rule added to the page's own stylesheet from a script is allowed.

- [ ] **Step 4: Run them and watch them pass.**
  - Run: `npx playwright test site-headers.spec.js site.spec.js accessibility.spec.js custom-avatar.spec.js`
  - Expected: PASS. `custom-avatar` covers Review Focus 1: the photo at `blob:` and `data:` under CSP.

- [ ] **Step 5: Socket.IO under CSP (Review Focus 5).**
  - Run: `npx playwright test game.spec.js leave-and-return.spec.js`
  - Expected: PASS, no `Content Security Policy:` line in any output.
  - If the WebSocket upgrade were blocked, the guard's listener would fail these tests with a `connect-src` line.

- [ ] **Step 6: Mutations, then suite and commit.**
  - Remove the middleware line → header tests fail. Restore.
  - Put `onclick="window.location.reload()"` back as the banner button attribute, without the listener → the banner test fails (CSP blocks the inline handler, the guard reports it). Restore.
  - Remove the guard's listener → the guard CSP test still fails as expected only if Chromium's own log reaches `console`. Record which it is as a ledger note; the listener stays either way. Restore.
  - Run `npm test` and expect green.
  - Commit: `The server sends the security headers; the tests run under the CSP`.

---

### Task 5: The game's own 404 page

**Files:**
- Create: `public/404.html`, `tests/e2e/not-found.spec.js`
- Modify: `server.js` (catch-all handler after every route, before `startServer`/exports), `public/js/translations.js` (`notFoundTitle`, `notFoundText`, `openGame`)

**Interfaces:**
- Consumes:
  - `/vendor/bootstrap/bootstrap.min.css` (Task 2);
  - `SECURITY_HEADERS` (Task 4): the 404 response carries them automatically.

- [ ] **Step 1: Write the failing tests.**
  - First add the three keys en/ru to `translations.js` (Global Constraints), so `text()` resolves and the tests fail on the page, not on the keys.
  - `tests/e2e/not-found.spec.js`, requiring `test, expect, text, waitForLanding` from `./helpers`. Header comment: any address nobody answers gets `public/404.html` with status 404, at any depth.

```js
test('a missing address answers 404 with a page in the style of the game', async ({ newPlayer, baseURL }) => {
    const { page } = await newPlayer('Alice');
    const origin = new URL(baseURL).origin;
    const failedFiles = [];
    page.on('response', response => {
        if (response.url().startsWith(origin) && response.request().resourceType() !== 'document' && !response.ok()) {
            failedFiles.push(`${response.status()} ${response.url()}`);
        }
    });

    const response = await page.goto('/no-such/page/here');

    expect(response.status()).toBe(404);
    await expect(page.getByRole('heading', { name: text('notFoundTitle') })).toBeVisible();
    await page.waitForLoadState('load');
    expect(failedFiles).toEqual([]);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundImage)).toContain('linear-gradient');

    await page.getByRole('link', { name: text('openGame') }).click();
    await waitForLanding(page);
});

test('the 404 page speaks the player\'s language', async ({ newPlayer }) => {
    const { page } = await newPlayer('Алиса', { locale: 'ru-RU' });
    await page.goto('/no-such-page');
    await expect(page.getByRole('heading', { name: text('notFoundTitle', 'ru') })).toBeVisible();
});

test('an unknown API address answers 404, not a page of the game', async ({ request }) => {
    const response = await request.get('/api/no-such-thing');
    expect(response.status()).toBe(404);
    expect(await response.text()).toContain('data-i18n="notFoundTitle"');
});
```

- [ ] **Step 2: Run them and watch them fail.**
  - Run: `npx playwright test not-found.spec.js`
  - Expected: FAIL. There is no heading: Express answers "Cannot GET".

- [ ] **Step 3: Implement.**
  - **`public/404.html`.**
    - Like wog's `app/404.html`, but in this game's markup.
    - `<html lang="en">`, charset and viewport.
    - `<title data-i18n="notFoundTitle">Page not found</title>`, `<meta name="robots" content="noindex">`, `theme-color` `#16213e`, `/favicon.ico`.
    - Styles: `/vendor/bootstrap/bootstrap.min.css` and `/css/style.css`.
    - A `.container` holding a card in the style of the landing page, with `h1` `data-i18n="notFoundTitle"`, `p` `data-i18n="notFoundText"` and `<a href="/" class="btn btn-primary btn-lg" data-i18n="openGame">`.
    - `<script src="/js/translations.js"></script>` at the end. It fills the texts and adds the language switcher into `.container`.
    - No other scripts, no `style=`; Task 3's test covers it.
    - Comment: shown at any depth, so every link starts at `/`.
  - **`server.js`.** Last middleware: `app.use((req, res) => { res.status(404).sendFile(path.join(__dirname, 'public', '404.html')); });` with the comment "Any address nobody answered: the game's own page, status 404".

- [ ] **Step 4: Run them and watch them pass.**
  - Run: `npx playwright test not-found.spec.js site-headers.spec.js && npx jest tests/code-structure.test.js`
  - Expected: PASS, `/no-such/page` in the header tests included.

- [ ] **Step 5: Mutation, then suite and commit.**
  - Remove the catch-all → the status/heading tests fail. Restore.
  - Run `npm test` and expect green.
  - Commit: `A missing address answers with the game's own 404 page`.

---

### Task 6: Documentation

**Files:**
- Modify:
  - `CLAUDE.md`
  - `docs/testing.md`
  - `README.md` (only if it mentions the CDN or the widget: check with `grep -n -i "cdn\|coffee\|bootstrap" README.md`)

- [ ] **Step 1: CLAUDE.md.**
  - **Architecture tree:**
    - `public/404.html`;
    - `public/vendor/bootstrap/` (Bootstrap 5.3.8, the same files as the owner's other apps; exact version in the files' headers);
    - `public/img/` (images that are not icons: the service worker does not cache them).
  - **"How it works":** one bullet on the security headers (`SECURITY_HEADERS` in server.js, every Express response; not on Socket.IO's own responses) and the 404 catch-all. The `GET /game/:roomCode` text gains "checks the code format first".
  - **New Rule 8:**
    - no `style=` / `on…=` attributes in markup or in HTML built by scripts: classes in `style.css` and `addEventListener`; scripts may set `element.style`;
    - third-party code goes to `public/vendor/`, never a CDN;
    - a new source in the CSP is a deliberate decision with a comment;
    - `tests/code-structure.test.js` checks the first part, the browser tests' guard the rest.
  - **Gotchas:** the CSP list and why `data:` and `blob:`. The coffee button is a link (`.bmc-button`), not the widget. `accessibility.spec.js` turns transitions off with `insertRule`, because an injected `<style>` is blocked. Update the existing reduced-motion gotcha that says axe "scans with CSS transitions switched off".
  - **Decisions:**
    - replace "Tests use the real code: no test reads the source as text…" with: behaviour is tested through the pages and the server's responses, never by searching the code; a rule about how the code is written may be checked by reading the files (`code-structure.test.js`), like the deliberate-copy checks;
    - add "Bootstrap is local, not on a CDN: the CSP allows only the game's own site; the owner's apps share one Bootstrap".

- [ ] **Step 2: docs/testing.md.**
  - Line 34: the same rewritten rule.
  - The guard paragraph: a CSP violation fails the test too.
  - The tests-location table: `code-structure.test.js` (rules of how the code is written).
  - A line on axe transitions via `insertRule`.

- [ ] **Step 3: Check and commit.**
  - Run: `npm test` (docs only, still the gate) and `git diff --stat`.
  - Commit: `Docs: security headers, local Bootstrap, the 404 page, tests that read code`.

---

## After the plan

The final whole-branch review comes next (executing-plans). Then:
- the spec and plan leave the repository in their own commit;
- merge into `develop` after the owner's choice;
- release 1.3.0 (`docs/release.md`), with a push to `master` only after the owner says to deploy;
- `npm run test:e2e:prod`.
