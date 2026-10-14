// Joining a started game: a newcomer asks, any player lets them in or
// declines. The rules live in game-logic.js; the pages and the sockets are
// tested in the browser (tests/e2e/late-join.spec.js)
const crypto = require('crypto');
const {
    createGame,
    addPlayerToGame,
    assignCharacter,
    startGame,
    removePlayerFromGame,
    requestToJoin,
    withdrawJoinRequest,
    listJoinRequests,
    serializeGame,
    restoreGame,
} = require('../game-logic');

const uuid = () => crypto.randomUUID();

// A started round of these players: each gives the next one a character
function startedGame(names = ['Alice', 'Bob']) {
    const games = new Map();
    const gameId = createGame(games).gameId;
    const players = names.map(name => addPlayerToGame(games, gameId, name, '😀', uuid(), uuid()).player);
    players.forEach((player, index) => {
        const next = players[(index + 1) % players.length];
        assignCharacter(games, gameId, next.id, `Character of ${next.name}`, player.id);
    });
    expect(startGame(games, gameId, players[0].id).success).toBe(true);
    return { games, gameId, game: games.get(gameId), players };
}

describe('Asking to join a started game', () => {
    test('a stranger joining a started game is asked to wait, and nothing changes yet', () => {
        const { games, gameId, game } = startedGame();

        const result = addPlayerToGame(games, gameId, 'Dasha', '🐻', uuid(), uuid());

        expect(result).toEqual({ success: false, waitingForApproval: true });
        expect(game.players).toHaveLength(2);
        expect(game.joinRequests.size).toBe(0);
    });

    test('without a valid ID the started game still refuses', () => {
        const { games, gameId } = startedGame();

        expect(addPlayerToGame(games, gameId, 'Dasha', '🐻').error).toBe('Game has already started');
    });

    test('the request is recorded and listed without the secret', () => {
        const { games, gameId, game } = startedGame();
        const dasha = uuid();

        const result = requestToJoin(games, gameId, 'Dasha', '🐻', dasha, uuid());

        expect(result).toEqual({ success: true, request: { playerId: dasha, name: 'Dasha', avatar: '🐻' } });
        expect(listJoinRequests(game)).toEqual([{ playerId: dasha, name: 'Dasha', avatar: '🐻' }]);
        expect(JSON.stringify(listJoinRequests(game))).not.toMatch(/secret/i);
        expect(game.players).toHaveLength(2);
    });

    test('a second tab of the same browser keeps one request; another browser is refused', () => {
        const { games, gameId, game } = startedGame();
        const dasha = uuid();
        const secret = uuid();
        requestToJoin(games, gameId, 'Dasha', '🐻', dasha, secret);

        expect(requestToJoin(games, gameId, 'Dasha', '🐻', dasha, secret).success).toBe(true);
        expect(game.joinRequests.size).toBe(1);
        expect(requestToJoin(games, gameId, 'Dasha', '🐻', dasha, uuid()).error)
            .toBe('This player is playing in another browser');
    });

    test('the name, the avatar, the ID and the secret are checked', () => {
        const { games, gameId, game } = startedGame();

        expect(requestToJoin(games, gameId, '   ', '🐻', uuid(), uuid()).error).toBe('Invalid player name');
        expect(requestToJoin(games, gameId, 'Dasha', 'x'.repeat(11), uuid(), uuid()).error).toBe('Invalid avatar');
        expect(requestToJoin(games, gameId, 'Dasha', '🐻', 'nope', uuid()).error).toBe('Missing required fields');
        expect(requestToJoin(games, gameId, 'Dasha', '🐻', uuid(), 'nope').error).toBe('Missing required fields');
        expect(requestToJoin(games, 'ZZZZZZ', 'Dasha', '🐻', uuid(), uuid()).error).toBe('Game not found');
        expect(game.joinRequests.size).toBe(0);
    });

    test('whoever may simply join is told to join again instead', () => {
        const { games, gameId, players: [alice, bob] } = startedGame(['Alice', 'Bob', 'Carol']);

        // A player of the room (a reload) and a leaver of this round
        expect(requestToJoin(games, gameId, 'Bob', '😀', bob.id, uuid())).toEqual({ success: false, retryJoin: true });
        removePlayerFromGame(games, gameId, alice.id);
        expect(requestToJoin(games, gameId, 'Alice', '😀', alice.id, uuid())).toEqual({ success: false, retryJoin: true });

        // A lobby is open to everybody
        const lobby = new Map();
        const lobbyId = createGame(lobby).gameId;
        expect(requestToJoin(lobby, lobbyId, 'Dasha', '🐻', uuid(), uuid())).toEqual({ success: false, retryJoin: true });
        expect(games.get(gameId).joinRequests.size).toBe(0);
    });

    test('players and waiting newcomers together are at most 12', () => {
        const names = Array.from({ length: 10 }, (_, i) => `P${i + 1}`);
        const { games, gameId, game } = startedGame(names);
        const first = uuid();
        const firstSecret = uuid();
        requestToJoin(games, gameId, 'N1', '🐻', first, firstSecret);
        requestToJoin(games, gameId, 'N2', '🐻', uuid(), uuid());

        expect(requestToJoin(games, gameId, 'N3', '🐻', uuid(), uuid()).error).toBe('Game is full');
        expect(addPlayerToGame(games, gameId, 'N3', '🐻', uuid(), uuid()).error).toBe('Game is full');
        // A newcomer already waiting is not turned away by their own request
        expect(requestToJoin(games, gameId, 'N1', '🐻', first, firstSecret).success).toBe(true);
        expect(addPlayerToGame(games, gameId, 'N1', '🐻', first, firstSecret).waitingForApproval).toBe(true);
        expect(game.joinRequests.size).toBe(2);
    });

    test('a withdrawn request is gone', () => {
        const { games, gameId, game } = startedGame();
        const dasha = uuid();
        requestToJoin(games, gameId, 'Dasha', '🐻', dasha, uuid());

        expect(withdrawJoinRequest(game, dasha)).toBe(true);
        expect(withdrawJoinRequest(game, dasha)).toBe(false);
        expect(listJoinRequests(game)).toEqual([]);
    });

    test('requests are never saved: a restored room has none', () => {
        const { games, gameId, game } = startedGame();
        requestToJoin(games, gameId, 'Dasha', '🐻', uuid(), uuid());

        const saved = serializeGame(game, { withSecrets: true });
        expect(saved).not.toHaveProperty('joinRequests');
        expect(restoreGame(gameId, JSON.parse(JSON.stringify(saved))).joinRequests.size).toBe(0);
    });
});
