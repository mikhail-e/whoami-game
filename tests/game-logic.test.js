// Who am I? Game - Unit Tests for Core Logic
const {
    generateRoomCode,
    createGame,
    addPlayerToGame,
    assignCharacter,
    isValidRoomCode
} = require('../game-logic');

describe('Room Code Generation', () => {
    test('generates a 6-character room code', () => {
        const code = generateRoomCode();
        expect(code).toHaveLength(6);
    });

    test('generates room code with only uppercase letters and numbers', () => {
        const code = generateRoomCode();
        expect(code).toMatch(/^[A-Z0-9]{6}$/);
    });

    test('generates unique room codes', () => {
        const code1 = generateRoomCode();
        const code2 = generateRoomCode();
        const code3 = generateRoomCode();
        
        expect(code1).not.toBe(code2);
        expect(code2).not.toBe(code3);
        expect(code1).not.toBe(code3);
    });

    test('generates codes 100 times without duplicates (statistical test)', () => {
        const codes = new Set();
        for (let i = 0; i < 100; i++) {
            codes.add(generateRoomCode());
        }
        // We should have close to 100 unique codes (allowing for small chance of collision)
        expect(codes.size).toBeGreaterThan(95);
    });
});

describe('Room Code Validation', () => {
    test('validates correct room codes', () => {
        expect(isValidRoomCode('ABC123')).toBe(true);
        expect(isValidRoomCode('XYZ789')).toBe(true);
        expect(isValidRoomCode('000000')).toBe(true);
        expect(isValidRoomCode('ZZZZZZ')).toBe(true);
    });

    test('rejects invalid room codes', () => {
        expect(isValidRoomCode('')).toBe(false);
        expect(isValidRoomCode('ABC12')).toBe(false); // Too short
        expect(isValidRoomCode('ABC1234')).toBe(false); // Too long
        expect(isValidRoomCode('abc123')).toBe(false); // Lowercase
        expect(isValidRoomCode('ABC12!')).toBe(false); // Special characters
        expect(isValidRoomCode(null)).toBe(false);
        expect(isValidRoomCode(undefined)).toBe(false);
        expect(isValidRoomCode(123456)).toBe(false); // Number instead of string
    });
});

describe('Game Creation', () => {
    let games;

    beforeEach(() => {
        games = new Map();
    });

    test('creates a new game successfully', () => {
        const result = createGame(games);
        
        expect(result.success).toBe(true);
        expect(result.gameId).toHaveLength(6);
        expect(games.has(result.gameId)).toBe(true);
    });

    test('creates game with correct initial structure', () => {
        const result = createGame(games);
        const game = games.get(result.gameId);
        
        expect(game).toMatchObject({
            id: result.gameId,
            players: [],
            created: expect.any(Date)
        });
        expect(game.characters).toBeInstanceOf(Map);
    });

    test('creates unique game IDs', () => {
        const result1 = createGame(games);
        const result2 = createGame(games);
        const result3 = createGame(games);
        
        expect(result1.gameId).not.toBe(result2.gameId);
        expect(result2.gameId).not.toBe(result3.gameId);
        expect(games.size).toBe(3);
    });
});

describe('Player Joining', () => {
    let games;
    let gameId;

    beforeEach(() => {
        games = new Map();
        const createResult = createGame(games);
        gameId = createResult.gameId;
    });

    test('adds new player successfully', () => {
        const result = addPlayerToGame(games, gameId, 'Alice', '😀');
        
        expect(result.success).toBe(true);
        expect(result.isNewPlayer).toBe(true);
        expect(result.player).toMatchObject({
            name: 'Alice',
            avatar: '😀',
            connected: true
        });
        expect(result.player.id).toBeDefined();
        expect(result.game.players).toHaveLength(1);
    });

    test('handles player reconnection', () => {
        // First join
        const firstResult = addPlayerToGame(games, gameId, 'Alice', '😀');
        const playerId = firstResult.player.id;
        
        // Reconnect with same name
        const secondResult = addPlayerToGame(games, gameId, 'Alice', '😎');
        
        expect(secondResult.success).toBe(true);
        expect(secondResult.isNewPlayer).toBe(false);
        expect(secondResult.player.id).toBe(playerId); // Same player ID
        expect(secondResult.player.avatar).toBe('😎'); // Updated avatar
        expect(secondResult.game.players).toHaveLength(1); // Still only 1 player
    });

    test('allows multiple different players to join', () => {
        addPlayerToGame(games, gameId, 'Alice', '😀');
        addPlayerToGame(games, gameId, 'Bob', '😎');
        addPlayerToGame(games, gameId, 'Charlie', '🤖');
        
        const game = games.get(gameId);
        expect(game.players).toHaveLength(3);
        
        const playerNames = game.players.map(p => p.name);
        expect(playerNames).toContain('Alice');
        expect(playerNames).toContain('Bob');
        expect(playerNames).toContain('Charlie');
    });

    test('enforces maximum player limit (12 players)', () => {
        // Add 12 players
        for (let i = 1; i <= 12; i++) {
            const result = addPlayerToGame(games, gameId, `Player${i}`, '😀');
            expect(result.success).toBe(true);
        }
        
        // Try to add 13th player
        const result = addPlayerToGame(games, gameId, 'Player13', '😀');
        expect(result.success).toBe(false);
        expect(result.error).toBe('Game is full');
    });

    test('returns error for non-existent game', () => {
        const result = addPlayerToGame(games, 'INVALID', 'Alice', '😀');
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Game not found');
    });

    test('validates player data', () => {
        const game = games.get(gameId);
        const result = addPlayerToGame(games, gameId, 'Alice', '😀');
        
        expect(result.player).toMatchObject({
            id: expect.any(String),
            name: 'Alice',
            avatar: '😀',
            connected: true,
            joinedAt: expect.any(Date)
        });
    });
});

