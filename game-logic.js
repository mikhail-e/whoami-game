// Who am I? Game - Core Logic Functions
// These functions are extracted for testing

const { v4: uuidv4 } = require('uuid');

// Generate short room code (6 characters)
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Create a new game
function createGame(games) {
    let gameId;
    // Ensure unique code
    do {
        gameId = generateRoomCode();
    } while (games.has(gameId));
    
    const game = {
        id: gameId,
        players: [],
        characters: new Map(),
        created: new Date()
    };
    
    games.set(gameId, game);
    return { gameId, success: true };
}

// Add or reconnect a player to a game
function addPlayerToGame(games, gameId, playerName, avatar) {
    if (!games.has(gameId)) {
        return { success: false, error: 'Game not found' };
    }
    
    const game = games.get(gameId);
    
    // Check if game is full (max 12 players)
    if (game.players.length >= 12) {
        return { success: false, error: 'Game is full' };
    }
    
    // Check if player is already in the game (reconnection)
    const existingPlayer = game.players.find(p => p.name === playerName);
    
    let player;
    let isNewPlayer = false;
    
    if (existingPlayer) {
        // Player reconnecting - update their connection status
        existingPlayer.connected = true;
        existingPlayer.avatar = avatar; // Allow avatar update
        player = existingPlayer;
    } else {
        // New player joining
        player = {
            id: uuidv4(),
            name: playerName,
            avatar: avatar,
            connected: true,
            joinedAt: new Date()
        };
        
        game.players.push(player);
        isNewPlayer = true;
    }
    
    return { 
        success: true, 
        player, 
        game: { 
            id: game.id, 
            players: game.players,
            characters: Object.fromEntries(game.characters)
        },
        isNewPlayer 
    };
}

// Assign a character to a player
function assignCharacter(games, gameId, playerId, character, assignedBy) {
    if (!games.has(gameId)) {
        return { success: false, error: 'Game not found' };
    }
    
    const game = games.get(gameId);
    
    // Validate that the player exists in the game
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
        return { success: false, error: 'Player not found in game' };
    }
    
    // Validate that the assigner exists in the game
    const assigner = game.players.find(p => p.id === assignedBy);
    if (!assigner) {
        return { success: false, error: 'Assigner not found in game' };
    }
    
    // Restriction: Players cannot assign characters to themselves
    if (playerId === assignedBy) {
        return { success: false, error: 'Cannot assign character to yourself' };
    }
    
    // Assign the character
    game.characters.set(playerId, {
        character: character,
        assignedBy: assignedBy,
        assignedAt: new Date()
    });
    
    return { 
        success: true,
        playerId,
        character,
        assignedBy,
        characters: Object.fromEntries(game.characters)
    };
}

// Validate room code format
function isValidRoomCode(code) {
    if (!code || typeof code !== 'string') {
        return false;
    }
    
    // Must be exactly 6 characters, alphanumeric
    return /^[A-Z0-9]{6}$/.test(code);
}

module.exports = {
    generateRoomCode,
    createGame,
    addPlayerToGame,
    assignCharacter,
    isValidRoomCode
};