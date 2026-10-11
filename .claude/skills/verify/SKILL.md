---
name: verify
description: How to run and drive the "Who am I?" game app for end-to-end verification of frontend/backend changes.
---

# Verifying changes in the "Who am I?" game

## Launch

```bash
PORT=3000 npm start   # background it; server is ready ~instantly
```

No build step. Stop with `pkill -f "node server.js"`.

## Drive (Playwright MCP)

1. Navigate to `http://localhost:3000/` — landing page, Russian by default.
2. Name field is usually prefilled from localStorage; click «Создать новую игру» → redirects to `/game/XXXXXX`.
3. To join as a second player, open a second tab with the room URL (each tab shares the same `localStorage.playerId`, so use a separate browser context for a truly distinct player).
4. Language toggle: call `i18n.setLanguage('en'|'ru')` via evaluate, or click the flag button on the landing page.

## Gotchas

- Playwright screenshots/snapshots land in the repo CWD (`./*.png`, `.playwright-mcp/`) — move them out and delete `.playwright-mcp/` before finishing.
- `navigator.share` exists in Playwright's Chromium; a real click on the Share button opens the macOS share sheet, which blocks automation. Stub it via evaluate (`Object.defineProperty(navigator, 'share', {configurable: true, writable: true, value: ...})`) and drive the button with `btn.click()` inside evaluate.
- Button-feedback flashes («✅ Скопировано!») revert after 2s — read `textContent` within ~100ms of the click inside a single evaluate call, not in a separate round trip.
- After any button flash, `textContent = originalText` flattens the `data-i18n` span, so language switching stops updating that button until reload. Reload before testing i18n labels.
- Games live in server memory; restarting the server invalidates room URLs unless restored from `games/*.json` (5-min persistence cadence).
