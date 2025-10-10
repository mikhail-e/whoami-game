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
- **Prevent code duplication:** Never copy-paste the same code in different files. Always keep code in utils.js

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

### Production environment
- **Production URL** https://whoami-game.onrender.com/
- **Publishing service** Render.com

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
   - **Hybrid Service Worker**: Network-first for game logic, cache-first for static assets (sw.js v1.3.1)
   - **PWA Manager**: Smart update detection and browser extension compatibility (pwa.js)
   - **Custom Icons**: 6 SVG icons (48x48 to 512x512) with consistent game branding
   - **Custom Favicon**: Professional .ico favicon for browser tab recognition
   - **Cross-platform Meta Tags**: iOS Safari, Android Chrome, desktop browser support
   - **Clean Installation**: No intrusive banners - users can install via browser menu
   - **Smart Caching**: Immediate updates for game logic, fast loading for static assets
   - **Browser Extension Compatible**: Works with ad blockers, password managers, dev tools
   - **Auto-Update System**: Detects updates every 30 seconds with user-friendly notifications
   - **Offline-ready Static Assets**: CSS, JS, and HTML cached for offline access
   - **Real-time Preservation**: Socket.IO and API requests bypass cache for live gameplay

11. **Enhanced Avatar System:**
   - **Avatar Pool**: 60 diverse emojis (12 original + 48 new additions)
   - **Random Selection**: Each player gets 12 randomly selected avatars from the pool
   - **Refresh Button**: 🔄 button with Bootstrap outline-primary styling for new avatar sets
   - **Grid Layout**: Responsive avatar selector that adapts to screen size
   - **Unlimited Variety**: Players can refresh avatars unlimited times for personalization

12. **Smart Character Management:**
   - **Player-Specific Colors**: Mystery stickers use each player's unique assigned color instead of generic gray
   - **Empty Character Handling**: Editing a character to empty text returns the sticker to "+" state
   - **Whitespace Protection**: Both empty strings and whitespace-only inputs properly remove character assignments
   - **Real-time Updates**: Character removal triggers immediate UI updates across all players
   - **Reliable Mobile Keyboard**: Simple, robust focus handling for consistent virtual keyboard behavior on mobile devices

13. **Timeout Protection System:**
   - **Extended Socket.IO Timeouts**: 2-minute ping timeout, 30-second ping interval, 45-second connect timeout
   - **Player State Management**: Players marked as disconnected rather than removed, allowing graceful reconnection
   - **Connection Tracking**: Socket-to-player mapping with `isConnected`, `connectedAt`, `disconnectedAt` properties
   - **Server Keep-Alive**: Automatic game state backup to disk every 5 minutes for active games
   - **Game Restoration**: Automatic game recovery from disk when accessing room URLs after server restart
   - **File Cleanup**: Automatic removal of game files older than 4 hours (protects active games)
   - **Render.com Protection**: Prevents app hibernation through periodic activity and state persistence
   - **Network Resilience**: Extended timeouts accommodate slow networks and temporary disconnections

### 🏗️ **Project Structure:**
```
whoami-game/
├── public/
│   ├── index.html          # Landing page (with PWA meta tags)
│   ├── game.html           # Game room page (with PWA meta tags)
│   ├── favicon.ico         # Custom favicon for browser tab recognition
│   ├── manifest.json       # PWA manifest for app installation
│   ├── sw.js              # Hybrid Service Worker v1.3.1 for smart caching
│   ├── css/style.css       # Custom styles with gradients/animations
│   ├── icons/              # PWA icons (6 SVG files)
│   │   ├── icon-48x48.svg
│   │   ├── icon-72x72.svg
│   │   ├── icon-96x96.svg
│   │   ├── icon-144x144.svg
│   │   ├── icon-192x192.svg
│   │   └── icon-512x512.svg
│   └── js/
│       ├── game.js         # Landing page logic with avatar rotation
│       ├── game-room.js    # Game room functionality
│       ├── translations.js # Localization system
│       └── pwa.js         # PWA Manager for updates & browser compatibility
├── server.js               # Node.js backend with Socket.IO
├── game-logic.js           # Extracted game logic functions for testing
├── package.json            # Dependencies
├── tests/                  # Test suites (Jest) - 220 tests total
│   ├── game-logic.test.js  # Core game logic tests
│   ├── api.test.js         # API endpoint tests
│   ├── character-update.test.js # Simplified character update system tests
│   ├── character-race-condition.test.js # Race condition prevention tests
│   ├── timeout-protection.test.js # Socket.IO timeout and keep-alive tests
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
npm test       # Run test suite (185 tests)
```

