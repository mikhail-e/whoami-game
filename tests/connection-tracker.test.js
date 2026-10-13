// Tests for the socket connection tracker.
//
// A player may have several sockets in a room: two tabs of one browser are
// the same player, and on a page refresh the browser opens the NEW socket
// before the OLD one reports its disconnect. A player goes offline only when
// their last socket goes - a closed second tab or a late disconnect must not
// mark a player who is still playing as offline.

const { createConnectionTracker } = require('../game-logic');

describe('Connection Tracker', () => {
    let connections;

    beforeEach(() => {
        connections = createConnectionTracker();
    });

    test('registers a socket for a player', () => {
        connections.register('socket-1', 'ABC123', 'player-1');

        expect(connections.isPlayerSocket('socket-1', 'ABC123', 'player-1')).toBe(true);
        expect(connections.size).toBe(1);
    });

    test('a socket speaks only for its own player in its own room', () => {
        connections.register('socket-1', 'ABC123', 'player-1');

        expect(connections.isPlayerSocket('socket-1', 'ABC123', 'player-2')).toBe(false);
        expect(connections.isPlayerSocket('socket-1', 'XYZ789', 'player-1')).toBe(false);
        expect(connections.isPlayerSocket('socket-2', 'ABC123', 'player-1')).toBe(false);
    });

    test('unregister returns the player info for a normal disconnect', () => {
        connections.register('socket-1', 'ABC123', 'player-1');

        const result = connections.unregister('socket-1');

        expect(result).toEqual({ gameId: 'ABC123', playerId: 'player-1' });
        expect(connections.isPlayerSocket('socket-1', 'ABC123', 'player-1')).toBe(false);
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
        expect(connections.isPlayerSocket('socket-2', 'ABC123', 'player-1')).toBe(true);
    });

    test('two tabs: closing one keeps the player online, closing both does not', () => {
        connections.register('tab-1', 'ABC123', 'player-1');
        connections.register('tab-2', 'ABC123', 'player-1');

        // The tab that registered LAST closes first - the old tracker, which
        // knew one socket per player, reported the player offline here
        expect(connections.unregister('tab-2')).toBeNull();
        expect(connections.isPlayerSocket('tab-1', 'ABC123', 'player-1')).toBe(true);

        expect(connections.unregister('tab-1')).toEqual({ gameId: 'ABC123', playerId: 'player-1' });
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
        expect(connections.isPlayerSocket('socket-2', 'ABC123', 'player-2')).toBe(true);
        expect(connections.size).toBe(1);
    });

    test('one browser in two rooms is tracked per room', () => {
        connections.register('socket-1', 'ABC123', 'player-1');
        connections.register('socket-2', 'XYZ789', 'player-1');

        // Closing the page of one room takes the player offline there only
        expect(connections.unregister('socket-1')).toEqual({ gameId: 'ABC123', playerId: 'player-1' });
        expect(connections.unregister('socket-2')).toEqual({ gameId: 'XYZ789', playerId: 'player-1' });
    });

    test('a socket registered again moves to its new player', () => {
        connections.register('socket-1', 'ABC123', 'player-1');
        connections.register('socket-1', 'ABC123', 'player-2');

        expect(connections.isPlayerSocket('socket-1', 'ABC123', 'player-1')).toBe(false);
        expect(connections.unregister('socket-1')).toEqual({ gameId: 'ABC123', playerId: 'player-2' });
    });

    test('a player who left is forgotten on every socket', () => {
        connections.register('tab-1', 'ABC123', 'player-1');
        connections.register('tab-2', 'ABC123', 'player-1');

        connections.unregisterPlayer('ABC123', 'player-1');

        expect(connections.isPlayerSocket('tab-1', 'ABC123', 'player-1')).toBe(false);
        expect(connections.isPlayerSocket('tab-2', 'ABC123', 'player-1')).toBe(false);
        // Their tabs' later disconnects are no-ops
        expect(connections.unregister('tab-1')).toBeNull();
        expect(connections.size).toBe(0);
    });
});
