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
npm test                           # Run all tests (Jest: 335 tests, 23 suites)
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
├── sw.js                  # Service worker: caches icons only; everything else goes straight to the network
├── favicon.ico, icons/    # Branding (6 SVG icons, 48x48–512x512)
├── css/style.css          # Custom styles (gradients, sticker colors, responsive layout)
└── js/
    ├── utils.js           # SHARED code: notifications, Storage helpers, player ID, validation — reusable code goes HERE
    ├── game.js            # Landing page logic (avatar pool + refresh, create/join buttons)
    ├── game-room.js       # Game room logic (player list, character stickers, socket handlers)
    ├── translations.js    # i18n (en/ru): browser auto-detection, localStorage preference, {placeholder} support
    └── pwa.js             # PWA manager: service worker registration, update detection every 30s
tests/                     # 23 Jest suites: game logic, API (supertest), race conditions, i18n, timeouts, room recreation,
                           # input validation, connection tracker (refresh race), inactive-game cleanup, leave-game,
                           # service-worker policy, avatar shuffle, input limits, share button, mystery sticker
render.yaml                # Render.com deploy config (auto-deploys master branch)
games/                     # Runtime game state backups (*.json, gitignored)
```

### How it works
- Games live in an in-memory `Map` in server.js, keyed by 6-character room code (e.g. `ABC123`)
- **HTTP API:** `POST /api/create-game`, `POST /api/join-game`, `POST /api/recreate-game`; `GET /game/:roomCode` serves game.html (restoring from disk if needed) or redirects to `/?error=room-not-found`
- **Socket.IO events:** `join-room`, `assign-character`, `start-game`, `reveal-character`, `restart-game`, `leave-game`; server broadcasts with `io.to(room)` (includes the sender — intentional, don't switch to `socket.to()`). Every handler is wrapped in `safeHandler()` so a malformed payload can never crash the process
- **Leaving:** `leave-game` is accepted only from the socket registered to that player (no kicking others). `removePlayerFromGame` drops the player, their character and reveal status; the last player leaving deletes the game. The `player-left` broadcast carries the full state; the leaver redirects to `/?join=CODE` (prefilled rejoin) and the landing page remembers the last used name (`whoami-player-name` in localStorage)
- **Returning to a started game:** leaving a started round snapshots the player into `game.recentlyLeft` (character, reveal status, sticker color). Joining with the same `playerId` restores everything and consumes the snapshot; strangers are still rejected with "Game has already started". Restart clears the snapshots. The `player-joined`/`player-reconnected` broadcasts carry `characters`/`revealedPlayers` so other clients see the restored character reappear
- **Persistence:** every 5 minutes active games are saved to `games/*.json`; visiting a room URL after a server restart restores the game from disk. Files older than 4 hours are cleaned up, and games idle for 4+ hours with nobody connected are dropped from memory (`cleanupInactiveGames`). Clients also back up state to localStorage and can recreate a lost room via `POST /api/recreate-game`
- **Player identity:** one UUID per browser stored in `localStorage.playerId` (created in utils.js as `PLAYER_ID`). Reconnection matches by ID only, never by name — duplicate player names in one room are supported
- **Timeout protection:** extended Socket.IO timeouts (2-min ping timeout, 30s ping interval); disconnected players are marked `isConnected: false` rather than removed, so they can reconnect
- **Connection tracking:** `createConnectionTracker()` in game-logic.js maps sockets to players. On page refresh the new socket often connects *before* the old one disconnects, so every disconnect is checked against the player's current socket and stale ones are ignored

## Rules (important!)
1. **Bump the cache version in `CACHE_NAME`** (public/sw.js: `whoami-game-v1.5.0` → `v1.5.1`) **when you change the icons**. Since v1.5.0 only icons are cached, so HTML/CSS/JS changes reach players immediately and no longer need a version bump
2. **No code duplication across files** — shared frontend code goes to `public/js/utils.js`
3. **Update tests whenever logic changes**; run `npm test` before committing
4. **Localize all UI text** — every user-facing string needs both `en` and `ru` entries in `public/js/translations.js`. `tests/translations-real.test.js` fails if a key exists in only one language. Static markup supports `data-i18n` (text), `data-i18n-placeholder`, `data-i18n-title` and `data-i18n-aria-label` (for icon-only buttons)
5. **Never build DOM from user data with `innerHTML`** — player names and characters go through `textContent` (see `createAlertElement()` in utils.js and `updatePlayersList()` in game-room.js)

## Gotchas
- `stickerColors` is duplicated in `game-logic.js` and `public/js/game-room.js` — keep the two lists in sync. (The avatar pool lives **only** in `public/js/game.js`; the server does not need it.)
- `game-logic.js` must stay free of Express/Socket.IO imports so it remains unit-testable
- Validate on the server, not just in the UI: `sanitizePlayerName` / `sanitizeAvatar` / `sanitizeCharacter` enforce the input limits, and `assignCharacter` refuses to change characters once `state !== 'waiting'` (a late `blur` event can arrive after Start Game)
- **Input limits (128 chars for names and characters) exist twice** — `game-logic.js` for the server and `public/js/utils.js` for the browser (a browser script cannot `require()` a Node module). `tests/input-limits.test.js` fails if they drift apart. Lengths are counted by character, not UTF-16 code unit, so an emoji counts as one and is never cut in half
- `game-room.js` rebuilds the whole players list (`updatePlayersList()`) on updates instead of patching individual stickers — per-sticker DOM patching caused sync bugs, don't reintroduce it. Rebuilds are **skipped while a character input is open**, so anything that ends editing (game start, socket error) must call `cancelActiveEdits()` first or the UI freezes
- Dynamic text rendered from JS (game status, player cards) does not react to `data-i18n`. `setLanguage()` fires a `languagechanged` event; game-room.js listens and re-renders. Prefer static markup for controls (like `#shuffleAvatars`) so `data-i18n*` and keyboard focus just work
- The avatar selector sits inside `<form id="playerForm">`, which has a submit button. **Any `<button>` added there needs `type="button"`** or clicking it joins a game
- Mobile virtual keyboard: call `input.focus()` synchronously inside the click handler (no `setTimeout`) — otherwise iOS/Android won't open the keyboard
- Character assignment: players cannot assign a character to themselves; submitting empty/whitespace text removes the assignment (sticker returns to the "+" state). Escape restores the original character
- Sticker colors are assigned once when a player joins and never change; unique for up to 7 players, then cycled. Exception: your own hidden character renders as `.character-sticker.mystery` (light dashed style, 🎭 glyph, deliberately NO player color) until revealed
- **Share button** (`#shareButton` in game.html): `navigator.share` must be called with no `await` before it in the click handler (iOS rejects otherwise); `AbortError` (user closed the share sheet) is intentionally silent; unsupported browsers fall back to `copyRoomLink()`. Test with a stubbed `navigator.share` — a real click opens the OS share sheet, which blocks automation
- Button feedback flashes ("✅ Copied!") set `textContent`, which flattens the inner `data-i18n` span — after the first flash that button's label stops reacting to language switches until reload (long-standing quirk of Copy Link, shared by Share via `copyRoomLink()`)
- **The service worker caches icons and nothing else.** The game requires a live server (a room lives in server memory), so offline support is pointless, and caching HTML/JS only ever produced "player stuck on an old version" bugs. The worker exists for installability plus free icon caching. `tests/service-worker.test.js` fails if HTML/CSS/JS is added back to the cache. Icon matching is by **exact pathname** — an earlier substring check matched every URL because `'/'` was in the list

## Deployment
- Workflow: work on `develop` → merge to `master` → push; Render auto-deploys `master` (render.yaml)
- Free Render plan hibernates on inactivity — the keep-alive loop and disk persistence exist to survive restarts

## Current Status
All core features work: room creation/joining/sharing, Share button (Web Share API with copy fallback), 60-emoji avatar pool with refresh, character assignment with colored stickers, reveal notifications, full en/ru localization, PWA install (online-only, no offline mode by design), reconnection and timeout protection, duplicate player names, room recreation after server restarts.

### Future goals
- Concurrent editing protection (two players editing the same character simultaneously)
- Rooms persistence, custom game rules, spectator mode
- `copyRoomLink()` (used by Copy Link and the Share fallback) still uses the deprecated `document.execCommand('copy')` — migrate to the async Clipboard API
