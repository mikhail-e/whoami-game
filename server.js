// Who am I? Game - Node.js Server
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const gameLogic = require('./game-logic');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    pingTimeout: 120000,      // 2 minutes - how long to wait for ping response
    pingInterval: 30000,      // 30 seconds - how often to send pings
    connectTimeout: 45000,    // 45 seconds - initial connection timeout
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// The release version is written only in package.json (docs/release.md)
const { version: APP_VERSION } = require('./package.json');

// Store games in memory for now (will move to files later)
const games = new Map();

// Track socket connections for better disconnect handling
// (handles the refresh race: new socket connects before old one disconnects)
const connections = gameLogic.createConnectionTracker();

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Handle game room URLs - serve game page for /game/ROOMCODE
app.get('/game/:roomCode', (req, res) => {
    const roomCode = req.params.roomCode.toUpperCase();

    // Check if game exists in memory
    if (games.has(roomCode)) {
        res.sendFile(path.join(__dirname, 'public', 'game.html'));
        return;
    }

    // Try to restore game from disk
    try {
        const filePath = path.join(gamesDir, `${roomCode}.json`);
        if (fs.existsSync(filePath)) {
            const gameState = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            console.log(`🔄 Restoring game ${roomCode} from disk for room access`);

            // Restore game to memory
            const restoredGame = {
                id: gameState.id,
                players: gameState.players || [],
                characters: new Map(Object.entries(gameState.characters || {})),
                state: gameState.state || 'waiting',
                revealedPlayers: new Set(gameState.revealedPlayers || []),
                created: new Date(gameState.created),
                restoredAt: new Date()
            };

            // Nobody is actually connected right after a restore - players will be
            // marked connected again when they rejoin. Without this reset the game
            // would look "active" forever and never get cleaned up. The fresh
            // disconnectedAt replaces any stale timestamp from the saved file,
            // giving every player the full ghost timeout to come back.
            restoredGame.players.forEach(player => {
                player.connected = false;
                player.isConnected = false;
                player.disconnectedAt = Date.now();
            });
            gameLogic.touchGame(restoredGame);

            games.set(roomCode, restoredGame);
            res.sendFile(path.join(__dirname, 'public', 'game.html'));
            return;
        }
    } catch (error) {
        console.error(`❌ Failed to restore game ${roomCode} from disk:`, error);
    }

    // Game not found in memory or disk
    res.redirect('/?error=room-not-found');
});

// Custom image avatars ride inside JSON bodies; recreate-game carries every
// player's avatar at once, which can exceed express.json()'s 100kb default
const jsonBody = express.json({ limit: '1mb' });

// The running version: every page shows it at the bottom, and after a deploy
// it tells which release is live
app.get('/api/version', (req, res) => {
    res.json({ version: APP_VERSION });
});

// API endpoint to create a new game
app.post('/api/create-game', jsonBody, (req, res) => {
    const result = gameLogic.createGame(games);
    res.json(result);
});

