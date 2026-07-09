// Who am I? Game - Core Logic Functions
// These functions are extracted for testing

const { v4: uuidv4 } = require('uuid');

// Color palette for character stickers (must match frontend)
const stickerColors = ['red', 'blue', 'purple', 'orange', 'green', 'pink', 'indigo'];

// Input limits. The frontend copy lives in public/js/utils.js (a browser
// script cannot require() this file); tests/input-limits.test.js fails if
// the two ever drift apart.
const MAX_NAME_LENGTH = 128;
const MAX_AVATAR_LENGTH = 10; // emoji can be several UTF-16 code units
const MAX_CHARACTER_LENGTH = 128;

// Count characters the way a person would: an emoji is one character,
// not the two UTF-16 code units JavaScript's .length reports.
function countCharacters(text) {
    return [...text].length;
}

// Validate and clean a player name. Returns the cleaned name or null if invalid.
function sanitizePlayerName(name) {
    if (typeof name !== 'string') return null;
    const trimmed = name.trim();
    if (trimmed.length === 0 || countCharacters(trimmed) > MAX_NAME_LENGTH) return null;
    return trimmed;
}

// Validate and clean an avatar. Returns the cleaned avatar or null if invalid.
function sanitizeAvatar(avatar) {
    if (typeof avatar !== 'string') return null;
    const trimmed = avatar.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_AVATAR_LENGTH) return null;
    return trimmed;
}

// Validate and clean a character name. Empty means "remove assignment".
// Returns the cleaned string, or null if the value is not a string at all.
function sanitizeCharacter(character) {
    if (character === null || character === undefined) return '';
    if (typeof character !== 'string') return null;
    // Truncate by character, not by code unit, so an emoji at the limit
    // is never cut in half into an invalid string
    return [...character.trim()].slice(0, MAX_CHARACTER_LENGTH).join('');
}

// Record that something happened in a game (used for inactive-game cleanup)
function touchGame(game) {
    game.lastActivityAt = Date.now();
}

// Assign unique color to new player
function assignUniqueColor(existingPlayers) {
    // Get colors already used by existing players
    const usedColors = new Set(existingPlayers.map(player => player.stickerColor).filter(Boolean));

    // Find first available color
    for (const color of stickerColors) {
        if (!usedColors.has(color)) {
            return color;
        }
    }

    // If all colors are used (more than 7 players), cycle through colors
    // Use modulo to ensure we don't go out of bounds
    return stickerColors[existingPlayers.length % stickerColors.length];
}

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
    touchGame(game);

    games.set(gameId, game);
    return { gameId, success: true };
}

