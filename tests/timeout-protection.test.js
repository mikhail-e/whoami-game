// Who am I? Game - Timeout Protection Tests
// Player connection state: a reconnecting player keeps everything they had
// (the disk backups are tested in game-backup.test.js)

const {
    createGame,
    addPlayerToGame,
    assignCharacter
} = require('../game-logic');

describe('Timeout Protection System', () => {
    let games;
    let gameId;

    beforeEach(() => {
        games = new Map();
        const createResult = createGame(games);
        gameId = createResult.gameId;
    });

    describe('Player Connection State Management', () => {
        test('new players should have connection properties', () => {
            const result = addPlayerToGame(games, gameId, 'Alice', '😀');

            expect(result.success).toBe(true);
            expect(result.player.connected).toBe(true);
            expect(result.player.isConnected).toBe(true);
            expect(result.player.connectedAt).toBeDefined();
            expect(typeof result.player.connectedAt).toBe('number');
            expect(result.player.joinedAt).toBeDefined();
        });

        test('reconnecting players should update connection status', (done) => {
            // Add player initially
            const firstResult = addPlayerToGame(games, gameId, 'Alice', '😀');
            const playerId = firstResult.player.id;
            const originalConnectedAt = firstResult.player.connectedAt;

            // Simulate disconnection
            const game = games.get(gameId);
            const player = game.players.find(p => p.id === playerId);
            player.isConnected = false;
            player.disconnectedAt = Date.now();

            // Wait a moment to ensure different timestamp
            setTimeout(() => {
                // Reconnect player
                const reconnectResult = addPlayerToGame(games, gameId, 'Alice', '😀', playerId);

                expect(reconnectResult.success).toBe(true);
                expect(reconnectResult.isNewPlayer).toBe(false);
                expect(reconnectResult.player.isConnected).toBe(true);
                expect(reconnectResult.player.connected).toBe(true);
                expect(reconnectResult.player.connectedAt).toBeGreaterThan(originalConnectedAt);
                expect(reconnectResult.player.disconnectedAt).toBeUndefined();
                done();
            }, 10);
        });

        test('should preserve player data during reconnection', () => {
            // Add two players (one to assign character to the other)
            const playerResult = addPlayerToGame(games, gameId, 'Alice', '😀');
            const assignerResult = addPlayerToGame(games, gameId, 'Bob', '😎');
            const playerId = playerResult.player.id;
            const assignerId = assignerResult.player.id;
            const originalColor = playerResult.player.stickerColor;

            const assignResult = assignCharacter(games, gameId, playerId, 'Secret Agent', assignerId);
            expect(assignResult.success).toBe(true);

            // Simulate reconnection
            const reconnectResult = addPlayerToGame(games, gameId, 'Alice', '🤖', playerId);

            expect(reconnectResult.success).toBe(true);
            expect(reconnectResult.player.id).toBe(playerId);
            expect(reconnectResult.player.stickerColor).toBe(originalColor);
            expect(reconnectResult.player.avatar).toBe('🤖'); // Avatar can be updated

            // Character should be preserved
            const game = games.get(gameId);
            const characterData = game.characters.get(playerId);
            expect(characterData.character).toBe('Secret Agent');
            expect(characterData.assignedBy).toBe(assignerId);
        });
    });
});
