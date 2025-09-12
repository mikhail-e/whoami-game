// Who am I? Game - API Integration Tests
const request = require('supertest');
const express = require('express');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const gameLogic = require('../game-logic');

// Create test app (simplified version of server.js for testing)
function createTestApp() {
    const app = express();
    const games = new Map();
    
    app.use(express.json());
    
    // API endpoint to create a new game
    app.post('/api/create-game', (req, res) => {
        const result = gameLogic.createGame(games);
        res.json(result);
    });
    
    // API endpoint to join a game
    app.post('/api/join-game', (req, res) => {
        const { gameId, playerName, avatar, playerId } = req.body;
        
        if (!gameId || !playerName || !avatar) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const result = gameLogic.addPlayerToGame(games, gameId, playerName, avatar, playerId);
        res.status(result.success ? 200 : 400).json(result);
    });
    
    // API endpoint to assign character (simplified)
    app.post('/api/assign-character', (req, res) => {
        const { gameId, playerId, character, assignedBy } = req.body;
        const result = gameLogic.assignCharacter(games, gameId, playerId, character, assignedBy);
        res.status(result.success ? 200 : 400).json(result);
    });
    
    return app;
}

describe('API Integration Tests', () => {
    let app;
    
    beforeEach(() => {
        app = createTestApp();
    });

    describe('POST /api/create-game', () => {
        test('creates a new game successfully', async () => {
            const response = await request(app)
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
            const response1 = await request(app).post('/api/create-game').expect(200);
            const response2 = await request(app).post('/api/create-game').expect(200);
            const response3 = await request(app).post('/api/create-game').expect(200);
            
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
            const createResponse = await request(app).post('/api/create-game');
            gameId = createResponse.body.gameId;
        });

        test('joins a game successfully', async () => {
            const response = await request(app)
                .post('/api/join-game')
                .send({
                    gameId: gameId,
                    playerName: 'Alice',
                    avatar: '😀'
                })
                .expect(200);
            
            expect(response.body).toMatchObject({
                success: true,
                player: {
                    name: 'Alice',
                    avatar: '😀',
                    connected: true,
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
            const firstResponse = await request(app)
                .post('/api/join-game')
                .send({
                    gameId: gameId,
                    playerName: 'Alice',
                    avatar: '😀'
                })
                .expect(200);
            
            const playerId = firstResponse.body.player.id;
            
            // Reconnect with same name but different avatar
            const secondResponse = await request(app)
                .post('/api/join-game')
                .send({
                    gameId: gameId,
                    playerName: 'Alice',
                    avatar: '😎'
                })
                .expect(200);
            
            expect(secondResponse.body.player.id).toBe(playerId);
            expect(secondResponse.body.player.avatar).toBe('😎');
            expect(secondResponse.body.game.players).toHaveLength(1);
        });

        test('allows multiple different players to join', async () => {
            await request(app)
                .post('/api/join-game')
                .send({ gameId, playerName: 'Alice', avatar: '😀' })
                .expect(200);
            
            await request(app)
                .post('/api/join-game')
                .send({ gameId, playerName: 'Bob', avatar: '😎' })
                .expect(200);
            
            const response = await request(app)
                .post('/api/join-game')
                .send({ gameId, playerName: 'Charlie', avatar: '🤖' })
                .expect(200);
            
            expect(response.body.game.players).toHaveLength(3);
            const playerNames = response.body.game.players.map(p => p.name);
            expect(playerNames).toEqual(['Alice', 'Bob', 'Charlie']);
        });

        test('returns error for invalid game ID', async () => {
            const response = await request(app)
                .post('/api/join-game')
                .send({
                    gameId: 'INVALID',
                    playerName: 'Alice',
                    avatar: '😀'
                })
                .expect(400);
            
            expect(response.body).toMatchObject({
                success: false,
                error: 'Game not found'
            });
        });

        test('returns error when game is full (12 players)', async () => {
            // Add 12 players
            for (let i = 1; i <= 12; i++) {
                await request(app)
                    .post('/api/join-game')
                    .send({
                        gameId,
                        playerName: `Player${i}`,
                        avatar: '😀'
                    })
                    .expect(200);
            }
            
            // Try to add 13th player
            const response = await request(app)
                .post('/api/join-game')
                .send({
                    gameId,
                    playerName: 'Player13',
                    avatar: '😀'
                })
                .expect(400);
            
            expect(response.body).toMatchObject({
                success: false,
                error: 'Game is full'
            });
        });

        test('validates required fields', async () => {
            // Missing playerName
            await request(app)
                .post('/api/join-game')
                .send({
                    gameId: gameId,
                    avatar: '😀'
                })
                .expect(400);
            
            // Missing avatar
            await request(app)
                .post('/api/join-game')
                .send({
                    gameId: gameId,
                    playerName: 'Alice'
                })
                .expect(400);
            
            // Missing gameId
            await request(app)
                .post('/api/join-game')
                .send({
                    playerName: 'Alice',
                    avatar: '😀'
                })
                .expect(400);
        });
    });

    describe('POST /api/assign-character', () => {
        let gameId;
        let playerId1;
        let playerId2;
        
        beforeEach(async () => {
            // Create game
            const createResponse = await request(app).post('/api/create-game');
            gameId = createResponse.body.gameId;
            
            // Add two players
            const player1Response = await request(app)
                .post('/api/join-game')
                .send({ gameId, playerName: 'Alice', avatar: '😀' });
            playerId1 = player1Response.body.player.id;
            
            const player2Response = await request(app)
                .post('/api/join-game')
                .send({ gameId, playerName: 'Bob', avatar: '😎' });
            playerId2 = player2Response.body.player.id;
        });

        test('assigns character successfully', async () => {
            const response = await request(app)
                .post('/api/assign-character')
                .send({
                    gameId,
                    playerId: playerId1,
                    character: 'Albert Einstein',
                    assignedBy: playerId2
                })
                .expect(200);
            
            expect(response.body).toMatchObject({
                success: true,
                playerId: playerId1,
                character: 'Albert Einstein',
                assignedBy: playerId2,
                characters: expect.objectContaining({
                    [playerId1]: expect.objectContaining({
                        character: 'Albert Einstein',
                        assignedBy: playerId2
                    })
                })
            });
        });

        test('allows character reassignment', async () => {
            // Initial assignment
            await request(app)
                .post('/api/assign-character')
                .send({
                    gameId, playerId: playerId1,
                    character: 'Batman', assignedBy: playerId2
                })
                .expect(200);
            
            // Reassignment
            const response = await request(app)
                .post('/api/assign-character')
                .send({
                    gameId, playerId: playerId1,
                    character: 'Superman', assignedBy: playerId2
                })
                .expect(200);
            
            expect(response.body.character).toBe('Superman');
        });

        test('returns error for invalid game', async () => {
            const response = await request(app)
                .post('/api/assign-character')
                .send({
                    gameId: 'INVALID',
                    playerId: playerId1,
                    character: 'Batman',
                    assignedBy: playerId2
                })
                .expect(400);
            
            expect(response.body).toMatchObject({
                success: false,
                error: 'Game not found'
            });
        });

        test('returns error for invalid player', async () => {
            const response = await request(app)
                .post('/api/assign-character')
                .send({
                    gameId,
                    playerId: 'invalid-player-id',
                    character: 'Batman',
                    assignedBy: playerId2
                })
                .expect(400);
            
            expect(response.body).toMatchObject({
                success: false,
                error: 'Player not found in game'
            });
        });

        test('prevents players from assigning characters to themselves', async () => {
            const response = await request(app)
                .post('/api/assign-character')
                .send({
                    gameId,
                    playerId: playerId1,
                    character: 'Batman',
                    assignedBy: playerId1
                })
                .expect(400);
            
            expect(response.body).toMatchObject({
                success: false,
                error: 'Cannot assign character to yourself'
            });
        });

        test('validates that assigner exists in game', async () => {
            const response = await request(app)
                .post('/api/assign-character')
                .send({
                    gameId,
                    playerId: playerId1,
                    character: 'Batman',
                    assignedBy: 'invalid-assigner-id'
                })
                .expect(400);
            
            expect(response.body).toMatchObject({
                success: false,
                error: 'Assigner not found in game'
            });
        });
    });

    describe('Player Reconnection with ID', () => {
        let gameId, playerId1, playerId2;
        
        beforeEach(async () => {
            // Create a game
            const gameResponse = await request(app)
                .post('/api/create-game')
                .expect(200);
            gameId = gameResponse.body.gameId;
            
            // Add two players
            const player1Response = await request(app)
                .post('/api/join-game')
                .send({ gameId, playerName: 'Alice', avatar: '😀' });
            playerId1 = player1Response.body.player.id;
            
            const player2Response = await request(app)
                .post('/api/join-game')
                .send({ gameId, playerName: 'Bob', avatar: '😎' });
            playerId2 = player2Response.body.player.id;
        });
        
        test('allows player to reconnect using their ID', async () => {
            // Player reconnects with their ID
            const response = await request(app)
                .post('/api/join-game')
                .send({ 
                    gameId, 
                    playerName: 'Alice', 
                    avatar: '🎯', 
                    playerId: playerId1 
                })
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
        
        test('creates new player if invalid ID provided', async () => {
            const response = await request(app)
                .post('/api/join-game')
                .send({ 
                    gameId, 
                    playerName: 'Charlie', 
                    avatar: '🤖', 
                    playerId: 'invalid-player-id' 
                })
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
            await request(app)
                .post('/api/join-game')
                .expect(400);
        });

        test('handles empty request body for join-game', async () => {
            await request(app)
                .post('/api/join-game')
                .send({})
                .expect(400);
        });
    });
});