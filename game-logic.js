// Who am I? Game - Core Logic Functions
// These functions are extracted for testing

const crypto = require('crypto');

// Color palette for character stickers (must match frontend)
const stickerColors = ['red', 'blue', 'purple', 'orange', 'green', 'pink', 'indigo'];

const MAX_PLAYERS = 12;
// The states a game moves between (restartGame goes back to waiting)
const GAME_STATES = ['waiting', 'started'];

// A player ID is a UUID, and so is a player's secret. The frontend copy lives
// in public/js/utils.js (a stored value in another format is replaced there);
// tests/input-limits.test.js keeps the two equal. Keep it on a single line
// for that test.
const PLAYER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Input limits. The frontend copy lives in public/js/utils.js (a browser
// script cannot require() this file); tests/input-limits.test.js fails if
// the two ever drift apart.
const MAX_NAME_LENGTH = 128;
const MAX_AVATAR_LENGTH = 10; // emoji can be several UTF-16 code units
const MAX_CHARACTER_LENGTH = 128;

// A custom avatar is a small photo the player uploaded, carried as a base64
// data URL in the same player.avatar field the emoji uses. The frontend copy
// of these two values lives in public/js/utils.js; tests/input-limits.test.js
// fails if they drift apart. Keep each on a single line for the sync tests.
const MAX_CUSTOM_AVATAR_LENGTH = 32768; // ~24 KB of image data as base64
const CUSTOM_AVATAR_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

function isValidPlayerId(value) {
    return typeof value === 'string' && PLAYER_ID_PATTERN.test(value);
}

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

// True if the value is a strictly valid custom-avatar data URL: only the three
// safe raster image MIME types, only base64 characters, and small enough.
// Anything else (javascript:, data:text/html, embedded whitespace) fails.
function isCustomAvatar(value) {
    return typeof value === 'string'
        && value.length <= MAX_CUSTOM_AVATAR_LENGTH
        && CUSTOM_AVATAR_PATTERN.test(value);
}

// Validate and clean an avatar. Returns the cleaned avatar or null if invalid.
// Accepts either an emoji (short string) or an uploaded image (data URL).
function sanitizeAvatar(avatar) {
    if (typeof avatar !== 'string') return null;
    const trimmed = avatar.trim();
    if (trimmed.length === 0) return null;
    if (isCustomAvatar(trimmed)) return trimmed;
    if (trimmed.length > MAX_AVATAR_LENGTH) return null;
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

// Keep the players list in first-join order, so every client shows the same
// stable order (easy to follow whose turn it is). joinedAt can be a Date or
// an ISO string (after a JSON round trip through disk/localStorage backups).
// The sort is stable (ES2019), so same-millisecond joins keep their order.
function sortPlayersByJoinTime(players) {
    players.sort((a, b) => new Date(a.joinedAt || 0) - new Date(b.joinedAt || 0));
}

// Generate short room code (6 characters). The code is all that lets a
// stranger into a room, so it comes from the cryptographic generator:
// Math.random's next numbers can be worked out from the ones it gave before
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[crypto.randomInt(chars.length)];
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
        recentlyLeft: new Map(), // playerId -> snapshot, lets leavers return to a started game
        secrets: new Map(), // playerId -> the player's secret (checkPlayerSecret); never sent to a page
        created: new Date()
    };
    touchGame(game);

    games.set(gameId, game);
    return { gameId, success: true };
}

