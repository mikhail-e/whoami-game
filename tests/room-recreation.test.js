// Who am I? Game - Room Recreation Tests
// Tests for automatic room recreation after server restart

const {
    createGame,
    addPlayerToGame,
    assignCharacter,
    startGame,
    recreateGameFromState,
    isValidRoomCode
} = require('../game-logic');

describe('Room Recreation System', () => {
    let games;

    beforeEach(() => {
        games = new Map();
    });

    describe('recreateGameFromState function', () => {
        test('should recreate a basic waiting game from saved state', () => {
            const roomCode = 'ABC123';
            const savedState = {
                roomCode: roomCode,
                playerId: 'player-1',
                playerName: 'Alice',
                playerAvatar: '😀',
                gameState: 'waiting',
                players: [
                    { id: 'player-1', name: 'Alice', avatar: '😀', stickerColor: 'red' },
                    { id: 'player-2', name: 'Bob', avatar: '😎', stickerColor: 'blue' }
                ],
                characters: {},
                revealedPlayers: [],
                lastSaved: new Date().toISOString()
            };

            const result = recreateGameFromState(games, roomCode, savedState);

            expect(result.success).toBe(true);
            expect(result.gameId).toBe(roomCode);
            expect(result.playersRestored).toBe(2);
            expect(result.charactersRestored).toBe(0);
            expect(result.gameState).toBe('waiting');

            // Verify game was created
            expect(games.has(roomCode)).toBe(true);
            const game = games.get(roomCode);
            expect(game.players).toHaveLength(2);
            expect(game.state).toBe('waiting');
        });

        test('should recreate a started game with characters from saved state', () => {
            const roomCode = 'XYZ789';
            const savedState = {
                roomCode: roomCode,
                playerId: 'player-1',
                playerName: 'Alice',
                playerAvatar: '😀',
                gameState: 'started',
                players: [
                    { id: 'player-1', name: 'Alice', avatar: '😀', stickerColor: 'red' },
                    { id: 'player-2', name: 'Bob', avatar: '😎', stickerColor: 'blue' }
                ],
                characters: {
                    'player-1': { character: 'Superman', assignedBy: 'player-2', assignedAt: new Date() },
                    'player-2': { character: 'Batman', assignedBy: 'player-1', assignedAt: new Date() }
                },
                revealedPlayers: ['player-1'],
                lastSaved: new Date().toISOString()
            };

            const result = recreateGameFromState(games, roomCode, savedState);

            expect(result.success).toBe(true);
            expect(result.gameId).toBe(roomCode);
            expect(result.playersRestored).toBe(2);
            expect(result.charactersRestored).toBe(2);
            expect(result.gameState).toBe('started');

            // Verify game state
            const game = games.get(roomCode);
            expect(game.state).toBe('started');
            expect(game.characters.get('player-1').character).toBe('Superman');
            expect(game.characters.get('player-2').character).toBe('Batman');
            expect(game.revealedPlayers.has('player-1')).toBe(true);
        });

        test('should handle missing or empty players array', () => {
            const roomCode = 'BAD001';
            const savedState = {
                gameState: 'waiting',
                characters: {},
                revealedPlayers: []
            };

            const result = recreateGameFromState(games, roomCode, savedState);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid saved game state: missing players');
            expect(games.has(roomCode)).toBe(false);
        });

        test('should handle invalid saved state structure', () => {
            const roomCode = 'BAD002';
            const savedState = null;

            const result = recreateGameFromState(games, roomCode, savedState);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to recreate game from saved state');
            expect(games.has(roomCode)).toBe(false);
        });

        test('should handle empty characters and revealedPlayers gracefully', () => {
            const roomCode = 'MIN123';
            const savedState = {
                players: [
                    { id: 'player-1', name: 'Alice', avatar: '😀', stickerColor: 'red' }
                ],
                gameState: 'waiting'
                // No characters or revealedPlayers fields
            };

            const result = recreateGameFromState(games, roomCode, savedState);

            expect(result.success).toBe(true);
            expect(result.gameId).toBe(roomCode);
            expect(result.playersRestored).toBe(1);
            expect(result.charactersRestored).toBe(0);

            const game = games.get(roomCode);
            expect(game.characters.size).toBe(0);
            expect(game.revealedPlayers.size).toBe(0);
        });

        test('should preserve player sticker colors during recreation', () => {
            const roomCode = 'COL123';
            const savedState = {
                players: [
                    { id: 'player-1', name: 'Alice', avatar: '😀', stickerColor: 'red' },
                    { id: 'player-2', name: 'Bob', avatar: '😎', stickerColor: 'blue' },
                    { id: 'player-3', name: 'Charlie', avatar: '🤖', stickerColor: 'purple' }
                ],
                gameState: 'started',
                characters: {},
                revealedPlayers: []
            };

            const result = recreateGameFromState(games, roomCode, savedState);

            expect(result.success).toBe(true);

            const game = games.get(roomCode);
            expect(game.players[0].stickerColor).toBe('red');
            expect(game.players[1].stickerColor).toBe('blue');
            expect(game.players[2].stickerColor).toBe('purple');
        });
    });

    describe('Room code validation for recreation', () => {
        test('should validate room code format using isValidRoomCode', () => {
            expect(isValidRoomCode('ABC123')).toBe(true);
            expect(isValidRoomCode('XYZ789')).toBe(true);
            expect(isValidRoomCode('000000')).toBe(true);
            expect(isValidRoomCode('ZZZZZZ')).toBe(true);
        });

        test('should reject invalid room code formats', () => {
            expect(isValidRoomCode('abc123')).toBe(false); // lowercase
            expect(isValidRoomCode('ABC12')).toBe(false);   // too short
            expect(isValidRoomCode('ABC1234')).toBe(false); // too long
            expect(isValidRoomCode('ABC12!')).toBe(false);  // special characters
            expect(isValidRoomCode('')).toBe(false);        // empty
            expect(isValidRoomCode(null)).toBe(false);      // null
            expect(isValidRoomCode(undefined)).toBe(false); // undefined
        });
    });

    describe('Integration scenarios', () => {
        test('should allow joining recreated game with original player ID', () => {
            const roomCode = 'INT123';

            // Original saved state
            const savedState = {
                players: [
                    { id: 'player-1', name: 'Alice', avatar: '😀', stickerColor: 'red' },
                    { id: 'player-2', name: 'Bob', avatar: '😎', stickerColor: 'blue' }
                ],
                gameState: 'started',
                characters: {
                    'player-1': { character: 'Superman', assignedBy: 'player-2' },
                    'player-2': { character: 'Batman', assignedBy: 'player-1' }
                },
                revealedPlayers: []
            };

            // Recreate the game
            const recreateResult = recreateGameFromState(games, roomCode, savedState);
            expect(recreateResult.success).toBe(true);

            // Original player should be able to reconnect
            const joinResult = addPlayerToGame(games, roomCode, 'Alice', '😀', 'player-1');
            expect(joinResult.success).toBe(true);
            expect(joinResult.isNewPlayer).toBe(false); // Reconnection
            expect(joinResult.player.id).toBe('player-1');
            expect(joinResult.player.stickerColor).toBe('red');
        });

        test('should handle new players joining recreated game', () => {
            const roomCode = 'NEW123';

            // Recreate game in waiting state
            const savedState = {
                players: [
                    { id: 'player-1', name: 'Alice', avatar: '😀', stickerColor: 'red' }
                ],
                gameState: 'waiting',
                characters: {},
                revealedPlayers: []
            };

            recreateGameFromState(games, roomCode, savedState);

            // New player should be able to join
            const joinResult = addPlayerToGame(games, roomCode, 'Bob', '😎');
            expect(joinResult.success).toBe(true);
            expect(joinResult.isNewPlayer).toBe(true);
            expect(joinResult.player.stickerColor).toBe('blue'); // Next available color
        });

        test('should prevent joining recreated game in started state', () => {
            const roomCode = 'BLOCK1';

            // Recreate game in started state
            const savedState = {
                players: [
                    { id: 'player-1', name: 'Alice', avatar: '😀', stickerColor: 'red' }
                ],
                gameState: 'started',
                characters: {},
                revealedPlayers: []
            };

            recreateGameFromState(games, roomCode, savedState);

            // New player should not be able to join started game
            const joinResult = addPlayerToGame(games, roomCode, 'Bob', '😎');
            expect(joinResult.success).toBe(false);
            expect(joinResult.error).toBe('Game has already started');
        });

        test('should preserve character assignments after recreation', () => {
            const roomCode = 'CHAR01';

            // Create game with character assignments
            const savedState = {
                players: [
                    { id: 'player-1', name: 'Alice', avatar: '😀', stickerColor: 'red' },
                    { id: 'player-2', name: 'Bob', avatar: '😎', stickerColor: 'blue' }
                ],
                gameState: 'started',
                characters: {
                    'player-1': { character: 'Wonder Woman', assignedBy: 'player-2', assignedAt: new Date() },
                    'player-2': { character: 'Flash', assignedBy: 'player-1', assignedAt: new Date() }
                },
                revealedPlayers: ['player-2']
            };

            recreateGameFromState(games, roomCode, savedState);

            const game = games.get(roomCode);

            // Check character assignments preserved
            expect(game.characters.get('player-1').character).toBe('Wonder Woman');
            expect(game.characters.get('player-2').character).toBe('Flash');
            expect(game.characters.get('player-1').assignedBy).toBe('player-2');
            expect(game.characters.get('player-2').assignedBy).toBe('player-1');

            // Check revealed status preserved
            expect(game.revealedPlayers.has('player-2')).toBe(true);
            expect(game.revealedPlayers.has('player-1')).toBe(false);
        });

        test('should handle large games with many players and characters', () => {
            const roomCode = 'LARGE1';
            const players = [];
            const characters = {};
            const revealedPlayers = [];

            // Create 10 players
            for (let i = 1; i <= 10; i++) {
                players.push({
                    id: `player-${i}`,
                    name: `Player${i}`,
                    avatar: '😀',
                    stickerColor: ['red', 'blue', 'purple', 'orange', 'green', 'pink', 'indigo'][i % 7]
                });

                if (i <= 8) {
                    characters[`player-${i}`] = {
                        character: `Character${i}`,
                        assignedBy: `player-${i === 10 ? 1 : i + 1}`,
                        assignedAt: new Date()
                    };
                }

                if (i <= 3) {
                    revealedPlayers.push(`player-${i}`);
                }
            }

            const savedState = {
                players,
                gameState: 'started',
                characters,
                revealedPlayers
            };

            const result = recreateGameFromState(games, roomCode, savedState);

            expect(result.success).toBe(true);
            expect(result.playersRestored).toBe(10);
            expect(result.charactersRestored).toBe(8);

            const game = games.get(roomCode);
            expect(game.players).toHaveLength(10);
            expect(game.characters.size).toBe(8);
            expect(game.revealedPlayers.size).toBe(3);
        });
    });

    describe('Error handling and edge cases', () => {
        test('should handle malformed character data', () => {
            const roomCode = 'MAL001';
            const savedState = {
                players: [
                    { id: 'player-1', name: 'Alice', avatar: '😀', stickerColor: 'red' }
                ],
                gameState: 'waiting',
                characters: 'invalid-characters-format', // Should be object
                revealedPlayers: []
            };

            const result = recreateGameFromState(games, roomCode, savedState);

            expect(result.success).toBe(true);
            // Should handle gracefully and create empty characters Map
            const game = games.get(roomCode);
            expect(game.characters.size).toBe(0);
        });

        test('should handle malformed revealedPlayers data', () => {
            const roomCode = 'MAL002';
            const savedState = {
                players: [
                    { id: 'player-1', name: 'Alice', avatar: '😀', stickerColor: 'red' }
                ],
                gameState: 'waiting',
                characters: {},
                revealedPlayers: 'invalid-revealed-format' // Should be array
            };

            const result = recreateGameFromState(games, roomCode, savedState);

            expect(result.success).toBe(true);
            // Should handle gracefully and create empty revealedPlayers Set
            const game = games.get(roomCode);
            expect(game.revealedPlayers.size).toBe(0);
        });

        test('should add recreation timestamp', () => {
            const roomCode = 'TIME01';
            const savedState = {
                players: [
                    { id: 'player-1', name: 'Alice', avatar: '😀', stickerColor: 'red' }
                ],
                gameState: 'waiting',
                characters: {},
                revealedPlayers: []
            };

            const beforeRecreation = new Date();
            const result = recreateGameFromState(games, roomCode, savedState);
            const afterRecreation = new Date();

            expect(result.success).toBe(true);

            const game = games.get(roomCode);
            expect(game.recreatedAt).toBeDefined();
            expect(game.recreatedAt).toBeInstanceOf(Date);
            expect(game.recreatedAt.getTime()).toBeGreaterThanOrEqual(beforeRecreation.getTime());
            expect(game.recreatedAt.getTime()).toBeLessThanOrEqual(afterRecreation.getTime());
        });
    });
});