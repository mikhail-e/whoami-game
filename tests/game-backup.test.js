/**
 * Game backups on disk
 * The keep-alive loop saves every room with players online to games/CODE.json,
 * and /game/CODE restores a room from that file after a server restart. When
 * the last player leaves a room, its backup must go too - or the old link
 * would bring the room back (tests/e2e/leave-and-return.spec.js checks that
 * through the pages). The code in a room link becomes part of a file path, so
 * only a real room code may reach the disk.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

// A folder of our own: the server reads GAMES_DIR once, as it loads. The
// canary sits next to it, where a path that escaped the folder would land
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'whoami-backup-test-'));
process.env.GAMES_DIR = path.join(sandbox, 'games');
const { app, deleteGameBackup } = require('../server');

const backupOf = code => path.join(process.env.GAMES_DIR, `${code}.json`);
const canary = path.join(sandbox, 'CANARY.json');

afterAll(() => {
    fs.rmSync(sandbox, { recursive: true, force: true });
});

describe('deleteGameBackup()', () => {
    test("removes a game's backup file", () => {
        fs.writeFileSync(backupOf('TESTBK'), JSON.stringify({ id: 'TESTBK' }));

        deleteGameBackup('TESTBK');

        expect(fs.existsSync(backupOf('TESTBK'))).toBe(false);
    });

    test('a game without a backup is not an error', () => {
        expect(() => deleteGameBackup('NOFILE')).not.toThrow();
    });

    test('an ID that is not a room code touches no file', () => {
        fs.writeFileSync(canary, '{}');

        expect(() => deleteGameBackup('../CANARY')).not.toThrow();

        expect(fs.existsSync(canary)).toBe(true);
    });
});

describe('GET /game/:roomCode', () => {
    // The route logs restores; keep the test output readable
    beforeAll(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
    afterAll(() => console.log.mockRestore());

    test('a room link that is not a room code opens no file', async () => {
        // A file in the shape of a saved room, one folder above the backups
        fs.writeFileSync(canary, JSON.stringify({
            id: 'CANARY', players: [], characters: {}, state: 'waiting',
            revealedPlayers: [], created: new Date().toISOString(),
        }));

        const response = await request(app).get('/game/..%2FCANARY');

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('/?error=room-not-found');
    });
});