// API endpoint to join a game
app.post('/api/join-game', jsonBody, (req, res) => {
    const { gameId, playerName, avatar, playerId } = req.body || {};

    console.log('Join game request:', { gameId, playerName, avatar, playerId });
    
    if (!gameId || !playerName || !avatar) {
        console.log('Missing required fields:', { gameId: !!gameId, playerName: !!playerName, avatar: !!avatar });
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = gameLogic.addPlayerToGame(games, gameId, playerName, avatar, playerId);
    
    if (!result.success) {
        console.log('Failed to add player to game:', result.error);
        return res.status(400).json(result);
    }
    
    console.log(`Player ${playerName} ${result.isNewPlayer ? 'joined' : 'reconnected to'} game ${gameId}`);
    
    // Broadcast to all players in the room. Characters and reveals are
    // included because a returning leaver gets their character restored -
    // the other clients must see it reappear on the card
    const eventName = result.isNewPlayer ? 'player-joined' : 'player-reconnected';
    io.to(gameId).emit(eventName, {
        player: result.player,
        players: result.game.players,
        characters: result.game.characters,
        revealedPlayers: result.game.revealedPlayers
    });
    
    res.json(result);
});

// API endpoint to recreate a game with saved state
app.post('/api/recreate-game', jsonBody, (req, res) => {
    const { roomCode, gameState } = req.body || {};

    console.log('Recreate game request:', { roomCode, gameStateExists: !!gameState });

    if (!roomCode || !gameState) {
        console.log('Missing required fields for recreation:', { roomCode: !!roomCode, gameState: !!gameState });
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate room code format
    if (!gameLogic.isValidRoomCode(roomCode)) {
        console.log('Invalid room code format:', roomCode);
        return res.status(400).json({ error: 'Invalid room code format' });
    }

    // Check if room already exists
    if (games.has(roomCode)) {
        console.log('Room already exists, recreation not needed:', roomCode);
        return res.json({ success: true, message: 'Room already exists' });
    }

    const result = gameLogic.recreateGameFromState(games, roomCode, gameState);

    if (!result.success) {
        console.log('Failed to recreate game:', result.error);
        return res.status(400).json(result);
    }

    console.log(`Game ${roomCode} recreated successfully from saved state`);
    res.json(result);
});

// Wrap a socket event handler so a bad payload can never crash the server:
// guarantees `data` is an object and catches unexpected errors.
function safeHandler(socket, eventName, handler) {
    socket.on(eventName, (data) => {
        try {
            handler((data && typeof data === 'object') ? data : {});
        } catch (error) {
            console.error(`❌ Error handling "${eventName}":`, error);
            socket.emit('error', 'Something went wrong, please try again');
        }
    });
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    safeHandler(socket, 'join-room', (data) => {
        const { gameId, playerId } = data;
        if (typeof gameId !== 'string' || !gameLogic.isValidRoomCode(gameId.toUpperCase())) {
            return;
        }
        socket.join(gameId);
        console.log(`User ${socket.id} joined room ${gameId}`);

        // Track socket-player relationship
        if (playerId) {
            connections.register(socket.id, gameId, playerId);
            console.log(`📍 Tracking connection: ${socket.id} → Player ${playerId} in game ${gameId}`);
        }
        
        // Send current game state to the user
        if (games.has(gameId)) {
            const game = games.get(gameId);
            // Convert Map to Object for JSON serialization
            const gameState = {
                ...game,
                characters: Object.fromEntries(game.characters),
                revealedPlayers: Array.from(game.revealedPlayers)
            };
            socket.emit('game-state', gameState);
        }
    });

    // Real-time streaming removed - keeping it simple

    // Final character assignment (when editing completes)
    safeHandler(socket, 'assign-character', (data) => {
        const { gameId, playerId, character, assignedBy } = data;

        const result = gameLogic.assignCharacter(games, gameId, playerId, character, assignedBy);

        if (!result.success) {
            socket.emit('error', result.error);
            return;
        }

        console.log(`✅ Character finalized: "${character}" for player ${playerId} in game ${gameId}`);

        // Send complete character state to all players for consistency
        const game = games.get(gameId);
        const allCharacters = Object.fromEntries(game.characters);
        console.log(`📡 Broadcasting character-finalized to room ${gameId} with all characters:`, allCharacters);

        // Use io.to() instead of socket.to() to include the sender (for single-tab testing)
        io.to(gameId).emit('character-finalized', {
            playerId: playerId,
            character: character,
            allCharacters: allCharacters
        });
    });

    // Note: Old edit state synchronization removed - using real-time streaming instead

    safeHandler(socket, 'start-game', (data) => {
        const { gameId, playerId } = data;
        
        const result = gameLogic.startGame(games, gameId, playerId);
        
        if (!result.success) {
            socket.emit('error', result.error);
            return;
        }
        
        console.log(`Game ${gameId} started by player ${playerId}`);
        
        // Broadcast game start to all players in the room
        io.to(gameId).emit('game-started', result);
    });
    
    safeHandler(socket, 'reveal-character', (data) => {
        const { gameId, playerId } = data;
        
        const result = gameLogic.revealCharacter(games, gameId, playerId);
        
        if (!result.success) {
            socket.emit('error', result.error);
            return;
        }
        
        console.log(`Player ${playerId} revealed their character in game ${gameId}`);

        // Broadcast character reveal to all players in the room
        io.to(gameId).emit('character-revealed', result);

        // Broadcast notification about the reveal to all players
        if (result.success && result.revealedPlayer) {
            io.to(gameId).emit('player-revealed-notification', {
                playerName: result.revealedPlayer.name,
                character: result.revealedPlayer.character,
                playerId: playerId
            });
        }
    });
    
    safeHandler(socket, 'restart-game', (data) => {
        const { gameId, playerId } = data;
        
        const result = gameLogic.restartGame(games, gameId, playerId);
        
        if (!result.success) {
            socket.emit('error', result.error);
            return;
        }
        
        console.log(`Game ${gameId} restarted by player ${playerId}`);

        // Broadcast game restart to all players in the room
        io.to(gameId).emit('game-restarted', result);
    });

    safeHandler(socket, 'leave-game', (data) => {
        const { gameId, playerId } = data;

        // A player may only remove themselves: the request must come from
        // the socket currently registered to that player (see join-room)
        if (!playerId || connections.getSocketId(playerId) !== socket.id) {
            socket.emit('error', 'You can only leave the game yourself');
            return;
        }

        const result = gameLogic.removePlayerFromGame(games, gameId, playerId);

        if (!result.success) {
            socket.emit('error', result.error);
            return;
        }

        console.log(`👋 Player ${playerId} left game ${gameId}`);

        // Emit BEFORE socket.leave() so the leaver receives the confirmation
        // and uses it as the trigger to redirect home
        io.to(gameId).emit('player-left', {
            playerId: playerId,
            playerName: result.removedPlayer.name,
            players: result.players,
            characters: result.characters,
            revealedPlayers: result.revealedPlayers,
            gameDeleted: result.gameDeleted
        });

        socket.leave(gameId);
        connections.unregister(socket.id); // the later disconnect becomes a no-op

        if (result.gameDeleted) {
            console.log(`🗑️ Game ${gameId} removed - last player left`);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Returns null for stale sockets (player already reconnected via a new socket)
        const playerInfo = connections.unregister(socket.id);
        if (!playerInfo) {
            return;
        }

        const { gameId, playerId } = playerInfo;
        console.log(`🔌 Player ${playerId} disconnected from game ${gameId}`);

        // Mark player as disconnected but keep them in the game
        if (games.has(gameId)) {
            const game = games.get(gameId);
            const player = game.players.find(p => p.id === playerId);
            if (player) {
                player.connected = false;
                player.isConnected = false;
                player.disconnectedAt = Date.now();
                gameLogic.touchGame(game);
                console.log(`⏰ Player ${playerId} marked as disconnected at ${new Date().toISOString()}`);

                // Notify other players about the disconnection
                socket.to(gameId).emit('player-disconnected', {
                    playerId: playerId,
                    playerName: player.name
                });
            }
        }
    });
});

// Create games directory if it doesn't exist
const gamesDir = path.join(__dirname, 'games');
if (!fs.existsSync(gamesDir)) {
    fs.mkdirSync(gamesDir);
}

// Clean up old game files (older than 4 hours)
function cleanupOldGameFiles() {
    try {
        const files = fs.readdirSync(gamesDir);
        const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000); // 4 hours in milliseconds
        let removedCount = 0;

        for (const file of files) {
            if (file.endsWith('.json')) {
                const filePath = path.join(gamesDir, file);
                const stats = fs.statSync(filePath);

                if (stats.mtime.getTime() < fourHoursAgo) {
                    const roomCode = file.replace('.json', '');

                    // Only remove if game is not currently active in memory
                    if (!games.has(roomCode)) {
                        fs.unlinkSync(filePath);
                        removedCount++;
                        console.log(`🗑️ Removed old game file: ${file} (${Math.round((Date.now() - stats.mtime.getTime()) / (60 * 60 * 1000))} hours old)`);
                    } else {
                        console.log(`🔒 Keeping old game file: ${file} (game still active in memory)`);
                    }
                }
            }
        }

        if (removedCount > 0) {
            console.log(`🧹 Cleanup complete: removed ${removedCount} old game files`);
        } else {
            console.log(`✨ Cleanup complete: no old files to remove`);
        }
    } catch (error) {
        console.error(`❌ Failed to cleanup old game files:`, error);
    }
}

// Keep-alive functionality for active games
function keepGamesAlive() {
    // First remove "ghosts" - players disconnected for over 10 minutes
    // (usually the same person who came back under a new player ID, e.g.
    // after clearing localStorage or joining from a messenger's in-app
    // browser). Done before saving so the disk backup is already clean.
    // The payload matches the leave-game handler, so clients reuse their
    // existing 'player-left' handling (list update + notification).
    const removals = gameLogic.removeStaleDisconnectedPlayers(games);
    for (const removal of removals) {
        console.log(`👻 Removed ghost player ${removal.removedPlayer.id} from game ${removal.gameId} (disconnected too long)`);
        io.to(removal.gameId).emit('player-left', {
            playerId: removal.removedPlayer.id,
            playerName: removal.playerName,
            players: removal.players,
            characters: removal.characters,
            revealedPlayers: removal.revealedPlayers,
            gameDeleted: removal.gameDeleted
        });
    }

    for (const [gameId, game] of games.entries()) {
        // Only keep alive games that have connected players
        const connectedPlayers = game.players.filter(p => p.isConnected).length;

        if (connectedPlayers > 0) {
            console.log(`🔄 Keep-alive: Game ${gameId} has ${connectedPlayers} connected players`);

            // Save game state to disk as backup
            const gameState = {
                id: gameId,
                players: game.players,
                characters: Object.fromEntries(game.characters || new Map()),
                state: game.state,
                revealedPlayers: Array.from(game.revealedPlayers || new Set()),
                created: game.created,
                lastKeepAlive: new Date().toISOString()
            };

            try {
                const filePath = path.join(gamesDir, `${gameId}.json`);
                fs.writeFileSync(filePath, JSON.stringify(gameState, null, 2));
                console.log(`💾 Game ${gameId} state saved to disk`);
            } catch (error) {
                console.error(`❌ Failed to save game ${gameId} to disk:`, error);
            }
        } else {
            console.log(`⏳ Game ${gameId} has no connected players, keeping in memory`);
        }
    }

    // Remove long-inactive games from memory (their files stay on disk for
    // up to 4 more hours, so recently abandoned rooms can still be restored)
    const removedGames = gameLogic.cleanupInactiveGames(games);
    if (removedGames.length > 0) {
        console.log(`🧹 Removed ${removedGames.length} inactive games from memory: ${removedGames.join(', ')}`);
    }

    // Clean up old files after keep-alive
    cleanupOldGameFiles();
}

const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Open the port and start the keep-alive loop
function startServer() {
    server.listen(PORT, '0.0.0.0', () => {
        if (NODE_ENV === 'production') {
            console.log(`🎭 Who am I? server running in production on port ${PORT}`);
        } else {
            console.log(`🎭 Who am I? server running on http://localhost:${PORT}`);
            console.log('Press Ctrl+C to stop the server');
        }
    });

    // Run keep-alive every 5 minutes, the first time after 1 minute
    setInterval(keepGamesAlive, KEEP_ALIVE_INTERVAL);
    setTimeout(keepGamesAlive, 60 * 1000);
}

// Start only when run as `node server.js` (npm start). Tests require() this
// file to reach the real routes through `app` without opening a port.
if (require.main === module) {
    startServer();
}

module.exports = { app };