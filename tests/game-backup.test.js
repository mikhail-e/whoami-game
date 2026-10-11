/**
 * Game backup removal
 * The keep-alive loop saves every room with players online to games/CODE.json,
 * and /game/CODE restores a room from that file after a server restart. When a
 * room is deleted (its last player left, or its last ghost was removed), the
 * backup must go too - or the old link would bring the room back.
 */
const fs = require('fs');
const path = require('path');
const { deleteGameBackup } = require('../server');

const GAMES_DIR = path.join(__dirname, '..', 'games');
const backupOf = code => path.join(GAMES_DIR, `${code}.json`);

afterEach(() => {
    fs.rmSync(backupOf('TESTBK'), { force: true });
});

describe('deleteGameBackup()', () => {
    test("removes a deleted game's backup file", () => {
        fs.writeFileSync(backupOf('TESTBK'), JSON.stringify({ id: 'TESTBK' }));

        deleteGameBackup('TESTBK');

        expect(fs.existsSync(backupOf('TESTBK'))).toBe(false);
    });

    test('a game without a backup is not an error', () => {
        expect(() => deleteGameBackup('NOFILE')).not.toThrow();
    });

    test('an ID that is not a room code touches no file', () => {
        expect(() => deleteGameBackup('../package')).not.toThrow();

        expect(fs.existsSync(path.join(__dirname, '..', 'package.json'))).toBe(true);
    });
});
