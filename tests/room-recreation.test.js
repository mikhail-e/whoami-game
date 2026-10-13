// Who am I? Game - Room Recreation Tests
// Tests for automatic room recreation after server restart

const {
    addPlayerToGame,
    recreateGameFromState,
    isValidRoomCode,
    MAX_NAME_LENGTH
} = require('../game-logic');

// Player IDs are UUIDs: id(1), id(2), ... in the saved states below
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

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
                playerId: id(1),
                playerName: 'Alice',
                playerAvatar: '😀',
                gameState: 'waiting',
                players: [
                    { id: id(1), name: 'Alice', avatar: '😀', stickerColor: 'red' },
                    { id: id(2), name: 'Bob', avatar: '😎', stickerColor: 'blue' }
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
                playerId: id(1),
                playerName: 'Alice',
                playerAvatar: '😀',
                gameState: 'started',
                players: [
                    { id: id(1), name: 'Alice', avatar: '😀', stickerColor: 'red' },
                    { id: id(2), name: 'Bob', avatar: '😎', stickerColor: 'blue' }
                ],
                characters: {
                    [id(1)]: { character: 'Superman', assignedBy: id(2), assignedAt: new Date() },
                    [id(2)]: { character: 'Batman', assignedBy: id(1), assignedAt: new Date() }
                },
                revealedPlayers: [id(1)],
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
            expect(game.characters.get(id(1)).character).toBe('Superman');
            expect(game.characters.get(id(2)).character).toBe('Batman');
            expect(game.revealedPlayers.has(id(1))).toBe(true);
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
                    { id: id(1), name: 'Alice', avatar: '😀', stickerColor: 'red' }
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
                    { id: id(1), name: 'Alice', avatar: '😀', stickerColor: 'red' },
                    { id: id(2), name: 'Bob', avatar: '😎', stickerColor: 'blue' },
                    { id: id(3), name: 'Charlie', avatar: '🤖', stickerColor: 'purple' }
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
                    { id: id(1), name: 'Alice', avatar: '😀', stickerColor: 'red' },
                    { id: id(2), name: 'Bob', avatar: '😎', stickerColor: 'blue' }
                ],
                gameState: 'started',
                characters: {
                    [id(1)]: { character: 'Superman', assignedBy: id(2) },
                    [id(2)]: { character: 'Batman', assignedBy: id(1) }
                },
                revealedPlayers: []
            };

            // Recreate the game
            const recreateResult = recreateGameFromState(games, roomCode, savedState);
            expect(recreateResult.success).toBe(true);

            // Original player should be able to reconnect
            const joinResult = addPlayerToGame(games, roomCode, 'Alice', '😀', id(1));
            expect(joinResult.success).toBe(true);
            expect(joinResult.isNewPlayer).toBe(false); // Reconnection
            expect(joinResult.player.id).toBe(id(1));
            expect(joinResult.player.stickerColor).toBe('red');
        });

        test('should handle new players joining recreated game', () => {
            const roomCode = 'NEW123';

            // Recreate game in waiting state
            const savedState = {
                players: [
                    { id: id(1), name: 'Alice', avatar: '😀', stickerColor: 'red' }
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
                    { id: id(1), name: 'Alice', avatar: '😀', stickerColor: 'red' }
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
                    { id: id(1), name: 'Alice', avatar: '😀', stickerColor: 'red' },
                    { id: id(2), name: 'Bob', avatar: '😎', stickerColor: 'blue' }
                ],
                gameState: 'started',
                characters: {
                    [id(1)]: { character: 'Wonder Woman', assignedBy: id(2), assignedAt: new Date() },
                    [id(2)]: { character: 'Flash', assignedBy: id(1), assignedAt: new Date() }
                },
                revealedPlayers: [id(2)]
            };

            recreateGameFromState(games, roomCode, savedState);

            const game = games.get(roomCode);

            // Check character assignments preserved
            expect(game.characters.get(id(1)).character).toBe('Wonder Woman');
            expect(game.characters.get(id(2)).character).toBe('Flash');
            expect(game.characters.get(id(1)).assignedBy).toBe(id(2));
            expect(game.characters.get(id(2)).assignedBy).toBe(id(1));

            // Check revealed status preserved
            expect(game.revealedPlayers.has(id(2))).toBe(true);
            expect(game.revealedPlayers.has(id(1))).toBe(false);
        });

        test('should handle large games with many players and characters', () => {
            const roomCode = 'LARGE1';
            const players = [];
            const characters = {};
            const revealedPlayers = [];

            // Create 10 players
            for (let i = 1; i <= 10; i++) {
                players.push({
                    id: id(i),
                    name: `Player${i}`,
                    avatar: '😀',
                    stickerColor: ['red', 'blue', 'purple', 'orange', 'green', 'pink', 'indigo'][i % 7]
                });

                if (i <= 8) {
                    characters[id(i)] = {
                        character: `Character${i}`,
                        assignedBy: id(i === 10 ? 1 : i + 1),
                        assignedAt: new Date()
                    };
                }

                if (i <= 3) {
                    revealedPlayers.push(id(i));
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
                    { id: id(1), name: 'Alice', avatar: '😀', stickerColor: 'red' }
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
                    { id: id(1), name: 'Alice', avatar: '😀', stickerColor: 'red' }
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

        test('a player who fails the checks of a live game is left out', () => {
            const savedState = {
                players: [
                    { id: id(1), name: 'Alice', avatar: '😀', stickerColor: 'red' },
                    { id: 'not-a-uuid', name: 'Bob', avatar: '😎' },
                    { id: id(3), name: 'x'.repeat(MAX_NAME_LENGTH + 1), avatar: '🤖' },
                    { id: id(4), name: 'Dave', avatar: 'javascript:alert(1)' },
                    { id: id(1), name: 'Alice again', avatar: '😀' },
                    'not a player'
                ],
                gameState: 'waiting'
            };

            const result = recreateGameFromState(games, 'CHK001', savedState);

            expect(result.success).toBe(true);
            expect(games.get('CHK001').players.map(p => p.name)).toEqual(['Alice']);
        });

        test('characters and reveals only for listed players, as clean text', () => {
            const savedState = {
                players: [
                    { id: id(1), name: 'Alice', avatar: '😀' },
                    { id: id(2), name: 'Bob', avatar: '😎' },
                    { id: id(3), name: 'Carol', avatar: '🤖' }
                ],
                gameState: 'started',
                characters: {
                    [id(1)]: { character: '  Batman  ', assignedBy: id(2) },
                    [id(2)]: 'Superman',                         // not a character object
                    [id(3)]: { character: 'x'.repeat(500) },     // longer than the limit
                    [id(9)]: { character: 'Joker' }              // nobody in the list
                },
                revealedPlayers: [id(1), id(2), id(9)]
            };

            recreateGameFromState(games, 'CHK002', savedState);

            const game = games.get('CHK002');
            expect(game.characters.get(id(1)).character).toBe('Batman');
            expect(game.characters.has(id(2))).toBe(false);
            expect([...game.characters.get(id(3)).character]).toHaveLength(128);
            expect(game.characters.has(id(9))).toBe(false);
            expect([...game.revealedPlayers]).toEqual([id(1)]);
        });

        test('an unknown state becomes the lobby; at most 12 players come back', () => {
            const players = Array.from({ length: 15 }, (_, i) => ({ id: id(i + 1), name: `P${i + 1}`, avatar: '😀' }));

            recreateGameFromState(games, 'CHK003', { players, gameState: 'banana' });

            const game = games.get('CHK003');
            expect(game.state).toBe('waiting');
            expect(game.players).toHaveLength(12);
        });

        test('everyone comes back offline, with the ghost clock started', () => {
            const savedState = {
                players: [{ id: id(1), name: 'Alice', avatar: '😀', isConnected: true, connected: true }],
                gameState: 'waiting'
            };

            recreateGameFromState(games, 'CHK004', savedState);

            const [alice] = games.get('CHK004').players;
            expect(alice.isConnected).toBe(false);
            expect(typeof alice.disconnectedAt).toBe('number');
        });
    });
});