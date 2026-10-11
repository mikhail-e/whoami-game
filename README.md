# Who am I?

The classic guessing party game, played remotely. Every player gets a secret character chosen by the others and asks yes/no questions to find out who they are. Create a room, send the link to friends and family, play — no accounts, nothing to install.

**Play:** https://whoami-game.onrender.com/

## Features

- Rooms with a 6-character code and a link to share (the Share button opens the phone's share sheet)
- Players assign characters to each other; your own stays hidden until you reveal it
- Emoji avatars or your own photo
- English and Russian
- Reconnects after a lost connection
- Installable as an app (PWA); needs an internet connection

## How to Run

Needs Node.js 18 or newer.

```bash
npm install
npm start          # http://localhost:3000
```

## Development

```bash
npm test           # all tests (Jest)
```

- `CLAUDE.md` — architecture, rules, git flow
- `docs/release.md` — releases, hotfixes and the check of production

## Technologies

- Server: Node.js, Express, Socket.IO
- Browser: plain JavaScript and Bootstrap 5 — no framework, no build step
- Tests: Jest, supertest
- Hosting: Render

## Credits

Developed with [Claude Code](https://claude.ai/claude-code).
