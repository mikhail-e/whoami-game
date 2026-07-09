// Tests for server-side input validation and character locking
// These protect against malformed/hostile input from modified clients
// and against late events (e.g. blur firing after the game started)

const {
    createGame,
    addPlayerToGame,
    assignCharacter,
    startGame,
    restartGame,
    sanitizePlayerName,
    sanitizeAvatar,
    sanitizeCharacter
} = require('../game-logic');

describe('Input Validation', () => {
    describe('sanitizePlayerName', () => {
        test('accepts a normal name', () => {
            expect(sanitizePlayerName('Alice')).toBe('Alice');
        });

        test('trims whitespace', () => {
            expect(sanitizePlayerName('  Alice  ')).toBe('Alice');
        });

        test('rejects empty and whitespace-only names', () => {
            expect(sanitizePlayerName('')).toBeNull();
            expect(sanitizePlayerName('   ')).toBeNull();
        });

        test('rejects names longer than 20 characters', () => {
            expect(sanitizePlayerName('A'.repeat(21))).toBeNull();
            expect(sanitizePlayerName('A'.repeat(20))).toBe('A'.repeat(20));
        });

        test('rejects non-string values', () => {
            expect(sanitizePlayerName(null)).toBeNull();
            expect(sanitizePlayerName(undefined)).toBeNull();
            expect(sanitizePlayerName(123)).toBeNull();
            expect(sanitizePlayerName({ name: 'Alice' })).toBeNull();
        });
    });

    describe('sanitizeAvatar', () => {
        test('accepts emoji avatars, including multi-codepoint ones', () => {
            expect(sanitizeAvatar('😀')).toBe('😀');
            expect(sanitizeAvatar('🐦‍⬛')).toBe('🐦‍⬛');
        });

        test('rejects empty, oversized and non-string avatars', () => {
            expect(sanitizeAvatar('')).toBeNull();
            expect(sanitizeAvatar('X'.repeat(11))).toBeNull();
            expect(sanitizeAvatar(null)).toBeNull();
            expect(sanitizeAvatar(42)).toBeNull();
        });
    });

    describe('sanitizeCharacter', () => {
        test('trims and keeps normal characters', () => {
            expect(sanitizeCharacter('  Batman  ')).toBe('Batman');
        });

        test('empty or missing character means "remove assignment"', () => {
            expect(sanitizeCharacter('')).toBe('');
            expect(sanitizeCharacter('   ')).toBe('');
            expect(sanitizeCharacter(null)).toBe('');
            expect(sanitizeCharacter(undefined)).toBe('');
        });

        test('truncates characters longer than 30 characters', () => {
            expect(sanitizeCharacter('A'.repeat(50))).toBe('A'.repeat(30));
        });

        test('rejects non-string values', () => {
            expect(sanitizeCharacter(123)).toBeNull();
            expect(sanitizeCharacter({ evil: true })).toBeNull();
        });
    });

    describe('addPlayerToGame validation', () => {
        let games, gameId;

        beforeEach(() => {
            games = new Map();
            gameId = createGame(games).gameId;
        });

        test('rejects invalid player names', () => {
            const result = addPlayerToGame(games, gameId, '   ', '😀');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid player name');
        });

        test('rejects names longer than 20 characters', () => {
            const result = addPlayerToGame(games, gameId, 'X'.repeat(100), '😀');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid player name');
        });

        test('rejects invalid avatars', () => {
            const result = addPlayerToGame(games, gameId, 'Alice', 'not-an-avatar');
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid avatar');
        });

        test('trims the player name before storing', () => {
            const result = addPlayerToGame(games, gameId, '  Alice  ', '😀');
            expect(result.success).toBe(true);
            expect(result.player.name).toBe('Alice');
        });
    });

    describe('assignCharacter validation and locking', () => {
        let games, gameId, playerId1, playerId2;

        beforeEach(() => {
            games = new Map();
            gameId = createGame(games).gameId;
            playerId1 = addPlayerToGame(games, gameId, 'Alice', '😀').player.id;
            playerId2 = addPlayerToGame(games, gameId, 'Bob', '😎').player.id;
        });

        test('trims and truncates the character text', () => {
            const result = assignCharacter(games, gameId, playerId1, '  ' + 'B'.repeat(50), playerId2);
            expect(result.success).toBe(true);
            expect(result.character).toBe('B'.repeat(30));
        });

        test('rejects non-string character values', () => {
            const result = assignCharacter(games, gameId, playerId1, { evil: true }, playerId2);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid character');
        });

        test('blocks character changes after the game has started', () => {
            assignCharacter(games, gameId, playerId1, 'Batman', playerId2);
            assignCharacter(games, gameId, playerId2, 'Superman', playerId1);
            startGame(games, gameId, playerId1);

            const result = assignCharacter(games, gameId, playerId1, 'Joker', playerId2);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Cannot change characters after the game has started');

            // Original character must be untouched
            const game = games.get(gameId);
            expect(game.characters.get(playerId1).character).toBe('Batman');
        });

        test('allows character changes again after restart', () => {
            assignCharacter(games, gameId, playerId1, 'Batman', playerId2);
            assignCharacter(games, gameId, playerId2, 'Superman', playerId1);
            startGame(games, gameId, playerId1);
            restartGame(games, gameId, playerId1);

            const result = assignCharacter(games, gameId, playerId1, 'Joker', playerId2);
            expect(result.success).toBe(true);
            expect(result.character).toBe('Joker');
        });
    });
});
