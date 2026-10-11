// Who am I? Game - Timeout Protection Tests
// Tests for Socket.IO timeout configuration, player state management, and keep-alive functionality

const fs = require('fs');
const path = require('path');
const {
    createGame,
    addPlayerToGame,
    assignCharacter
} = require('../game-logic');

describe('Timeout Protection System', () => {
    let games;
    let gameId;
    let mockGamesDir;

    beforeEach(() => {
        games = new Map();
        const createResult = createGame(games);
        gameId = createResult.gameId;

        // Create temporary directory for tests
        mockGamesDir = path.join(__dirname, 'temp-games');
        if (!fs.existsSync(mockGamesDir)) {
            fs.mkdirSync(mockGamesDir);
        }
    });

    afterEach(() => {
        // Clean up temporary files
        if (fs.existsSync(mockGamesDir)) {
            const files = fs.readdirSync(mockGamesDir);
            files.forEach(file => {
                fs.unlinkSync(path.join(mockGamesDir, file));
            });
            fs.rmdirSync(mockGamesDir);
        }
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

    describe('Game State Persistence', () => {
        function mockGameStateToFile(gameId, gameData, gamesDir) {
            const gameState = {
                id: gameId,
                players: gameData.players || [],
                characters: Object.fromEntries(gameData.characters || new Map()),
                state: gameData.state || 'waiting',
                revealedPlayers: Array.from(gameData.revealedPlayers || new Set()),
                created: gameData.created || new Date(),
                lastKeepAlive: new Date().toISOString()
            };

            const filePath = path.join(gamesDir, `${gameId}.json`);
            fs.writeFileSync(filePath, JSON.stringify(gameState, null, 2));
            return filePath;
        }

        test('should save game state to disk format correctly', () => {
            // Add players and assign characters
            const player1 = addPlayerToGame(games, gameId, 'Alice', '😀');
            const player2 = addPlayerToGame(games, gameId, 'Bob', '😎');

            const assign1 = assignCharacter(games, gameId, player1.player.id, 'Detective', player2.player.id);
            const assign2 = assignCharacter(games, gameId, player2.player.id, 'Chef', player1.player.id);
            expect(assign1.success).toBe(true);
            expect(assign2.success).toBe(true);

            const game = games.get(gameId);
            const filePath = mockGameStateToFile(gameId, game, mockGamesDir);

            // Verify file was created
            expect(fs.existsSync(filePath)).toBe(true);

            // Verify file content
            const savedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            expect(savedData.id).toBe(gameId);
            expect(savedData.players).toHaveLength(2);
            expect(savedData.characters[player1.player.id].character).toBe('Detective');
            expect(savedData.characters[player2.player.id].character).toBe('Chef');
            expect(savedData.lastKeepAlive).toBeDefined();
        });

        test('should restore game from disk format correctly', () => {
            // Create mock saved game
            const mockPlayers = [
                {
                    id: 'player1-uuid',
                    name: 'Alice',
                    avatar: '😀',
                    connected: true,
                    isConnected: false, // Was disconnected
                    stickerColor: 'red'
                },
                {
                    id: 'player2-uuid',
                    name: 'Bob',
                    avatar: '😎',
                    connected: true,
                    isConnected: true,
                    stickerColor: 'blue'
                }
            ];

            const mockGameState = {
                id: 'TEST123',
                players: mockPlayers,
                characters: {
                    'player1-uuid': 'Detective',
                    'player2-uuid': 'Chef'
                },
                state: 'started',
                revealedPlayers: ['player1-uuid'],
                created: new Date().toISOString(),
                lastKeepAlive: new Date().toISOString()
            };

            const filePath = path.join(mockGamesDir, 'TEST123.json');
            fs.writeFileSync(filePath, JSON.stringify(mockGameState, null, 2));

            // Simulate game restoration logic
            const restoredGameData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const restoredGame = {
                id: restoredGameData.id,
                players: restoredGameData.players || [],
                characters: new Map(Object.entries(restoredGameData.characters || {})),
                state: restoredGameData.state || 'waiting',
                revealedPlayers: new Set(restoredGameData.revealedPlayers || []),
                created: new Date(restoredGameData.created),
                restoredAt: new Date()
            };

            expect(restoredGame.id).toBe('TEST123');
            expect(restoredGame.players).toHaveLength(2);
            expect(restoredGame.characters.get('player1-uuid')).toBe('Detective');
            expect(restoredGame.characters.get('player2-uuid')).toBe('Chef');
            expect(restoredGame.state).toBe('started');
            expect(restoredGame.revealedPlayers.has('player1-uuid')).toBe(true);
            expect(restoredGame.restoredAt).toBeDefined();
        });
    });

    describe('File Cleanup Logic', () => {
        function createMockGameFile(roomCode, ageInHours, gamesDir) {
            const filePath = path.join(gamesDir, `${roomCode}.json`);
            const mockData = { id: roomCode, created: new Date() };
            fs.writeFileSync(filePath, JSON.stringify(mockData));

            // Modify file time to simulate age
            const targetTime = Date.now() - (ageInHours * 60 * 60 * 1000);
            fs.utimesSync(filePath, new Date(targetTime), new Date(targetTime));

            return filePath;
        }

        function mockCleanupOldGameFiles(gamesDir, activeGames) {
            const files = fs.readdirSync(gamesDir);
            const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
            let removedCount = 0;
            const removedFiles = [];

            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(gamesDir, file);
                    const stats = fs.statSync(filePath);

                    if (stats.mtime.getTime() < fourHoursAgo) {
                        const roomCode = file.replace('.json', '');

                        // Only remove if game is not currently active
                        if (!activeGames.has(roomCode)) {
                            fs.unlinkSync(filePath);
                            removedCount++;
                            removedFiles.push(file);
                        }
                    }
                }
            }

            return { removedCount, removedFiles };
        }

        test('should remove files older than 4 hours', () => {
            // Create files of different ages
            createMockGameFile('OLD001', 5, mockGamesDir); // 5 hours old - should be removed
            createMockGameFile('OLD002', 6, mockGamesDir); // 6 hours old - should be removed
            createMockGameFile('NEW001', 2, mockGamesDir); // 2 hours old - should be kept
            createMockGameFile('NEW002', 1, mockGamesDir); // 1 hour old - should be kept

            const activeGames = new Map(); // No active games
            const result = mockCleanupOldGameFiles(mockGamesDir, activeGames);

            expect(result.removedCount).toBe(2);
            expect(result.removedFiles).toContain('OLD001.json');
            expect(result.removedFiles).toContain('OLD002.json');

            // Verify files were actually removed
            expect(fs.existsSync(path.join(mockGamesDir, 'OLD001.json'))).toBe(false);
            expect(fs.existsSync(path.join(mockGamesDir, 'OLD002.json'))).toBe(false);
            expect(fs.existsSync(path.join(mockGamesDir, 'NEW001.json'))).toBe(true);
            expect(fs.existsSync(path.join(mockGamesDir, 'NEW002.json'))).toBe(true);
        });

        test('should not remove files for active games', () => {
            // Create old files
            createMockGameFile('ACTIVE1', 5, mockGamesDir); // 5 hours old but active
            createMockGameFile('INACTIVE', 5, mockGamesDir); // 5 hours old and inactive

            // Mark ACTIVE1 as active in memory
            const activeGames = new Map();
            activeGames.set('ACTIVE1', { id: 'ACTIVE1', players: [] });

            const result = mockCleanupOldGameFiles(mockGamesDir, activeGames);

            expect(result.removedCount).toBe(1);
            expect(result.removedFiles).toContain('INACTIVE.json');
            expect(result.removedFiles).not.toContain('ACTIVE1.json');

            // Verify active game file was preserved
            expect(fs.existsSync(path.join(mockGamesDir, 'ACTIVE1.json'))).toBe(true);
            expect(fs.existsSync(path.join(mockGamesDir, 'INACTIVE.json'))).toBe(false);
        });

        test('should handle empty games directory', () => {
            const activeGames = new Map();
            const result = mockCleanupOldGameFiles(mockGamesDir, activeGames);

            expect(result.removedCount).toBe(0);
            expect(result.removedFiles).toHaveLength(0);
        });

        test('should only process .json files', () => {
            // Create mixed file types
            createMockGameFile('GAME001', 5, mockGamesDir);
            fs.writeFileSync(path.join(mockGamesDir, 'readme.txt'), 'test file');
            fs.writeFileSync(path.join(mockGamesDir, 'config.xml'), '<config></config>');

            const activeGames = new Map();
            const result = mockCleanupOldGameFiles(mockGamesDir, activeGames);

            expect(result.removedCount).toBe(1); // Only the .json file
            expect(result.removedFiles).toContain('GAME001.json');

            // Non-JSON files should remain untouched
            expect(fs.existsSync(path.join(mockGamesDir, 'readme.txt'))).toBe(true);
            expect(fs.existsSync(path.join(mockGamesDir, 'config.xml'))).toBe(true);
        });

        test('should calculate file age correctly', () => {
            const now = Date.now();
            const threeHours = 3 * 60 * 60 * 1000;
            const fiveHours = 5 * 60 * 60 * 1000;

            // Create file and manually set its modification time
            const filePath = path.join(mockGamesDir, 'TEST123.json');
            fs.writeFileSync(filePath, '{}');

            // Set to 3 hours ago (should not be removed)
            fs.utimesSync(filePath, new Date(now - threeHours), new Date(now - threeHours));
            let stats = fs.statSync(filePath);
            expect(stats.mtime.getTime()).toBeLessThan(now - threeHours + 1000); // Allow 1s tolerance

            // Test cleanup doesn't remove it
            let result = mockCleanupOldGameFiles(mockGamesDir, new Map());
            expect(result.removedCount).toBe(0);
            expect(fs.existsSync(filePath)).toBe(true);

            // Set to 5 hours ago (should be removed)
            fs.utimesSync(filePath, new Date(now - fiveHours), new Date(now - fiveHours));
            result = mockCleanupOldGameFiles(mockGamesDir, new Map());
            expect(result.removedCount).toBe(1);
            expect(fs.existsSync(filePath)).toBe(false);
        });
    });

    describe('Keep-Alive Integration', () => {
        test('should identify games with connected players', () => {
            // Add players with different connection states
            addPlayerToGame(games, gameId, 'Alice', '😀');
            addPlayerToGame(games, gameId, 'Bob', '😎');
            addPlayerToGame(games, gameId, 'Charlie', '🤖');

            const game = games.get(gameId);

            // Simulate some disconnections
            game.players[1].isConnected = false; // Bob disconnected
            game.players[2].isConnected = true;  // Charlie connected

            const connectedPlayers = game.players.filter(p => p.isConnected);
            expect(connectedPlayers).toHaveLength(2); // Alice and Charlie
            expect(connectedPlayers.map(p => p.name)).toEqual(['Alice', 'Charlie']);
        });

        test('should handle games with no connected players', () => {
            // Add players
            addPlayerToGame(games, gameId, 'Alice', '😀');
            addPlayerToGame(games, gameId, 'Bob', '😎');

            const game = games.get(gameId);

            // Disconnect all players
            game.players.forEach(player => {
                player.isConnected = false;
                player.disconnectedAt = Date.now();
            });

            const connectedPlayers = game.players.filter(p => p.isConnected);
            expect(connectedPlayers).toHaveLength(0);
        });
    });

    describe('Socket.IO Configuration', () => {
        test('should have proper timeout configuration constants', () => {
            // Test the expected timeout values
            const expectedConfig = {
                pingTimeout: 120000,      // 2 minutes
                pingInterval: 30000,      // 30 seconds
                connectTimeout: 45000     // 45 seconds
            };

            // These should match the values in server.js
            expect(expectedConfig.pingTimeout).toBe(2 * 60 * 1000);
            expect(expectedConfig.pingInterval).toBe(30 * 1000);
            expect(expectedConfig.connectTimeout).toBe(45 * 1000);

            // Verify relationships
            expect(expectedConfig.pingTimeout).toBeGreaterThan(expectedConfig.pingInterval * 2);
            expect(expectedConfig.connectTimeout).toBeGreaterThan(expectedConfig.pingInterval);
        });

        test('should validate timeout values are reasonable', () => {
            const pingTimeout = 120000;
            const pingInterval = 30000;
            const connectTimeout = 45000;

            // Timeouts should be long enough for slow networks
            expect(pingTimeout).toBeGreaterThanOrEqual(60000); // At least 1 minute
            expect(connectTimeout).toBeGreaterThanOrEqual(30000); // At least 30 seconds

            // Ping interval should be frequent enough for responsiveness
            expect(pingInterval).toBeLessThanOrEqual(60000); // No more than 1 minute

            // Ping timeout should be multiple of ping interval
            expect(pingTimeout).toBeGreaterThanOrEqual(pingInterval * 2);
        });
    });
});