# CLAUDE.md - Web App Development Guide

## Project Overview
**Project Name:** "Who am I?" game
**Type:** Simple web application.
**Main Goal:** Simple web application to play "Who am I?" game remotely with friends and family. The app has adaptive ui and can be played both on desktop and mobile browser.

## My Experience Level
- **Programming:** Limited experience with Python, HTML, JavaScript
- **Web Development:** Beginner
- **Preferred Help Style:** Step-by-step explanations with examples

## Development Setup
- **OS:** macOS
- **Code Editor:** VS Code (primary), Sublime Text
- **Browser:** Chrome (primary), Safari

## What I Need Help With
When I ask for help, I'm usually looking for:

### Coding Help
- **Explain code clearly:** Use simple terms and explain what each part does
- **Show examples:** Provide working code examples I can copy and modify
- **Break down complex tasks:** Split big features into smaller, manageable steps

### Debugging Help
- **Read error messages:** Help me understand what error messages mean
- **Fix bugs step-by-step:** Guide me through finding and fixing problems
- **Test solutions:** Suggest ways to test if fixes work

### Best Practices
- **Clean code:** Help me write code that's easy to read and understand
- **File organization:** Suggest how to organize my files and folders
- **Simple solutions:** Prefer straightforward approaches over complex ones
- **Use unit and integration tests:** Create and update tests to keep things working

## Technologies I'm Using
- **HTML5** - Structure and content
- **CSS3** - Styling and layout with gradients and animations
- **JavaScript (ES6+)** - Interactivity and real-time functionality
- **Bootstrap 5** - Clean UI elements and responsive design
- **Node.js + Express** - Backend server
- **Socket.IO** - Real-time communication between players

## Communication Preferences
- **Explain assumptions:** Don't assume I know advanced concepts
- **Provide context:** Explain why we're doing something, not just how
- **Offer alternatives:** If there are multiple ways to solve something, explain the trade-offs
- **Check understanding:** Ask if I need clarification on complex topics

## Common Tasks I Need Help With
1. **Creating basic HTML structure**
2. **Styling with CSS (layouts, colors, responsive design)**
3. **Adding JavaScript interactivity (buttons, forms, dynamic content)**
4. **Debugging browser console errors**
5. **Making my site work on different screen sizes**
6. **Connecting HTML, CSS, and JavaScript files properly**

## Current Project Status

### ✅ **What's Working:**
- **Complete landing page** with avatar selection and room creation/joining
- **Real-time game rooms** with Socket.IO
- **Room sharing** via 6-character codes and direct links
- **Player management** - join, leave, reconnect functionality with ID-based reconnection
- **Beautiful character assignment** with sticker-like in-place editing
- **Responsive design** that works on desktop and mobile with optimized mobile layout
- **Error handling** for invalid rooms and duplicate names
- **Page refresh functionality** - players can refresh during started games without issues
- **Smart UI adaptations** - elements hide/show based on game state
- **Full localization system** - English and Russian with automatic browser detection
- **Smart button states** - Create/Join buttons adapt based on room code input

### 🎮 **Core Features Implemented:**
1. **Room Creation & Joining:**
   - Create new game → Get 6-character room code (e.g., "ABC123")
   - Join by entering room code OR clicking direct link
   - Share room via `localhost:3000/game/ABC123`

2. **Player System:**
   - Avatar selection (12 emoji options)
   - Real-time player list with avatars
   - ID-based reconnection system (reliable page refresh support)
   - Player count (2-12 players supported)
   - Auto-focus on name input for better UX

3. **Character Assignment:**
   - Click + button on players to assign characters
   - In-place editing with colorful stickers
   - Edit by clicking stickers (only your assignments)
   - Visual feedback and animations

4. **Game Controls:**
   - Start Game button (enabled only when all players have characters)
   - Wider, Bootstrap-styled Start Game button
   - Join Game button (enabled only with valid 6-character room code)
   - Restart functionality with confirmation modal

5. **Responsive Mobile Design:**
   - Mobile-optimized layout for started games
   - Game controls moved to bottom on mobile for better player card visibility
   - Desktop controls remain in header area
   - Seamless experience across all screen sizes

6. **Smart UI State Management:**
   - Room sharing elements hidden during started games
   - Character assignment instructions hidden during gameplay
   - Context-aware element visibility based on game state

7. **Localization System:**
   - Full English and Russian language support
   - Automatic browser language detection
   - One-click language toggle with flags (🇬🇧/🇷🇺)
   - Persistent language preference in localStorage
   - All UI elements, buttons, error messages localized

8. **Smart UX Features:**
   - Character names become read-only when game starts
   - Create/Join buttons intelligently enable/disable based on room code
   - Mobile-optimized avatar selection that fits screen width
   - Helpful tooltips and visual feedback

9. **Reveal Notification System:**
   - Real-time notifications when players reveal their characters
   - Broadcast to all players in the room with player name and character
   - Auto-dismissing messages after 4 seconds (like other notifications)
   - Yellow background marking for revealed players using Bootstrap warning colors
   - Enhanced tooltips showing "(revealed by player)" status
   - Prevention of character editing for revealed players
   - Full bilingual support with placeholder system for dynamic content

