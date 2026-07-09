// Tests for inactive game cleanup - prevents the in-memory games Map
// from growing forever (memory leak on long-running servers)

const {
    createGame,
    addPlayerToGame,
    assignCharacter,
    startGame,
    touchGame,
    cleanupInactiveGames
} = require('../game-logic');

const FOUR_HOURS = 4 * 60 * 60 * 1000;

describe('Inactive Game Cleanup', () => {
    let games;

    beforeEach(() => {
        games = new Map();
    });

    function createGameWithPlayers() {
        const gameId = createGame(games).gameId;
        const p1 = addPlayerToGame(games, gameId, 'Alice', '😀').player;
        const p2 = addPlayerToGame(games, gameId, 'Bob', '😎').player;
        return { gameId, p1, p2 };
    }

    test('game activity is tracked via lastActivityAt', () => {
        const { gameId, p1, p2 } = createGameWithPlayers();
        const game = games.get(gameId);

        expect(typeof game.lastActivityAt).toBe('number');

        // Any game action refreshes the activity timestamp
        game.lastActivityAt = 0;
        assignCharacter(games, gameId, p1.id, 'Batman', p2.id);
        expect(game.lastActivityAt).toBeGreaterThan(0);

        game.lastActivityAt = 0;
        assignCharacter(games, gameId, p2.id, 'Superman', p1.id);
        startGame(games, gameId, p1.id);
        expect(game.lastActivityAt).toBeGreaterThan(0);
    });

    test('removes games with no connected players after long inactivity', () => {
        const { gameId, p1, p2 } = createGameWithPlayers();
        const game = games.get(gameId);

        // Simulate: everyone disconnected 5 hours ago
        game.players.forEach(p => { p.isConnected = false; });
        game.lastActivityAt = Date.now() - 5 * 60 * 60 * 1000;

        const removed = cleanupInactiveGames(games, FOUR_HOURS);

        expect(removed).toEqual([gameId]);
        expect(games.has(gameId)).toBe(false);
    });

    test('keeps games that have connected players, even after long inactivity', () => {
        const { gameId } = createGameWithPlayers();
        const game = games.get(gameId);

        // Old game, but one player is still connected
        game.lastActivityAt = Date.now() - 10 * 60 * 60 * 1000;
        game.players[0].isConnected = true;
        game.players[1].isConnected = false;

        const removed = cleanupInactiveGames(games, FOUR_HOURS);

        expect(removed).toEqual([]);
        expect(games.has(gameId)).toBe(true);
    });

    test('keeps recently active games with no connected players', () => {
        const { gameId } = createGameWithPlayers();
        const game = games.get(gameId);

        // Everyone just disconnected (e.g. page refresh in progress)
        game.players.forEach(p => { p.isConnected = false; });
        touchGame(game);

        const removed = cleanupInactiveGames(games, FOUR_HOURS);

        expect(removed).toEqual([]);
        expect(games.has(gameId)).toBe(true);
    });

    test('keeps empty just-created games until they expire', () => {
        const gameId = createGame(games).gameId;

        // Just created - must survive
        expect(cleanupInactiveGames(games, FOUR_HOURS)).toEqual([]);
        expect(games.has(gameId)).toBe(true);

        // Created long ago and nobody ever joined - must be removed
        games.get(gameId).lastActivityAt = Date.now() - 5 * 60 * 60 * 1000;
        expect(cleanupInactiveGames(games, FOUR_HOURS)).toEqual([gameId]);
        expect(games.has(gameId)).toBe(false);
    });

    test('handles multiple games independently', () => {
        const activeGame = createGameWithPlayers();
        const staleGame = createGameWithPlayers();

        const stale = games.get(staleGame.gameId);
        stale.players.forEach(p => { p.isConnected = false; });
        stale.lastActivityAt = Date.now() - 5 * 60 * 60 * 1000;

        const removed = cleanupInactiveGames(games, FOUR_HOURS);

        expect(removed).toEqual([staleGame.gameId]);
        expect(games.has(activeGame.gameId)).toBe(true);
        expect(games.has(staleGame.gameId)).toBe(false);
    });
});
