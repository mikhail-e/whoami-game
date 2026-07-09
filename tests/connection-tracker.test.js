// Tests for the socket connection tracker.
//
// The important scenario is the page refresh race: the browser opens a NEW
// socket before the OLD one reports its disconnect. Handling the late
// disconnect naively marks a player who is actually online as offline.

const { createConnectionTracker } = require('../game-logic');

describe('Connection Tracker', () => {
    let connections;

    beforeEach(() => {
        connections = createConnectionTracker();
    });

    test('registers a socket for a player', () => {
        connections.register('socket-1', 'ABC123', 'player-1');

        expect(connections.getSocketId('player-1')).toBe('socket-1');
        expect(connections.size).toBe(1);
    });

    test('unregister returns the player info for a normal disconnect', () => {
        connections.register('socket-1', 'ABC123', 'player-1');

        const result = connections.unregister('socket-1');

        expect(result).toEqual({ gameId: 'ABC123', playerId: 'player-1' });
        expect(connections.getSocketId('player-1')).toBeUndefined();
        expect(connections.size).toBe(0);
    });

    test('unregister returns null for an unknown socket', () => {
        expect(connections.unregister('never-seen')).toBeNull();
    });

    test('page refresh race: late disconnect of the old socket is ignored', () => {
        // Player is connected on socket-1
        connections.register('socket-1', 'ABC123', 'player-1');

        // Player refreshes: the NEW socket connects first...
        connections.register('socket-2', 'ABC123', 'player-1');

        // ...and only then the OLD socket reports its disconnect.
        // This must NOT be treated as the player going offline.
        expect(connections.unregister('socket-1')).toBeNull();

        // The player is still tracked on the new socket
        expect(connections.getSocketId('player-1')).toBe('socket-2');
    });

    test('after a refresh, disconnecting the new socket does report the player offline', () => {
        connections.register('socket-1', 'ABC123', 'player-1');
        connections.register('socket-2', 'ABC123', 'player-1');
        connections.unregister('socket-1'); // stale, ignored

        const result = connections.unregister('socket-2');

        expect(result).toEqual({ gameId: 'ABC123', playerId: 'player-1' });
        expect(connections.getSocketId('player-1')).toBeUndefined();
    });

    test('a socket can only be unregistered once', () => {
        connections.register('socket-1', 'ABC123', 'player-1');

        expect(connections.unregister('socket-1')).not.toBeNull();
        expect(connections.unregister('socket-1')).toBeNull();
    });

    test('tracks multiple players independently', () => {
        connections.register('socket-1', 'ABC123', 'player-1');
        connections.register('socket-2', 'ABC123', 'player-2');

        expect(connections.unregister('socket-1')).toEqual({ gameId: 'ABC123', playerId: 'player-1' });

        // Player 2 is untouched
        expect(connections.getSocketId('player-2')).toBe('socket-2');
        expect(connections.size).toBe(1);
    });

    test('a player rejoining a different game is tracked under the new game', () => {
        connections.register('socket-1', 'ABC123', 'player-1');
        connections.register('socket-2', 'XYZ789', 'player-1');

        expect(connections.unregister('socket-1')).toBeNull();
        expect(connections.unregister('socket-2')).toEqual({ gameId: 'XYZ789', playerId: 'player-1' });
    });
});