describe('Character Assignment', () => {
    let games;
    let gameId;
    let playerId1;
    let playerId2;

    beforeEach(() => {
        games = new Map();
        const createResult = createGame(games);
        gameId = createResult.gameId;
        
        // Add two players
        const player1Result = addPlayerToGame(games, gameId, 'Alice', '😀');
        const player2Result = addPlayerToGame(games, gameId, 'Bob', '😎');
        
        playerId1 = player1Result.player.id;
        playerId2 = player2Result.player.id;
    });

    test('assigns character successfully', () => {
        const result = assignCharacter(games, gameId, playerId1, 'Albert Einstein', playerId2);
        
        expect(result.success).toBe(true);
        expect(result.playerId).toBe(playerId1);
        expect(result.character).toBe('Albert Einstein');
        expect(result.assignedBy).toBe(playerId2);
        expect(result.characters).toHaveProperty(playerId1);
    });

    test('stores character assignment in game state', () => {
        assignCharacter(games, gameId, playerId1, 'Spider-Man', playerId2);
        
        const game = games.get(gameId);
        const characterData = game.characters.get(playerId1);
        
        expect(characterData).toMatchObject({
            character: 'Spider-Man',
            assignedBy: playerId2,
            assignedAt: expect.any(Date)
        });
    });

    test('allows multiple character assignments', () => {
        assignCharacter(games, gameId, playerId1, 'Batman', playerId2);
        assignCharacter(games, gameId, playerId2, 'Superman', playerId1);
        
        const game = games.get(gameId);
        expect(game.characters.size).toBe(2);
        expect(game.characters.get(playerId1).character).toBe('Batman');
        expect(game.characters.get(playerId2).character).toBe('Superman');
    });

    test('allows character reassignment (editing)', () => {
        // Initial assignment
        assignCharacter(games, gameId, playerId1, 'Batman', playerId2);
        
        // Reassign
        assignCharacter(games, gameId, playerId1, 'Wonder Woman', playerId2);
        
        const game = games.get(gameId);
        const characterData = game.characters.get(playerId1);
        expect(characterData.character).toBe('Wonder Woman');
    });

    test('returns error for non-existent game', () => {
        const result = assignCharacter(games, 'INVALID', playerId1, 'Batman', playerId2);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Game not found');
    });

    test('returns error for non-existent player', () => {
        const result = assignCharacter(games, gameId, 'invalid-player-id', 'Batman', playerId2);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Player not found in game');
    });

    test('handles various character names', () => {
        const characters = [
            'Albert Einstein',
            'Spider-Man',
            'Mickey Mouse',
            'Barack Obama',
            'Hermione Granger',
            'Tony Stark'
        ];
        
        characters.forEach((character, index) => {
            const result = assignCharacter(games, gameId, playerId1, character, playerId2);
            expect(result.success).toBe(true);
            expect(result.character).toBe(character);
        });
    });

    test('prevents players from assigning characters to themselves', () => {
        const result = assignCharacter(games, gameId, playerId1, 'Batman', playerId1);
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Cannot assign character to yourself');
    });

    test('validates that assigner exists in game', () => {
        const result = assignCharacter(games, gameId, playerId1, 'Batman', 'invalid-assigner-id');
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Assigner not found in game');
    });

    test('allows player to assign characters to multiple other players', () => {
        // Player 1 assigns to Player 2
        const result1 = assignCharacter(games, gameId, playerId2, 'Batman', playerId1);
        expect(result1.success).toBe(true);
        
        // Add a third player
        const player3Result = addPlayerToGame(games, gameId, 'Charlie', '🤖');
        const playerId3 = player3Result.player.id;
        
        // Player 1 also assigns to Player 3
        const result2 = assignCharacter(games, gameId, playerId3, 'Superman', playerId1);
        expect(result2.success).toBe(true);
        
        // Verify both assignments exist
        const game = games.get(gameId);
        expect(game.characters.get(playerId2).character).toBe('Batman');
        expect(game.characters.get(playerId3).character).toBe('Superman');
        expect(game.characters.get(playerId2).assignedBy).toBe(playerId1);
        expect(game.characters.get(playerId3).assignedBy).toBe(playerId1);
    });
});