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

### 🏗️ **Project Structure:**
```
whoami-game/
├── public/
│   ├── index.html          # Landing page
│   ├── game.html           # Game room page
│   ├── css/style.css       # Custom styles with gradients/animations
│   └── js/
│       ├── game.js         # Landing page logic
│       └── game-room.js    # Game room functionality
├── server.js               # Node.js backend with Socket.IO
├── package.json            # Dependencies
└── games/                  # Game data storage (future)
```

### 🚀 **How to Run:**
```bash
npm install    # Install dependencies
npm start      # Start server on localhost:3000
```

### 🎯 **Recent Improvements:**
- Fixed refresh functionality during started games with ID-based player matching
- Improved Start Game button behavior (wider, enabled only when ready)
- Enhanced Join Game button (enabled only with valid room codes)
- Optimized mobile layout with controls moved to bottom during gameplay
- Added smart UI state management (hide unnecessary elements during games)
- Improved focus management for better user experience
- Added comprehensive test coverage for new functionality

### 🎯 **Next Goals:**
- Add actual gameplay mechanics (asking questions, answering yes/no)
- Implement game persistence (save/load from files)
- Add game scoring and winner detection
- Create game history and statistics


## Notes for Claude
- I learn best with hands-on examples
- Please explain technical terms when you use them
- I prefer to understand the "why" behind solutions
- Break complex tasks into small, clear steps
- Always show me where to put new code in my existing files