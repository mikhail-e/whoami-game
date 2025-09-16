// Who am I? Game - Start Game Button Tests
// Tests for frontend Start Game button behavior

// Mock DOM elements
const mockElements = {};

// Mock document methods
global.document = {
    getElementById: (id) => mockElements[id] || null,
    createElement: (tag) => ({ classList: { add: jest.fn() } }),
    addEventListener: jest.fn()
};

// Mock Socket.IO
const mockSocket = {
    on: jest.fn(),
    emit: jest.fn()
};
global.io = jest.fn(() => mockSocket);

// Mock i18n
global.i18n = {
    getText: (key) => {
        const texts = {
            'needPlayers': 'Need at least 2 players to start',
            'assignCharacters': 'Assign characters to all players before starting!',
            'readyToPlay': 'Ready to play!'
        };
        return texts[key] || key;
    }
};

// Mock game room logic by requiring the actual game logic functions
const {
    createGame,
    addPlayerToGame,
    assignCharacter
} = require('../game-logic');

describe('Start Game Button State', () => {
    let games;
    let gameId;
    let currentGame;
    let currentPlayer;

    beforeEach(() => {
        // Reset mock elements
        Object.keys(mockElements).forEach(key => delete mockElements[key]);

        // Create mock button elements
        mockElements['startGame'] = { disabled: true };
        mockElements['startGameMobile'] = { disabled: true };
        mockElements['gameStatus'] = { textContent: '' };
        mockElements['gameStatusMobile'] = { textContent: '' };

        // Create a fresh game for each test
        games = new Map();
        const createResult = createGame(games);
        gameId = createResult.gameId;

        // Add test players
        const player1Result = addPlayerToGame(games, gameId, 'Alice', '😀');
        const player2Result = addPlayerToGame(games, gameId, 'Bob', '😎');

        currentPlayer = player1Result.player;

        // Set up current game state to match what frontend expects
        const game = games.get(gameId);
        currentGame = {
            id: gameId,
            players: game.players,
            characters: Object.fromEntries(game.characters),
            state: game.state,
            revealedPlayers: Array.from(game.revealedPlayers)
        };
    });

    test('button should be disabled when not all players have characters', () => {
        // Simulate the button state logic from the frontend
        const allPlayersHaveCharacters = currentGame.players.length >= 2 &&
            currentGame.players.every(player => {
                const characterData = currentGame.characters && currentGame.characters[player.id];
                return characterData && characterData.character && characterData.character.trim() !== '';
            });

        expect(allPlayersHaveCharacters).toBe(false);
        expect(currentGame.players.length).toBe(2); // We have enough players
        expect(Object.keys(currentGame.characters).length).toBe(0); // But no characters assigned
    });

    test('button should be enabled when all players have characters', () => {
        // Assign characters to both players
        const player1Id = currentGame.players[0].id;
        const player2Id = currentGame.players[1].id;

        assignCharacter(games, gameId, player1Id, 'Batman', player2Id);
        assignCharacter(games, gameId, player2Id, 'Superman', player1Id);

        // Update currentGame to match what server would send
        const game = games.get(gameId);
        currentGame.characters = Object.fromEntries(game.characters);

        // Simulate the button state logic from the frontend
        const allPlayersHaveCharacters = currentGame.players.length >= 2 &&
            currentGame.players.every(player => {
                const characterData = currentGame.characters && currentGame.characters[player.id];
                return characterData && characterData.character && characterData.character.trim() !== '';
            });

        expect(allPlayersHaveCharacters).toBe(true);
        expect(Object.keys(currentGame.characters).length).toBe(2);
        expect(currentGame.characters[player1Id].character).toBe('Batman');
        expect(currentGame.characters[player2Id].character).toBe('Superman');
    });

    test('button should be disabled with only one player', () => {
        // Create new game with only one player
        const newGames = new Map();
        const newCreateResult = createGame(newGames);
        const newGameId = newCreateResult.gameId;

        addPlayerToGame(newGames, newGameId, 'Solo', '😀');

        const newGame = newGames.get(newGameId);
        const testGame = {
            players: newGame.players,
            characters: Object.fromEntries(newGame.characters),
            state: newGame.state
        };

        const allPlayersHaveCharacters = testGame.players.length >= 2 &&
            testGame.players.every(player => {
                const characterData = testGame.characters && testGame.characters[player.id];
                return characterData && characterData.character && characterData.character.trim() !== '';
            });

        expect(allPlayersHaveCharacters).toBe(false);
        expect(testGame.players.length).toBe(1); // Not enough players
    });

    test('button logic handles empty character strings correctly', () => {
        const player1Id = currentGame.players[0].id;
        const player2Id = currentGame.players[1].id;

        // Assign one real character and one empty character
        assignCharacter(games, gameId, player1Id, 'Batman', player2Id);

        // Manually add an empty character (simulating edge case)
        const game = games.get(gameId);
        game.characters.set(player2Id, {
            character: '', // Empty string
            assignedBy: player1Id,
            assignedAt: new Date()
        });

        currentGame.characters = Object.fromEntries(game.characters);

        const allPlayersHaveCharacters = currentGame.players.length >= 2 &&
            currentGame.players.every(player => {
                const characterData = currentGame.characters && currentGame.characters[player.id];
                return characterData && characterData.character && characterData.character.trim() !== '';
            });

        expect(allPlayersHaveCharacters).toBe(false); // Should be false because player2 has empty character
        expect(currentGame.characters[player1Id].character).toBe('Batman');
        expect(currentGame.characters[player2Id].character).toBe(''); // Empty character should fail validation
    });

    test('button logic handles whitespace-only character strings correctly', () => {
        const player1Id = currentGame.players[0].id;
        const player2Id = currentGame.players[1].id;

        assignCharacter(games, gameId, player1Id, 'Batman', player2Id);

        // Manually add a whitespace-only character
        const game = games.get(gameId);
        game.characters.set(player2Id, {
            character: '   ', // Whitespace only
            assignedBy: player1Id,
            assignedAt: new Date()
        });

        currentGame.characters = Object.fromEntries(game.characters);

        const allPlayersHaveCharacters = currentGame.players.length >= 2 &&
            currentGame.players.every(player => {
                const characterData = currentGame.characters && currentGame.characters[player.id];
                return characterData && characterData.character && characterData.character.trim() !== '';
            });

        expect(allPlayersHaveCharacters).toBe(false); // Should be false because whitespace-only fails trim() check
    });

    test('button should work with maximum players (12)', () => {
        // Create game with 12 players
        const maxGames = new Map();
        const maxCreateResult = createGame(maxGames);
        const maxGameId = maxCreateResult.gameId;

        const playerIds = [];
        for (let i = 1; i <= 12; i++) {
            const playerResult = addPlayerToGame(maxGames, maxGameId, `Player${i}`, '😀');
            playerIds.push(playerResult.player.id);
        }

        // Assign characters to all players (each player assigns to the next one, last assigns to first)
        for (let i = 0; i < 12; i++) {
            const assignerId = playerIds[(i + 1) % 12]; // Next player assigns to current
            assignCharacter(maxGames, maxGameId, playerIds[i], `Character${i + 1}`, assignerId);
        }

        const maxGame = maxGames.get(maxGameId);
        const testMaxGame = {
            players: maxGame.players,
            characters: Object.fromEntries(maxGame.characters),
            state: maxGame.state
        };

        const allPlayersHaveCharacters = testMaxGame.players.length >= 2 &&
            testMaxGame.players.every(player => {
                const characterData = testMaxGame.characters && testMaxGame.characters[player.id];
                return characterData && characterData.character && characterData.character.trim() !== '';
            });

        expect(allPlayersHaveCharacters).toBe(true);
        expect(testMaxGame.players.length).toBe(12);
        expect(Object.keys(testMaxGame.characters).length).toBe(12);
    });
});