### 🎯 **Recent Major Updates:**

- **Timeout Protection System** (Latest):
  - **Extended Socket.IO Configuration**: 2-minute ping timeout, 30-second intervals, 45-second connect timeout
  - **Player State Management**: Graceful disconnect handling with reconnection support instead of removal
  - **Server Keep-Alive**: Automatic game state backup to disk every 5 minutes for active games
  - **Game Restoration**: Automatic recovery from disk when accessing room URLs after server restart
  - **File Cleanup**: Smart removal of game files older than 4 hours (protects active games)
  - **Render.com Protection**: Prevents hosting platform timeouts through periodic activity and persistence
  - **Comprehensive Testing**: Added 14 new tests for timeout protection (220 total tests)
- **Enhanced UX Features**:
  - **Avatar Refresh System**: 🔄 button in avatar selector provides unlimited random selections from 60-emoji pool
  - **Smart Mystery Stickers**: Mystery stickers now use player-specific colors instead of generic gray
  - **Empty Character Handling**: Editing character to empty/whitespace automatically returns to "+" state
  - **Fixed Mobile Keyboard**: Simple, robust focus handling prevents read-only state issues on mobile character editing
  - **Bootstrap Integration**: Refresh button uses clean Bootstrap outline-primary styling
  - **Real-time Character Removal**: Backend properly removes empty characters with immediate UI sync across all players

- **PWA Optimization & Browser Extension Compatibility**:
  - **Hybrid Caching Strategy**: Network-first for CSS/JS files (immediate updates), cache-first for static assets (performance)
  - **Browser Extension Fix**: Resolved chrome-extension:// console errors with comprehensive request validation
  - **Removed Aggressive Install Banner**: No more intrusive blue "Install App" prompts for cleaner UX
  - **Smart Update System**: Auto-update detection every 30 seconds with user-friendly update notifications
  - **Extension Compatibility**: Works flawlessly with Chrome, Firefox, Safari, and Edge browser extensions
  - **Service Worker v1.3.1**: Enhanced caching with protected operations and error handling
  - **Force Update Capability**: Available via `forceAppUpdate()` console command for developers
  - **PWA Benefits Preserved**: Offline functionality, fast loading, and installability maintained

- **Avatar Rotation System**:
  - **Per-Player Random Selection**: Each player gets unique 12 avatars from 60-emoji pool (12 original + 48 new)
  - **Client-Side Implementation**: Simple, robust approach without complex server synchronization
  - **Diverse Emoji Pool**: Carefully curated collection with people, animals, objects, and symbols
  - **No Room Binding**: Each player gets their own random selection for better variety

- **Favicon Implementation**:
  - **Professional Branding**: Added custom favicon for better browser tab recognition
  - **Multi-Format Support**: Proper .ico format with HTML meta tag integration
  - **Cross-Platform**: Works on all browsers and PWA installations

- **Room Recreation System**:
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

### 🎯 **Current Status: Optimization Complete**
**Priority:** Low - All critical systems working smoothly

### 🎯 **Future Goals:**
- **Share button** for link to the room (direct share functionality)
- **Visual improvements**: Make the gray mystery sticker lighter for better visibility
- **Concurrent editing protection**: Prevent two players from editing the same character simultaneously
- **Players with the same names**: support room where two or more players have the same name
- **Advanced features**: Rooms persistence, custom game rules, spectator mode

## Notes for Claude
- I learn best with hands-on examples
- Please explain technical terms when you use them
- I prefer to understand the "why" behind solutions
- Break complex tasks into small, clear steps
- Always show me where to put new code in my existing files
- Update tests each time the logic is changed
- Never copy-paste the same code in different files. Always keep code in utils.js
- Always increase cache version in CACHE_NAME before each commit.