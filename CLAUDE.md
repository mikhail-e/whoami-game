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
npm test                           # Run all tests (Jest: 265 tests, 17 suites)
npx jest tests/game-logic.test.js  # Run a single test file
npm run test:watch                 # Watch mode
```

## Architecture
```
server.js                  # Express + Socket.IO wiring: HTTP API, socket events, disk persistence, keep-alive
game-logic.js              # Pure game logic + input validation + connection tracker — no Express/Socket.IO, unit-testable
public/
├── index.html             # Landing page (create/join room, name + avatar selection)
├── game.html              # Game room page
├── manifest.json          # PWA manifest
├── sw.js                  # Service worker: network-first for JS/CSS, cache-first for static assets
├── favicon.ico, icons/    # Branding (6 SVG icons, 48x48–512x512)
├── css/style.css          # Custom styles (gradients, sticker colors, responsive layout)
└── js/
    ├── utils.js           # SHARED code: notifications, Storage helpers, player ID, validation — reusable code goes HERE
    ├── game.js            # Landing page logic (avatar pool + refresh, create/join buttons)
    ├── game-room.js       # Game room logic (player list, character stickers, socket handlers)
    ├── translations.js    # i18n (en/ru): browser auto-detection, localStorage preference, {placeholder} support
    └── pwa.js             # PWA manager: service worker registration, update detection every 30s
tests/                     # 17 Jest suites: game logic, API (supertest), race conditions, i18n, timeouts, room recreation,
                           # input validation, connection tracker (refresh race), inactive-game cleanup
render.yaml                # Render.com deploy config (auto-deploys master branch)
games/                     # Runtime game state backups (*.json, gitignored)
```

### How it works
- Games live in an in-memory `Map` in server.js, keyed by 6-character room code (e.g. `ABC123`)
- **HTTP API:** `POST /api/create-game`, `POST /api/join-game`, `POST /api/recreate-game`; `GET /game/:roomCode` serves game.html (restoring from disk if needed) or redirects to `/?error=room-not-found`
- **Socket.IO events:** `join-room`, `assign-character`, `start-game`, `reveal-character`, `restart-game`; server broadcasts with `io.to(room)` (includes the sender — intentional, don't switch to `socket.to()`). Every handler is wrapped in `safeHandler()` so a malformed payload can never crash the process
- **Persistence:** every 5 minutes active games are saved to `games/*.json`; visiting a room URL after a server restart restores the game from disk. Files older than 4 hours are cleaned up, and games idle for 4+ hours with nobody connected are dropped from memory (`cleanupInactiveGames`). Clients also back up state to localStorage and can recreate a lost room via `POST /api/recreate-game`
- **Player identity:** one UUID per browser stored in `localStorage.playerId` (created in utils.js as `PLAYER_ID`). Reconnection matches by ID only, never by name — duplicate player names in one room are supported
- **Timeout protection:** extended Socket.IO timeouts (2-min ping timeout, 30s ping interval); disconnected players are marked `isConnected: false` rather than removed, so they can reconnect
- **Connection tracking:** `createConnectionTracker()` in game-logic.js maps sockets to players. On page refresh the new socket often connects *before* the old one disconnects, so every disconnect is checked against the player's current socket and stale ones are ignored

## Rules (important!)
1. **Bump the cache version in `CACHE_NAME`** (public/sw.js, line 4: `whoami-game-v1.4.0` → `v1.4.1`) **before every commit** — otherwise players keep the old cached files
2. **No code duplication across files** — shared frontend code goes to `public/js/utils.js`
3. **Update tests whenever logic changes**; run `npm test` before committing
4. **Localize all UI text** — every user-facing string needs both `en` and `ru` entries in `public/js/translations.js`. `tests/translations-real.test.js` fails if a key exists in only one language
5. **Never build DOM from user data with `innerHTML`** — player names and characters go through `textContent` (see `createAlertElement()` in utils.js and `updatePlayersList()` in game-room.js)

## Gotchas
- `stickerColors` is duplicated in `game-logic.js` and `public/js/game-room.js` — keep the two lists in sync. (The avatar pool lives **only** in `public/js/game.js`; the server does not need it.)
- `game-logic.js` must stay free of Express/Socket.IO imports so it remains unit-testable
- Validate on the server, not just in the UI: `sanitizePlayerName` / `sanitizeAvatar` / `sanitizeCharacter` enforce the same limits as the inputs' `maxlength`, and `assignCharacter` refuses to change characters once `state !== 'waiting'` (a late `blur` event can arrive after Start Game)
- `game-room.js` rebuilds the whole players list (`updatePlayersList()`) on updates instead of patching individual stickers — per-sticker DOM patching caused sync bugs, don't reintroduce it. Rebuilds are **skipped while a character input is open**, so anything that ends editing (game start, socket error) must call `cancelActiveEdits()` first or the UI freezes
- Dynamic text rendered from JS (game status, player cards) does not react to `data-i18n`. `setLanguage()` fires a `languagechanged` event; game-room.js listens and re-renders
- Mobile virtual keyboard: call `input.focus()` synchronously inside the click handler (no `setTimeout`) — otherwise iOS/Android won't open the keyboard
- Character assignment: players cannot assign a character to themselves; submitting empty/whitespace text removes the assignment (sticker returns to the "+" state). Escape restores the original character
- Sticker colors are assigned once when a player joins and never change; unique for up to 7 players, then cycled
- Service worker asset matching is by **exact pathname** (`isStaticAsset` / `isDynamicAsset`). A substring check silently matched every URL because `'/'` is in the static list

## Deployment
- Workflow: work on `develop` → merge to `master` → push; Render auto-deploys `master` (render.yaml)
- Free Render plan hibernates on inactivity — the keep-alive loop and disk persistence exist to survive restarts

## Current Status
All core features work: room creation/joining/sharing, 60-emoji avatar pool with refresh, character assignment with colored stickers, reveal notifications, full en/ru localization, PWA install + offline caching, reconnection and timeout protection, duplicate player names, room recreation after server restarts.

### Future goals
- Share button for direct room link sharing
- Lighter mystery sticker color for better visibility
- Concurrent editing protection (two players editing the same character simultaneously)
- Rooms persistence, custom game rules, spectator mode
- `copyLink` still uses the deprecated `document.execCommand('copy')` — migrate to the async Clipboard API
