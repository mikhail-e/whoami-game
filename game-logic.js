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
        state: 'waiting', // waiting, started, ended
        revealedPlayers: new Set(), // Track who has revealed their character
        created: new Date()
    };
    
    games.set(gameId, game);
    return { gameId, success: true };
}

// Add or reconnect a player to a game
function addPlayerToGame(games, gameId, playerName, avatar, playerId = null) {
    if (!games.has(gameId)) {
        return { success: false, error: 'Game not found' };
    }
    
    const game = games.get(gameId);
    
    // Check if player is already in the game (reconnection)
    // First try to match by ID if provided, otherwise fall back to name matching
    const existingPlayer = playerId 
        ? game.players.find(p => p.id === playerId)
        : game.players.find(p => p.name.toLowerCase().trim() === playerName.toLowerCase().trim());
    
    // Check if game has already started (only allow existing players to reconnect)
    if (game.state === 'started' && !existingPlayer) {
        return { success: false, error: 'Game has already started' };
    }
    
    // Check if game is full (max 12 players, but allow existing players)
    if (game.players.length >= 12 && !existingPlayer) {
        return { success: false, error: 'Game is full' };
    }
    
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
            characters: Object.fromEntries(game.characters),
            state: game.state,
            revealedPlayers: Array.from(game.revealedPlayers)
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

// Start a game
function startGame(games, gameId, playerId) {
    if (!games.has(gameId)) {
        return { success: false, error: 'Game not found' };
    }
    
    const game = games.get(gameId);
    
    // Validate that the player exists in the game
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
        return { success: false, error: 'Player not found in game' };
    }
    
    // Check if game is already started
    if (game.state === 'started') {
        return { success: false, error: 'Game has already started' };
    }
    
    // Check if we have at least 2 players
    if (game.players.length < 2) {
        return { success: false, error: 'Need at least 2 players to start' };
    }
    
    // Start the game
    game.state = 'started';
    game.startedAt = new Date();
    
    return { 
        success: true,
        gameId,
        state: game.state,
        startedBy: playerId
    };
}

// Reveal character for a player
function revealCharacter(games, gameId, playerId) {
    if (!games.has(gameId)) {
        return { success: false, error: 'Game not found' };
    }
    
    const game = games.get(gameId);
    
    // Validate that the player exists in the game
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
        return { success: false, error: 'Player not found in game' };
    }
    
    // Check if game has started
    if (game.state !== 'started') {
        return { success: false, error: 'Game has not started yet' };
    }
    
    // Check if player has a character assigned
    if (!game.characters.has(playerId)) {
        return { success: false, error: 'No character assigned to this player' };
    }
    
    // Add player to revealed set
    game.revealedPlayers.add(playerId);
    
    const characterData = game.characters.get(playerId);
    
    return {
        success: true,
        playerId,
        character: characterData.character,
        revealedPlayers: Array.from(game.revealedPlayers),
        revealedPlayer: {
            id: playerId,
            name: player.name,
            character: characterData.character
        }
    };
}

// Restart a game (reset to waiting state)
function restartGame(games, gameId, playerId) {
    if (!games.has(gameId)) {
        return { success: false, error: 'Game not found' };
    }
    
    const game = games.get(gameId);
    
    // Validate that the player exists in the game
    const player = game.players.find(p => p.id === playerId);
    if (!player) {
        return { success: false, error: 'Player not found in game' };
    }
    
    // Reset game state
    game.state = 'waiting';
    game.revealedPlayers.clear();
    game.characters.clear(); // Clear all character assignments
    game.restartedAt = new Date();
    
    // Clear all character assignments - players start fresh
    // This makes restart more visually obvious
    
    return { 
        success: true,
        gameId,
        state: game.state,
        restartedBy: playerId,
        revealedPlayers: Array.from(game.revealedPlayers),
        characters: Object.fromEntries(game.characters) // Empty object now
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
    startGame,
    revealCharacter,
    restartGame,
    isValidRoomCode
};