// Add or reconnect a player to a game.
//
// A player ID is public: every page sees the players list. What proves that a
// browser IS a player is the secret it sends along (PLAYER_SECRET in utils.js),
// which the server never gives to anybody. The first join with a secret
// records it (also for a player of a restored room, who has none yet); after
// that, joining as this player needs the same secret. server.js sends one with
// every join; a call without one checks nothing that is not recorded
function addPlayerToGame(games, gameId, playerName, avatar, playerId = null, playerSecret = null) {
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

    // A player who left THIS started round may come back (their character,
    // reveal status and color were snapshotted on the way out)
    const returningSnapshot = playerId ? game.recentlyLeft.get(playerId) : undefined;

    // Check if game has already started (only allow existing players to
    // reconnect and recent leavers to return)
    if (game.state === 'started' && !existingPlayer && !returningSnapshot) {
        return { success: false, error: 'Game has already started' };
    }

    // Somebody else's browser cannot take this player's place
    const recordedSecret = existingPlayer ? game.secrets.get(playerId) : returningSnapshot?.secret;
    if (recordedSecret && playerSecret !== recordedSecret) {
        return { success: false, error: 'This player is playing in another browser' };
    }

    // Check if game is full (allow existing players)
    if (game.players.length >= MAX_PLAYERS && !existingPlayer) {
        return { success: false, error: 'Game is full' };
    }

    let player;
    let isNewPlayer = false;

    if (existingPlayer) {
        // Player coming back (a reload, a reconnect): their page is about
        // to connect. One who is offline gets a fresh ghost clock meanwhile
        existingPlayer.avatar = cleanAvatar; // Allow avatar update
        if (!existingPlayer.isConnected) existingPlayer.disconnectedAt = Date.now();
        player = existingPlayer;
    } else {
        // Prefer the returning player's old color if nobody took it meanwhile
        const usedColors = new Set(game.players.map(p => p.stickerColor));
        const stickerColor = (returningSnapshot && !usedColors.has(returningSnapshot.stickerColor))
            ? returningSnapshot.stickerColor
            : assignUniqueColor(game.players);

        // New player joining - use provided playerId if valid, otherwise generate one
        player = {
            id: isValidPlayerId(playerId) ? playerId : crypto.randomUUID(),
            name: cleanName,
            avatar: cleanAvatar,
            // Online only once their page connects (markPlayerConnected). A
            // player whose page never opens the room - a closed tab, a lost
            // network - is removed as a ghost instead of staying forever
            isConnected: false,
            disconnectedAt: Date.now(),
            // A returning leaver keeps their original join time, which puts
            // them back at their old position in the list (see sort below)
            joinedAt: (returningSnapshot && returningSnapshot.joinedAt) || new Date(),
            stickerColor: stickerColor
        };

        game.players.push(player);
        sortPlayersByJoinTime(game.players);
        isNewPlayer = true;

        // A returning leaver gets their character and reveal status back,
        // so they can continue the round as if they never left
        if (returningSnapshot) {
            if (returningSnapshot.character) {
                game.characters.set(player.id, returningSnapshot.character);
            }
            if (returningSnapshot.revealed) {
                game.revealedPlayers.add(player.id);
            }
            game.recentlyLeft.delete(player.id);
        }
    }
    if (playerSecret) game.secrets.set(player.id, playerSecret);
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

    // Every player needs a character. The Start button waits for that too,
    // but a player can join at the very moment it is pressed
    if (game.players.some(p => !game.characters.has(p.id))) {
        return { success: false, error: 'Every player needs a character to start' };
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
    game.recentlyLeft.clear(); // the old round's leavers get no special treatment
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

// Remove a player from a game voluntarily ("leave game").
// Deletes the player's card, their character and their reveal status.
// Characters they assigned to OTHER players stay in place.
// When the last player leaves, the game itself is deleted.
function removePlayerFromGame(games, gameId, playerId) {
    if (!games.has(gameId)) {
        return { success: false, error: 'Game not found' };
    }

    const game = games.get(gameId);

    const playerIndex = game.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
        return { success: false, error: 'Player not found in game' };
    }

    const removedPlayer = game.players[playerIndex];

    // Leaving a started round is undoable: snapshot what the player had so
    // they can return to the SAME round with their character and status.
    // (Waiting-lobby leaves need no snapshot - anyone can join a lobby.)
    if (game.state === 'started') {
        game.recentlyLeft.set(playerId, {
            secret: game.secrets.get(playerId), // only the same browser may come back
            stickerColor: removedPlayer.stickerColor,
            character: game.characters.get(playerId) || null,
            revealed: game.revealedPlayers.has(playerId),
            joinedAt: removedPlayer.joinedAt, // restores their list position
            leftAt: Date.now()
        });
    }

    game.players.splice(playerIndex, 1);
    game.characters.delete(playerId);      // the leaver's own character disappears
    game.revealedPlayers.delete(playerId);
    game.secrets.delete(playerId);
    touchGame(game);

    // A game with zero players ceases to exist (server.js deletes its disk
    // backup too, so the old link cannot bring it back)
    const gameDeleted = game.players.length === 0;
    if (gameDeleted) {
        games.delete(gameId);
    }

    return {
        success: true,
        gameId,
        removedPlayer: { id: removedPlayer.id, name: removedPlayer.name },
        players: game.players,
        characters: Object.fromEntries(game.characters),
        revealedPlayers: Array.from(game.revealedPlayers),
        gameDeleted
    };
}

// Is this the secret of a player of this game? join-room asks before a
// socket may act for the player
function checkPlayerSecret(game, playerId, playerSecret) {
    return isValidPlayerId(playerSecret)
        && game.players.some(p => p.id === playerId)
        && game.secrets.get(playerId) === playerSecret;
}

// Validate room code format
function isValidRoomCode(code) {
    if (!code || typeof code !== 'string') {
        return false;
    }
    
    // Must be exactly 6 characters, alphanumeric
    return /^[A-Z0-9]{6}$/.test(code);
}

// A game as plain data, ready for JSON: what a player gets on joining the
// room, and what a disk backup holds (Maps and Sets become objects and
// arrays). The players' secrets go only into a backup, never to a page
function serializeGame(game, { withSecrets = false } = {}) {
    const data = {
        id: game.id,
        players: game.players,
        characters: Object.fromEntries(game.characters),
        state: game.state,
        revealedPlayers: Array.from(game.revealedPlayers),
        created: game.created
    };
    if (withSecrets) data.secrets = Object.fromEntries(game.secrets);
    return data;
}

// A Date from a saved value (a Date, or an ISO string after JSON), or null
function toDate(value) {
    const date = new Date(value);
    return (value && !Number.isNaN(date.getTime())) ? date : null;
}

// Rebuild a game from saved data: a disk backup (state), or a browser's copy
// sent to /api/recreate-game. The data comes from outside, so it passes the
// same checks a live game does, and whatever fails them is left out: a
// player without a valid ID, name or avatar, a character of nobody in the
// list, an unknown state. Returns null when there is no players list.
//
// Nobody is actually connected right after a restore - players are marked
// connected again when they rejoin. The fresh disconnectedAt gives every
// player the full ghost timeout to come back.
function restoreGame(roomCode, saved) {
    if (!saved || typeof saved !== 'object' || !Array.isArray(saved.players)) {
        return null;
    }

    const now = Date.now();
    const players = [];
    for (const savedPlayer of saved.players) {
        if (players.length === MAX_PLAYERS) break;
        if (!savedPlayer || typeof savedPlayer !== 'object') continue;

        const name = sanitizePlayerName(savedPlayer.name);
        const avatar = sanitizeAvatar(savedPlayer.avatar);
        if (!isValidPlayerId(savedPlayer.id) || !name || !avatar) continue;
        if (players.some(p => p.id === savedPlayer.id)) continue;

        players.push({
            id: savedPlayer.id,
            name,
            avatar,
            stickerColor: stickerColors.includes(savedPlayer.stickerColor)
                ? savedPlayer.stickerColor
                : assignUniqueColor(players),
            joinedAt: toDate(savedPlayer.joinedAt) || new Date(now),
            isConnected: false,
            disconnectedAt: now
        });
    }
    sortPlayersByJoinTime(players);

    const listed = new Set(players.map(p => p.id));
    const characters = new Map();
    const savedCharacters = (saved.characters && typeof saved.characters === 'object') ? saved.characters : {};
    for (const [playerId, data] of Object.entries(savedCharacters)) {
        if (!listed.has(playerId) || !data || typeof data !== 'object') continue;
        const character = sanitizeCharacter(data.character);
        if (!character) continue; // not a string, or empty
        characters.set(playerId, {
            character,
            assignedBy: isValidPlayerId(data.assignedBy) ? data.assignedBy : null,
            assignedAt: toDate(data.assignedAt) || new Date(now)
        });
    }

    // Only a player with a character can have revealed it
    const savedRevealed = Array.isArray(saved.revealedPlayers) ? saved.revealedPlayers : [];
    const revealedPlayers = new Set(savedRevealed.filter(playerId => characters.has(playerId)));

    // A player without a saved secret gets one recorded by their next join
    const secrets = new Map();
    const savedSecrets = (saved.secrets && typeof saved.secrets === 'object') ? saved.secrets : {};
    for (const [playerId, secret] of Object.entries(savedSecrets)) {
        if (listed.has(playerId) && isValidPlayerId(secret)) secrets.set(playerId, secret);
    }

    const game = {
        id: roomCode,
        players,
        characters,
        state: GAME_STATES.includes(saved.state) ? saved.state : 'waiting',
        revealedPlayers,
        recentlyLeft: new Map(),
        secrets,
        created: toDate(saved.created) || new Date(now)
    };
    touchGame(game);
    return game;
}

// Recreate a game from a browser's copy of it (saveGameStateToStorage in
// game-room.js), after the server lost the room
function recreateGameFromState(games, roomCode, savedGameState) {
    if (!savedGameState || typeof savedGameState !== 'object') {
        return { success: false, error: 'Failed to recreate game from saved state' };
    }

    // The browser's copy calls the state gameState. It holds no secrets and
    // must not set any: each player's next join records their own
    const game = restoreGame(roomCode, { ...savedGameState, state: savedGameState.gameState, secrets: undefined });
    if (!game) {
        return { success: false, error: 'Invalid saved game state: missing players' };
    }

    games.set(roomCode, game);
    return {
        success: true,
        gameId: roomCode,
        playersRestored: game.players.length,
        charactersRestored: game.characters.size,
        gameState: game.state
    };
}

// A page of this player has connected to the room: they are online.
// Returns the player, or null when they are not in the game
function markPlayerConnected(game, playerId) {
    const player = game.players.find(p => p.id === playerId);
    if (!player) return null;
    player.isConnected = true;
    delete player.disconnectedAt;
    touchGame(game);
    return player;
}

// The player's last page went away: they stay in the room, offline, and may
// come back (removeStaleDisconnectedPlayers removes a ghost later).
// Returns the player, or null when they are not in the game
function markPlayerDisconnected(game, playerId) {
    const player = game.players.find(p => p.id === playerId);
    if (!player) return null;
    player.isConnected = false;
    player.disconnectedAt = Date.now();
    touchGame(game);
    return player;
}

// Tracks which sockets belong to which player of which room. A player may
// have several: two tabs of one browser are the same player, and on a page
// refresh the browser opens the NEW socket before the OLD one reports its
// disconnect. A player goes offline only when their LAST socket goes, so
// neither a closed second tab nor a late disconnect after a refresh marks
// a player who is still playing as offline.
function createConnectionTracker() {
    const socketToPlayer = new Map(); // socketId -> { gameId, playerId }
    const playerSockets = new Map();  // "gameId playerId" -> Set of socketIds
    const keyOf = (gameId, playerId) => `${gameId} ${playerId}`;

    function forgetSocket(socketId) {
        const playerInfo = socketToPlayer.get(socketId);
        if (!playerInfo) return null;
        socketToPlayer.delete(socketId);

        const key = keyOf(playerInfo.gameId, playerInfo.playerId);
        const sockets = playerSockets.get(key);
        sockets.delete(socketId);
        if (sockets.size > 0) return null;
        playerSockets.delete(key);
        return playerInfo;
    }

    return {
        // Register a socket as one of the player's connections (a socket
        // belongs to one player: registering it again moves it)
        register(socketId, gameId, playerId) {
            forgetSocket(socketId);
            socketToPlayer.set(socketId, { gameId, playerId });
            const key = keyOf(gameId, playerId);
            if (!playerSockets.has(key)) playerSockets.set(key, new Set());
            playerSockets.get(key).add(socketId);
        },

        // Handle a socket disconnect.
        // Returns { gameId, playerId } if it was the player's last socket (the
        // player really went offline), or null if they still have another
        // one, or the socket is unknown
        unregister(socketId) {
            return forgetSocket(socketId);
        },

        // The player left the room: none of their sockets speaks for them any more
        unregisterPlayer(gameId, playerId) {
            const key = keyOf(gameId, playerId);
            for (const socketId of playerSockets.get(key) || []) {
                socketToPlayer.delete(socketId);
            }
            playerSockets.delete(key);
        },

        // The player this socket speaks for: { gameId, playerId }, or null
        getPlayer(socketId) {
            return socketToPlayer.get(socketId) || null;
        },

        get size() {
            return socketToPlayer.size;
        }
    };
}

// How long a disconnected player stays in the room before being removed.
// Long enough to survive a locked phone or a network drop (Socket.IO takes
// ~2 minutes to even notice a disconnect), short enough that a "ghost" -
// the same person who came back under a NEW player ID (cleared localStorage,
// messenger in-app browser, installed PWA) - stops blocking Start Game soon.
const MAX_DISCONNECTED_MS = 10 * 60 * 1000;

// Remove players who have been disconnected for longer than maxDisconnectedMs.
// Runs from the keep-alive cycle. A removed player is not locked out: if they
// come back with the same ID they simply rejoin (in a started round they are
// restored from the recentlyLeft snapshot that removePlayerFromGame creates).
// Returns one removePlayerFromGame result per removed player (plus gameId and
// playerName) so the server can broadcast each removal as 'player-left'.
function removeStaleDisconnectedPlayers(games, maxDisconnectedMs = MAX_DISCONNECTED_MS) {
    const now = Date.now();
    const removals = [];

    for (const [gameId, game] of games.entries()) {
        // Collect first, remove after - removing while looping over the
        // players array would skip entries
        const stalePlayerIds = [];
        for (const player of game.players) {
            if (player.isConnected) continue;

            if (!player.disconnectedAt) {
                // Games restored from disk or recreated from a client backup
                // have no disconnect timestamp - start the clock now, so the
                // player is removed on a LATER pass if nobody comes back
                player.disconnectedAt = now;
            } else if (now - player.disconnectedAt > maxDisconnectedMs) {
                stalePlayerIds.push(player.id);
            }
        }

        for (const playerId of stalePlayerIds) {
            // result already carries gameId, players, characters,
            // revealedPlayers and gameDeleted - everything a broadcast needs
            const result = removePlayerFromGame(games, gameId, playerId);
            if (result.success) {
                removals.push({ ...result, playerName: result.removedPlayer.name });
            }
        }
    }

    return removals;
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
    removePlayerFromGame,
    checkPlayerSecret,
    isValidRoomCode,
    assignUniqueColor,
    serializeGame,
    restoreGame,
    recreateGameFromState,
    sanitizePlayerName,
    sanitizeAvatar,
    sanitizeCharacter,
    isCustomAvatar,
    isValidPlayerId,
    touchGame,
    markPlayerConnected,
    markPlayerDisconnected,
    cleanupInactiveGames,
    removeStaleDisconnectedPlayers,
    createConnectionTracker,
    MAX_NAME_LENGTH,
    MAX_CHARACTER_LENGTH,
    MAX_CUSTOM_AVATAR_LENGTH
};