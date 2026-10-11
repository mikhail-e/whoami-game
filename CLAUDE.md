# CLAUDE.md - "Who am I?" Game

## Project Overview
Web application to play the "Who am I?" guessing game remotely with friends and family. Players join a room by a 6-character code, assign secret characters to each other, then guess who they are. Adaptive UI works on desktop and mobile browsers; installable as a PWA.

- **Production:** https://whoami-game.onrender.com/ (Render.com, free plan)
- **Stack:** Node.js + Express + Socket.IO backend; vanilla JavaScript (ES6+) + Bootstrap 5 frontend; Jest for tests. No build step, no frontend framework.

## About Me (project owner)
- Beginner web developer; limited experience with Python, HTML, JavaScript
- Explain code in simple terms and explain technical terms when you use them
- Break complex tasks into small, clear steps; explain the "why" behind solutions
- Show me where to put new code in my existing files
- Prefer simple, straightforward solutions over complex ones
- If there are multiple ways to solve something, explain the trade-offs
- Setup: macOS, VS Code, Chrome

## Commands
```bash
npm install                        # Install dependencies
npm start                          # Start server on http://localhost:3000
npm test                           # All checks: ESLint, Jest, then Playwright — run before every merge
npm run lint                       # ESLint only (any warning fails); npm run lint:fix fixes what it can
npx jest tests/game-logic.test.js  # Run a single Jest file
npm run test:e2e                   # Browser tests only (Playwright); :headed and :ui variants
npm run test:e2e:prod              # Browser tests against production (after a release)
npx playwright install chromium    # Once per machine: the browser for the tests
```

## Architecture
```
server.js                  # Express + Socket.IO wiring: HTTP API, socket events, disk persistence, keep-alive.
                           # Listens only when run as `node server.js`; exports `app` for tests
game-logic.js              # Pure game logic + input validation + connection tracker — no Express/Socket.IO, unit-testable
public/
├── index.html             # Landing page (create/join room, name + avatar selection)
├── game.html              # Game room page
├── manifest.json          # PWA manifest
├── sw.js                  # Service worker: caches icons only; everything else goes straight to the network
├── favicon.ico, icons/    # Branding (SVG icons, 48x48–512x512)
├── css/style.css          # Custom styles (gradients, sticker colors, responsive layout)
└── js/
    ├── utils.js           # SHARED code: debugLog, notifications, AppStorage, player ID, validation, app version — reusable code goes HERE
    ├── game.js            # Landing page logic (avatar pool + refresh, create/join buttons)
    ├── game-room.js       # Game room logic (player list, character stickers, socket handlers)
    ├── translations.js    # i18n (en/ru): browser auto-detection, localStorage preference, {placeholder} support
    └── pwa.js             # PWA manager: service worker registration, update detection every 30s
tests/                     # Jest: game logic, HTTP routes (supertest on the real app), checks of deliberate copies
└── e2e/                   # Playwright: the game in Chromium (phone + desktop), several players per room; helpers.js
playwright.config.js       # Browser tests: own server on port 3100, projects mobile + desktop, BASE_URL for production
docs/testing.md            # How the tests are organized and written (helpers, rules of the suite, debugging)
docs/release.md            # Git flow, versions, release and hotfix steps, the check of production
README.md                  # What the game is, how to run it
eslint.config.mjs          # ESLint: one block per environment (server, pages, service worker, tests)
.vscode/                   # Shared VS Code settings: ESLint fixes on save, the ESLint extension recommended
render.yaml                # Render.com deploy config (auto-deploys master branch)
games/                     # Runtime game state backups (*.json, gitignored)
```

