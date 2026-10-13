// Who am I? Game - API Integration Tests
// The real routes of server.js (create and join a game). Characters, reveals
// and the rest of a game travel over Socket.IO: their rules are tested in
// game-logic.test.js and in the browser (tests/e2e).
const crypto = require('crypto');
const request = require('supertest');
const { app } = require('../server');

// Every page sends its browser's secret with a join (PLAYER_SECRET in
// utils.js). Here each player name is a browser of its own
const secrets = new Map();
function withSecret(body) {
    if (!secrets.has(body.playerName)) secrets.set(body.playerName, crypto.randomUUID());
    return { playerSecret: secrets.get(body.playerName), ...body };
}

describe('API Integration Tests', () => {
    // One listening server for the whole file: supertest would otherwise open
    // and close one per request
    let server;

    beforeAll(done => {
        // The routes log every request; keep the test output readable
        jest.spyOn(console, 'log').mockImplementation(() => {});
        server = app.listen(0, done);
    });

    afterAll(done => {
        console.log.mockRestore();
        server.close(done);
    });

    describe('POST /api/create-game', () => {
        test('creates a new game successfully', async () => {
            const response = await request(server)
                .post('/api/create-game')
                .expect(200);
            
            expect(response.body).toMatchObject({
                success: true,
                gameId: expect.any(String)
            });
            expect(response.body.gameId).toHaveLength(6);
            expect(response.body.gameId).toMatch(/^[A-Z0-9]{6}$/);
        });

        test('creates unique game IDs for multiple requests', async () => {
            const response1 = await request(server).post('/api/create-game').expect(200);
            const response2 = await request(server).post('/api/create-game').expect(200);
            const response3 = await request(server).post('/api/create-game').expect(200);
            
            const gameId1 = response1.body.gameId;
            const gameId2 = response2.body.gameId;
            const gameId3 = response3.body.gameId;
            
            expect(gameId1).not.toBe(gameId2);
            expect(gameId2).not.toBe(gameId3);
            expect(gameId1).not.toBe(gameId3);
        });
    });

    describe('POST /api/join-game', () => {
        let gameId;
        
        beforeEach(async () => {
            const createResponse = await request(server).post('/api/create-game');
            gameId = createResponse.body.gameId;
        });

        test('joins a game successfully', async () => {
            const response = await request(server)
                .post('/api/join-game')
                .send(withSecret({
                    gameId: gameId,
                    playerName: 'Alice',
                    avatar: '😀'
                }))
                .expect(200);
            
            expect(response.body).toMatchObject({
                success: true,
                player: {
                    name: 'Alice',
                    avatar: '😀',
                    id: expect.any(String)
                },
                game: {
                    id: gameId,
                    players: expect.arrayContaining([
                        expect.objectContaining({
                            name: 'Alice',
                            avatar: '😀'
                        })
                    ])
                }
            });
        });

        test('handles player reconnection', async () => {
            // First join
            const firstResponse = await request(server)
                .post('/api/join-game')
                .send(withSecret({
                    gameId: gameId,
                    playerName: 'Alice',
                    avatar: '😀'
                }))
                .expect(200);
            
            const playerId = firstResponse.body.player.id;
            
            // Reconnect with same name but different avatar (provide player ID)
            const secondResponse = await request(server)
                .post('/api/join-game')
                .send(withSecret({
                    gameId: gameId,
                    playerName: 'Alice',
                    avatar: '😎',
                    playerId: playerId
                }))
                .expect(200);
            
            expect(secondResponse.body.player.id).toBe(playerId);
            expect(secondResponse.body.player.avatar).toBe('😎');
            expect(secondResponse.body.game.players).toHaveLength(1);
        });

        test('allows multiple different players to join', async () => {
            await request(server)
                .post('/api/join-game')
                .send(withSecret({ gameId, playerName: 'Alice', avatar: '😀' }))
                .expect(200);
            
            await request(server)
                .post('/api/join-game')
                .send(withSecret({ gameId, playerName: 'Bob', avatar: '😎' }))
                .expect(200);
            
            const response = await request(server)
                .post('/api/join-game')
                .send(withSecret({ gameId, playerName: 'Charlie', avatar: '🤖' }))
                .expect(200);
            
            expect(response.body.game.players).toHaveLength(3);
            const playerNames = response.body.game.players.map(p => p.name);
            expect(playerNames).toEqual(['Alice', 'Bob', 'Charlie']);
        });

        test('returns error for invalid game ID', async () => {
            const response = await request(server)
                .post('/api/join-game')
                .send(withSecret({
                    gameId: 'INVALID',
                    playerName: 'Alice',
                    avatar: '😀'
                }))
                .expect(400);
            
            expect(response.body).toMatchObject({
                success: false,
                error: 'Game not found'
            });
        });

        test('returns error when game is full (12 players)', async () => {
            // Add 12 players
            for (let i = 1; i <= 12; i++) {
                await request(server)
                    .post('/api/join-game')
                    .send(withSecret({
                        gameId,
                        playerName: `Player${i}`,
                        avatar: '😀'
                    }))
                    .expect(200);
            }
            
            // Try to add 13th player
            const response = await request(server)
                .post('/api/join-game')
                .send(withSecret({
                    gameId,
                    playerName: 'Player13',
                    avatar: '😀'
                }))
                .expect(400);
            
            expect(response.body).toMatchObject({
                success: false,
                error: 'Game is full'
            });
        });

        test('a lost room is reported before the secret is asked for', async () => {
            // A page that sends no secret then still recreates the room from its copy
            const response = await request(server)
                .post('/api/join-game')
                .send({ gameId: 'GONE00', playerName: 'Alice', avatar: '😀' })
                .expect(400);

            expect(response.body.error).toBe('Game not found');
        });

        test('validates required fields', async () => {
            // Missing playerName
            await request(server)
                .post('/api/join-game')
                .send(withSecret({
                    gameId: gameId,
                    avatar: '😀'
                }))
                .expect(400);
            
            // Missing avatar
            await request(server)
                .post('/api/join-game')
                .send(withSecret({
                    gameId: gameId,
                    playerName: 'Alice'
                }))
                .expect(400);
            
            // Missing gameId
            await request(server)
                .post('/api/join-game')
                .send(withSecret({
                    playerName: 'Alice',
                    avatar: '😀'
                }))
                .expect(400);
        });
    });

    describe('Player Reconnection with ID', () => {
        let gameId, playerId1;
        
        beforeEach(async () => {
            // Create a game
            const gameResponse = await request(server)
                .post('/api/create-game')
                .expect(200);
            gameId = gameResponse.body.gameId;
            
            // Add two players
            const player1Response = await request(server)
                .post('/api/join-game')
                .send(withSecret({ gameId, playerName: 'Alice', avatar: '😀' }));
            playerId1 = player1Response.body.player.id;
            
            await request(server)
                .post('/api/join-game')
                .send(withSecret({ gameId, playerName: 'Bob', avatar: '😎' }));
        });
        
        test('allows player to reconnect using their ID', async () => {
            // Player reconnects with their ID
            const response = await request(server)
                .post('/api/join-game')
                .send(withSecret({ 
                    gameId, 
                    playerName: 'Alice', 
                    avatar: '🎯', 
                    playerId: playerId1 
                }))
                .expect(200);
                
            expect(response.body).toMatchObject({
                success: true,
                isNewPlayer: false,
                player: {
                    id: playerId1,
                    name: 'Alice',
                    avatar: '🎯' // Avatar should be updated
                }
            });
        });
        
        test("joining as a player takes that player's secret", async () => {
            const someoneElse = { gameId, playerName: 'Mallory', avatar: '🐍', playerId: playerId1 };

            const wrongSecret = await request(server)
                .post('/api/join-game')
                .send({ ...someoneElse, playerSecret: crypto.randomUUID() })
                .expect(400);
            const noSecret = await request(server)
                .post('/api/join-game')
                .send(someoneElse)
                .expect(400);

            expect(wrongSecret.body.error).toBe('This player is playing in another browser');
            expect(noSecret.body.error).toBe('Missing required fields');
        });

        test('creates new player if invalid ID provided', async () => {
            const response = await request(server)
                .post('/api/join-game')
                .send(withSecret({ 
                    gameId, 
                    playerName: 'Charlie', 
                    avatar: '🤖', 
                    playerId: 'invalid-player-id' 
                }))
                .expect(200);
                
            expect(response.body).toMatchObject({
                success: true,
                isNewPlayer: true,
                player: {
                    name: 'Charlie',
                    avatar: '🤖'
                }
            });
            
            // Should get a new ID, not the invalid one
            expect(response.body.player.id).not.toBe('invalid-player-id');
        });
    });

    describe('Error Handling', () => {
        test('handles missing request body for join-game', async () => {
            await request(server)
                .post('/api/join-game')
                .expect(400);
        });

        test('handles empty request body for join-game', async () => {
            await request(server)
                .post('/api/join-game')
                .send(withSecret({}))
                .expect(400);
        });
    });
});