10. **Progressive Web App (PWA):**
   - **Web App Manifest**: Complete metadata for app installation (manifest.json)
   - **Service Worker**: Smart caching strategy for static assets (sw.js)
   - **PWA Manager**: Automatic installation prompt handling (pwa.js)
   - **Custom Icons**: 6 SVG icons (48x48 to 512x512) with consistent game branding
   - **Cross-platform Meta Tags**: iOS Safari, Android Chrome, desktop browser support
   - **Install Banner**: User-friendly installation prompt with dismiss option
   - **Offline-ready Static Assets**: CSS, JS, and HTML cached for offline access
   - **Real-time Preservation**: Socket.IO and API requests bypass cache for live gameplay

### 🏗️ **Project Structure:**
```
whoami-game/
├── public/
│   ├── index.html          # Landing page (with PWA meta tags)
│   ├── game.html           # Game room page (with PWA meta tags)
│   ├── manifest.json       # PWA manifest for app installation
│   ├── sw.js              # Service Worker for caching
│   ├── css/style.css       # Custom styles with gradients/animations
│   ├── icons/              # PWA icons (6 SVG files)
│   │   ├── icon-48x48.svg
│   │   ├── icon-72x72.svg
│   │   ├── icon-96x96.svg
│   │   ├── icon-144x144.svg
│   │   ├── icon-192x192.svg
│   │   └── icon-512x512.svg
│   └── js/
│       ├── game.js         # Landing page logic
│       ├── game-room.js    # Game room functionality
│       ├── translations.js # Localization system
│       └── pwa.js         # PWA Manager for installation
├── server.js               # Node.js backend with Socket.IO
├── package.json            # Dependencies
├── tests/                  # Test suites (Jest)
│   ├── game-logic.test.js  # Core game logic tests
│   ├── api.test.js         # API endpoint tests
│   ├── character-update.test.js # Simplified character update system tests
│   ├── character-race-condition.test.js # Race condition prevention tests
│   ├── start-game-button.test.js # Start Game button behavior tests
│   ├── blur-event.test.js  # Character input blur event tests
│   ├── improved-sticker-colors.test.js # Fixed and unique color assignment tests
│   ├── room-recreation.test.js # Room recreation after server restart tests
│   ├── localization.test.js# Localization tests
│   └── i18n-initialization.test.js # i18n bug prevention tests
└── games/                  # Game data storage (future)
```

### 🚀 **How to Run:**
```bash
npm install    # Install dependencies
npm start      # Start server on localhost:3000
npm test       # Run test suite (184 tests)
```

### 🎯 **Recent Major Updates:**
- **Room Recreation System** (Latest):
  - **Server Restart Recovery**: Automatic room recreation when players rejoin after server restarts
  - **LocalStorage Persistence**: Game state, players, characters, and progress automatically backed up
  - **Seamless Reconnection**: Players can refresh/rejoin with original IDs and preserved character assignments
  - **Smart Recovery Logic**: Only recreates rooms for valid 6-character codes with matching player data
  - **Robust Error Handling**: Graceful handling of corrupted or incomplete saved data
  - **Comprehensive Testing**: Added 16 new tests covering all recreation scenarios (184 total tests)

- **Improved Sticker Colors**:
  - **Fixed Color Assignment**: Colors now assigned when players join and never change
  - **Unique Colors**: Guaranteed unique colors for up to 7 players, intelligent cycling for 8+
  - **No Hover Changes**: Removed all CSS hover color effects for consistent appearance
  - **Blur Submission Fix**: Character names properly submit on both Enter key and losing focus
  - **Enhanced Testing**: Added 16 new tests for color system (168 total tests)

- **Critical Bug Fixes**:
  - **Start Game Button Fix**: Button now properly enables when all characters are assigned
  - **Character Race Condition Fix**: Eliminated missed updates when multiple players edit simultaneously
  - **Enhanced Character Editing**: Added blur event submission for better UX (Enter key + click-away)
  - **Robust Synchronization**: Server sends complete character state on every update

- **Simplified Character Update System**: Major architecture redesign for character synchronization
  - **Problem Solved**: Fixed "empty color stickers" bug and character update conflicts
  - **New Approach**: Replaced complex `updateCharacterSticker()` with simple `updatePlayersList()` rebuild
  - **Input Protection**: Added critical safety checks to prevent DOM rebuilds during active editing
  - **Socket.IO Fixes**: Changed from `socket.to()` to `io.to()` for proper real-time broadcasting
  - **Cleaner Code**: Removed 200+ lines of complex edit state preservation logic
  - **Player ID Handling**: Fixed undefined player ID issues in API requests
  - **Production Deployment**: Successfully deployed with full git workflow (develop → master)

- **PWA Implementation**: Complete Progressive Web App support with installable functionality
- **Reveal Notification System**: Real-time notifications and yellow highlighting for revealed players
- **Full Localization System**: Complete English/Russian support with browser auto-detection
- **Mobile UI Fixes**: Avatar selection properly fits screen width on all devices
- **Smart Button Logic**: Create/Join buttons intelligently adapt based on room code input
- **UX Improvements**: Read-only character names during games, better tooltips, flag-based language toggle

### 🎯 **Next Big Goal: Custom Avatars**
**Priority:** High - Fix critical bugs


### 🎯 **Future Goals:**
- "Share" button for link to the room
- Make the gray sticker (mystery) lighter.
- How to avoid two players editing the same character at the same time?
- Avatars rotation

## Notes for Claude
- I learn best with hands-on examples
- Please explain technical terms when you use them
- I prefer to understand the "why" behind solutions
- Break complex tasks into small, clear steps
- Always show me where to put new code in my existing files
- Update tests each time the logic is changed