### How it works
- Games live in an in-memory `Map` in server.js, keyed by 6-character room code (e.g. `ABC123`)
- **HTTP API:** `POST /api/create-game`, `POST /api/join-game`, `POST /api/recreate-game`; `GET /api/version` (the version from package.json, shown in the footer of both pages by `showAppVersion()` in utils.js); `GET /game/:roomCode` serves game.html (restoring from disk if needed) or redirects to `/?error=room-not-found`
- **Socket.IO events:** `join-room`, `assign-character`, `start-game`, `reveal-character`, `restart-game`, `leave-game`; server broadcasts with `io.to(room)` (includes the sender — intentional, don't switch to `socket.to()`). Every handler is wrapped in `safeHandler()` so a malformed payload can never crash the process
- **Leaving:** `leave-game` is accepted only from the socket registered to that player (no kicking others). `removePlayerFromGame` drops the player, their character and reveal status; the last player leaving deletes the game and its disk backup (`deleteGameBackup`, so the old link cannot bring it back). The `player-left` broadcast carries the full state; the leaver redirects to `/?join=CODE` (prefilled rejoin) and the landing page remembers the last used name and avatar (`whoami-player-name` / `whoami-player-avatar` in localStorage, saved on create/join; the saved avatar is placed first in the grid so it gets auto-selected, and is ignored if it's neither in `avatarPool` nor a valid custom data URL)
- **Returning to a started game:** leaving a started round snapshots the player into `game.recentlyLeft` (character, reveal status, sticker color, join time). Joining with the same `playerId` restores everything and consumes the snapshot; strangers are still rejected with "Game has already started". Restart clears the snapshots. The `player-joined`/`player-reconnected` broadcasts carry `characters`/`revealedPlayers` so other clients see the restored character reappear
- **Player list order:** `game.players` is kept in first-join order (`sortPlayersByJoinTime` sorts by `joinedAt` after every add), identical on every client — no client-side sorting. A player returning to a started round gets their old position back (the snapshot carries `joinedAt`); lobby rejoins go to the end
- **Persistence:** every 5 minutes active games are saved to `games/*.json` (`GAMES_DIR` moves the folder; the browser tests use a temporary one); visiting a room URL after a server restart restores the game from disk. Files older than 4 hours are cleaned up, and games idle for 4+ hours with nobody connected are dropped from memory (`cleanupInactiveGames`). Clients also back up state to localStorage and can recreate a lost room via `POST /api/recreate-game`
- **Player identity:** one UUID per browser stored in `localStorage.playerId` (created in utils.js as `PLAYER_ID`). Reconnection matches by ID only, never by name — duplicate player names in one room are supported. A stored ID that is not a valid UUID is regenerated on load (`PLAYER_ID_PATTERN` in utils.js): the server silently replaces non-UUID IDs, which would otherwise duplicate the player on every page load
- **Timeout protection:** extended Socket.IO timeouts (2-min ping timeout, 30s ping interval); disconnected players are marked `isConnected: false` rather than removed, so they can reconnect. Players disconnected for 10+ minutes ("ghosts" — usually the same person returning under a new playerId) are removed by the keep-alive cycle (`removeStaleDisconnectedPlayers` in game-logic.js) and broadcast as a regular `player-left`; in a started game the `recentlyLeft` snapshot still lets the same ID return. A room emptied this way keeps its disk backup (unlike one its last player left): when every phone of a group slept through a break, the room link brings it back
- **Connection tracking:** `createConnectionTracker()` in game-logic.js maps sockets to players. On page refresh the new socket often connects *before* the old one disconnects, so every disconnect is checked against the player's current socket and stale ones are ignored

## Rules (important!)
1. **Bump the icon cache version in `CACHE_NAME`** (public/sw.js, e.g. `whoami-game-v1.5.0` → `v1.5.1`) **when you change the icons**. Only icons are cached, so HTML/CSS/JS changes reach players without it. This is not the app version — that one is in package.json (`docs/release.md`)
2. **No code duplication across files** — shared frontend code goes to `public/js/utils.js`
3. **Update tests whenever logic changes**: a game rule → Jest with `game-logic.js`; what the player sees or does → a browser test in `tests/e2e/` (`docs/testing.md`). Run `npm test` before committing
4. **Localize all UI text** — every user-facing string needs both `en` and `ru` entries in `public/js/translations.js`. `tests/translations-real.test.js` fails if a key exists in only one language. Static markup supports `data-i18n` (text), `data-i18n-placeholder`, `data-i18n-title` and `data-i18n-aria-label` (for icon-only buttons)
5. **Never build DOM from user data with `innerHTML`** — player names and characters go through `textContent` (see `createAlertElement()` in utils.js and `updatePlayersList()` in game-room.js)
6. **Debug output goes through `debugLog()`** (utils.js), never `console.log` in `public/js` (ESLint fails on it). It prints only after `localStorage.setItem('whoami-debug', 'on')` and a reload. `console.warn`/`console.error` are for real problems. The server keeps `console.log`: that is what Render's log shows
7. **The pages share names through plain `<script>` files** — a top-level name in utils.js or translations.js is visible to the scripts loaded after it. ESLint checks each file on its own, so a file lists what it takes from the others in `/* global ... */` and what it gives in `/* exported ... */`

## Gotchas
- **Sticker colors are picked by the server** (`stickerColors` in game-logic.js); the browser only renders `player.stickerColor` as the `color-<name>` class, so every color needs a `.character-sticker.color-<name>` rule in style.css (`tests/improved-sticker-colors.test.js` checks). The avatar pool lives **only** in `public/js/game.js`; the server does not need it
- `game-logic.js` must stay free of Express/Socket.IO imports so it remains unit-testable
- Validate on the server, not just in the UI: `sanitizePlayerName` / `sanitizeAvatar` / `sanitizeCharacter` enforce the input limits, and `assignCharacter` refuses to change characters once `state !== 'waiting'` (a late `blur` event can arrive after Start Game)
- **Input limits (128 chars for names and characters) exist twice** — `game-logic.js` for the server and `public/js/utils.js` for the browser (a browser script cannot `require()` a Node module). `tests/input-limits.test.js` fails if they drift apart. Lengths are counted by character, not UTF-16 code unit, so an emoji counts as one and is never cut in half
- **Custom avatar (uploaded photo) validation also exists twice** — `isCustomAvatar()` + `MAX_CUSTOM_AVATAR_LENGTH` + `CUSTOM_AVATAR_PATTERN` are mirrored in `game-logic.js` and `public/js/utils.js`; `tests/input-limits.test.js` keeps them in sync. The photo is shrunk in the browser (game.js `processAvatarFile`) to a small square JPEG data URL (`CUSTOM_AVATAR_SIZE`) and stored in the same `player.avatar` field the emoji uses, so all persistence flows carry it for free. The anchored pattern only allows `data:image/(png|jpeg|webp);base64,...` — never loosen it (XSS), and only render it via `img.src` behind the `isCustomAvatar()` guard. JSON API routes use `express.json({ limit: '1mb' })` because recreate-game carries every player's avatar at once
- `game-room.js` rebuilds the whole players list (`updatePlayersList()`) on updates instead of patching individual stickers — per-sticker DOM patching caused sync bugs, don't reintroduce it. Rebuilds are **skipped while a character input is open**, so anything that ends editing (game start, socket error) must call `cancelActiveEdits()` first or the UI freezes
- Dynamic text rendered from JS (game status, player cards) does not react to `data-i18n`. `setLanguage()` fires a `languagechanged` event; game-room.js listens and re-renders. Prefer static markup for controls (like `#shuffleAvatars`) so `data-i18n*` and keyboard focus just work
- The avatar selector sits inside `<form id="playerForm">`, which has a submit button. **Any `<button>` added there needs `type="button"`** or clicking it joins a game
- Mobile virtual keyboard: call `input.focus()` synchronously inside the click handler (no `setTimeout`) — otherwise iOS/Android won't open the keyboard
- Character assignment: players cannot assign a character to themselves; submitting empty/whitespace text removes the assignment (sticker returns to the "+" state). Escape restores the original character
- Sticker colors are assigned once when a player joins and never change; unique for up to 7 players, then cycled. Exception: your own hidden character renders as `.character-sticker.mystery` (light dashed style, 🎭 glyph, deliberately NO player color) until revealed
- **Share button** (`#shareButton` in game.html): `navigator.share` must be called with no `await` before it in the click handler (iOS rejects otherwise); `AbortError` (user closed the share sheet) is intentionally silent; unsupported browsers fall back to `copyRoomLink()`. Tests use `stubShare()` (`tests/e2e/helpers.js`) — a real click opens the OS share sheet, which blocks automation
- Button feedback flashes ("✅ Copied!") set `textContent`, which flattens the inner `data-i18n` span — after the first flash that button's label stops reacting to language switches until reload (long-standing quirk of Copy Link, shared by Share via `copyRoomLink()`)
- **PWA link capturing is a platform matter, not a bug.** iOS cannot open links in an installed web app at all (Apple limitation — links always open the browser/webview; no web-side fix exists). Android (installed via Chrome) captures in-scope links because `scope: "/"` covers `/game/*`; messenger in-app browsers bypass this. `launch_handler: navigate-existing` in manifest.json makes a captured link reuse the open app window (Android/desktop). `tests/manifest.test.js` guards these fields
- **The service worker caches icons and nothing else.** The game requires a live server (a room lives in server memory), so offline support is pointless, and caching HTML/JS only ever produced "player stuck on an old version" bugs. The worker exists for installability plus free icon caching. `tests/service-worker.test.js` fails if HTML/CSS/JS is added back to the cache. Icon matching is by **exact pathname** — an earlier substring check matched every URL because `'/'` was in the list. **Any change to sw.js, even a comment, is a new worker**: browsers install it and pwa.js shows every open page the "Update available — Reload" banner, so edit sw.js only for a real reason

## Git Workflow (git flow)
Steps and commands: `docs/release.md`.
- `master` — production. **Every push to `master` deploys** to Render. Never commit to it directly
- `develop` — integration branch. Never commit to it directly
- **All changes go in feature branches**: `feature/<short-name>` from `develop`, finished with a local `git merge --no-ff` into `develop` (no Pull Requests), then the branch is deleted
- Before every merge: `npm test` must pass
- **Release**: `release/<x.y.z>` from `develop` → bump the version (`npm version minor --no-git-tag-version`) → merge `--no-ff` into `master`, tag `v<x.y.z>`, merge back into `develop` → push `master`, `develop` and tags. **Push to `master` only after the owner confirms** (it deploys production), then check production (`docs/release.md`)
- **Hotfix**: `hotfix/<x.y.z>` from `master` → a test that fails on the old code, the fix, a patch bump → merge `--no-ff` into `master` (tag) and `develop`
- A deploy restarts the server, and rooms live in its memory: a game in progress may be interrupted. Free Render plan also hibernates on inactivity — the keep-alive loop and disk persistence exist to survive restarts

## Decisions (why it is so)
The owner's decisions, with the reason.
- **No CI**: `npm test` on the developer's machine is the only check before code reaches `develop` and production
- **The version is written only in package.json**: the server reads it (`/api/version`), the pages ask the server — no copy to keep in sync
- **Online only, no offline mode**: a room lives in server memory (see the service worker gotcha above)
- **Browser tests in Chromium only** — a phone (Pixel 7) and a desktop, like the owner's other apps; WebKit (Safari) is not covered
- **Tests use the real code**: no test reads the source as text or keeps its own copy of the game's code (the exceptions are the deliberate copies listed in the gotchas). Tests act like players: through pages and buttons, never through server memory, so the same suite runs against production
- **Docs hold principles, not history**: CLAUDE.md, `docs/` and the skills say how things work and why; no development history, dates or measured numbers (sizes, counts, timings) — those live in the code and in git. A design spec or plan of a feature leaves the repository once the feature is merged; what stays true goes here

## Ideas for later
- Concurrent editing protection (two players editing the same character simultaneously)
- Rooms persistence, custom game rules, spectator mode
- `copyRoomLink()` (used by Copy Link and the Share fallback) still uses the deprecated `document.execCommand('copy')` — migrate to the async Clipboard API