// Add or reconnect a player to a game
function addPlayerToGame(games, gameId, playerName, avatar, playerId = null) {
    if (!games.has(gameId)) {
        return { success: false, error: 'Game not found' };
    }

    // Validate inputs before touching game state
    const cleanName = sanitizePlayerName(playerName);
    if (!cleanName) {
        return { success: false, error: 'Invalid player name' };
    }
    const cleanAvatar = sanitizeAvatar(avatar);
    if (!cleanAvatar) {
        return { success: false, error: 'Invalid avatar' };
    }

    const game = games.get(gameId);

    // Check if player is already in the game (reconnection)
    // Only match by ID - never by name to support duplicate names
    const existingPlayer = playerId
        ? game.players.find(p => p.id === playerId)
        : null;

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
        existingPlayer.isConnected = true;
        existingPlayer.connectedAt = Date.now();
        existingPlayer.avatar = cleanAvatar; // Allow avatar update
        delete existingPlayer.disconnectedAt; // Clear disconnect timestamp
        player = existingPlayer;
    } else {
        // Assign unique sticker color for new player
        const stickerColor = assignUniqueColor(game.players);

        // New player joining - use provided playerId if valid, otherwise generate one
        const isValidUUID = playerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playerId);
        player = {
            id: isValidUUID ? playerId : uuidv4(),
            name: cleanName,
            avatar: cleanAvatar,
            connected: true,
            isConnected: true,
            joinedAt: new Date(),
            connectedAt: Date.now(),
            stickerColor: stickerColor
        };

        game.players.push(player);
        isNewPlayer = true;
    }
    touchGame(game);

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

    // Characters are locked once the game has started (client hides editing,
    // but the server must enforce it too - e.g. a blur event can arrive late)
    if (game.state !== 'waiting') {
        return { success: false, error: 'Cannot change characters after the game has started' };
    }

    // Validate and clean the character text (trim + length limit)
    const cleanCharacter = sanitizeCharacter(character);
    if (cleanCharacter === null) {
        return { success: false, error: 'Invalid character' };
    }

    // Assign the character or remove it if empty
    if (cleanCharacter !== '') {
        game.characters.set(playerId, {
            character: cleanCharacter,
            assignedBy: assignedBy,
            assignedAt: new Date()
        });
    } else {
        // Remove character assignment if empty or whitespace-only
        game.characters.delete(playerId);
    }
    touchGame(game);

    return {
        success: true,
        playerId,
        character: cleanCharacter, // Empty string for removed characters
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
    touchGame(game);

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
    touchGame(game);

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
    touchGame(game);

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

// Recreate a game from saved state
function recreateGameFromState(games, roomCode, savedGameState) {
    try {
        // Validate the saved state has required fields
        if (!savedGameState.players || !Array.isArray(savedGameState.players)) {
            return { success: false, error: 'Invalid saved game state: missing players' };
        }

        // Create the game structure
        const game = {
            id: roomCode,
            players: savedGameState.players || [],
            characters: new Map(),
            state: savedGameState.gameState || 'waiting',
            revealedPlayers: new Set(),
            created: new Date(),
            recreatedAt: new Date()
        };

        // Safely handle characters data
        if (savedGameState.characters && typeof savedGameState.characters === 'object' && !Array.isArray(savedGameState.characters)) {
            try {
                game.characters = new Map(Object.entries(savedGameState.characters));
            } catch (error) {
                console.warn('Invalid characters data, using empty Map');
                game.characters = new Map();
            }
        }

        // Safely handle revealedPlayers data
        if (savedGameState.revealedPlayers && Array.isArray(savedGameState.revealedPlayers)) {
            try {
                game.revealedPlayers = new Set(savedGameState.revealedPlayers);
            } catch (error) {
                console.warn('Invalid revealedPlayers data, using empty Set');
                game.revealedPlayers = new Set();
            }
        }

        // Avatar rotation is now per-player, no need to store room-specific avatars

        touchGame(game);

        // Store the recreated game
        games.set(roomCode, game);

        console.log(`Game ${roomCode} recreated with ${game.players.length} players in state: ${game.state}`);

        return {
            success: true,
            gameId: roomCode,
            playersRestored: game.players.length,
            charactersRestored: game.characters.size,
            gameState: game.state
        };

    } catch (error) {
        console.error('Error recreating game from state:', error);
        return { success: false, error: 'Failed to recreate game from saved state' };
    }
}

// Tracks which socket belongs to which player.
//
// The tricky part is the page refresh: the browser opens a NEW socket before
// the OLD one reports its disconnect. Without care, the late disconnect of the
// old socket would mark the freshly reconnected player as offline. Every
// disconnect is therefore checked against the player's current socket.
function createConnectionTracker() {
    const socketToPlayer = new Map(); // socketId -> { gameId, playerId }
    const playerToSocket = new Map(); // playerId -> socketId

    return {
        // Register a socket as the player's current connection
        register(socketId, gameId, playerId) {
            socketToPlayer.set(socketId, { gameId, playerId });
            playerToSocket.set(playerId, socketId);
        },

        // Handle a socket disconnect.
        // Returns { gameId, playerId } if the player really went offline,
        // or null if the socket was stale (player already reconnected) / unknown.
        unregister(socketId) {
            const playerInfo = socketToPlayer.get(socketId);
            if (!playerInfo) return null;

            socketToPlayer.delete(socketId);

            // Stale disconnect: the player already has a newer socket
            if (playerToSocket.get(playerInfo.playerId) !== socketId) {
                return null;
            }

            playerToSocket.delete(playerInfo.playerId);
            return playerInfo;
        },

        getSocketId(playerId) {
            return playerToSocket.get(playerId);
        },

        get size() {
            return socketToPlayer.size;
        }
    };
}

// Remove games nobody plays anymore from memory (prevents unbounded growth).
// A game is inactive when it has no connected players and nothing happened
// in it for maxIdleMs. Returns the list of removed game IDs.
function cleanupInactiveGames(games, maxIdleMs = 4 * 60 * 60 * 1000) {
    const now = Date.now();
    const removed = [];

    for (const [gameId, game] of games.entries()) {
        const hasConnectedPlayers = game.players.some(p => p.isConnected);
        const lastActivity = game.lastActivityAt ||
            (game.created instanceof Date ? game.created.getTime() : now);

        if (!hasConnectedPlayers && now - lastActivity > maxIdleMs) {
            games.delete(gameId);
            removed.push(gameId);
        }
    }

    return removed;
}

module.exports = {
    generateRoomCode,
    createGame,
    addPlayerToGame,
    assignCharacter,
    startGame,
    revealCharacter,
    restartGame,
    isValidRoomCode,
    assignUniqueColor,
    recreateGameFromState,
    sanitizePlayerName,
    sanitizeAvatar,
    sanitizeCharacter,
    touchGame,
    cleanupInactiveGames,
    createConnectionTracker,
    MAX_NAME_LENGTH,
    MAX_CHARACTER_LENGTH
};