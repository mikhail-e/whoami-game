// Who am I? Game - Node.js Server
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const gameLogic = require('./game-logic');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Store games in memory for now (will move to files later)
const games = new Map();

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Handle game room URLs - serve game page for /game/ROOMCODE
app.get('/game/:roomCode', (req, res) => {
    const roomCode = req.params.roomCode.toUpperCase();
    
    // Check if game exists
    if (games.has(roomCode)) {
        res.sendFile(path.join(__dirname, 'public', 'game.html'));
    } else {
        // Redirect to home with error
        res.redirect('/?error=room-not-found');
    }
});

// API endpoint to create a new game
app.post('/api/create-game', express.json(), (req, res) => {
    const result = gameLogic.createGame(games);
    res.json(result);
});

// API endpoint to join a game
app.post('/api/join-game', express.json(), (req, res) => {
    const { gameId, playerName, avatar, playerId } = req.body;
    
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
    
    // Broadcast to all players in the room
    const eventName = result.isNewPlayer ? 'player-joined' : 'player-reconnected';
    io.to(gameId).emit(eventName, {
        player: result.player,
        players: result.game.players
    });
    
    res.json(result);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('join-room', (gameId) => {
        socket.join(gameId);
        console.log(`User ${socket.id} joined room ${gameId}`);
        
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
    
    socket.on('assign-character', (data) => {
        const { gameId, playerId, character, assignedBy } = data;
        
        const result = gameLogic.assignCharacter(games, gameId, playerId, character, assignedBy);
        
        if (!result.success) {
            socket.emit('error', result.error);
            return;
        }
        
        console.log(`Character "${character}" assigned to player ${playerId} in game ${gameId}`);
        
        // Broadcast the update to all players in the room
        io.to(gameId).emit('character-assigned', result);
    });
    
    socket.on('start-game', (data) => {
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
    
    socket.on('reveal-character', (data) => {
        const { gameId, playerId } = data;
        
        const result = gameLogic.revealCharacter(games, gameId, playerId);
        
        if (!result.success) {
            socket.emit('error', result.error);
            return;
        }
        
        console.log(`Player ${playerId} revealed their character in game ${gameId}`);
        
        // Broadcast character reveal to all players in the room
        io.to(gameId).emit('character-revealed', result);
    });
    
    socket.on('restart-game', (data) => {
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
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`🎭 Who am I? server running on http://localhost:${PORT}`);
    console.log('Press Ctrl+C to stop the server');
});

// Create games directory if it doesn't exist
const gamesDir = path.join(__dirname, 'games');
if (!fs.existsSync(gamesDir)) {
    fs.mkdirSync(gamesDir);
}