// The input limits exist twice: once on the server (game-logic.js) and once
// on the frontend (public/js/utils.js), because a browser script cannot
// require() a Node module. This test fails if the two copies ever drift apart,
// which would let the UI accept text the server silently truncates or rejects.

const fs = require('fs');
const path = require('path');

const gameLogic = require('../game-logic');

function readConstant(filePath, name) {
    const source = fs.readFileSync(path.join(__dirname, '..', filePath), 'utf8');
    const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\d+)`));
    if (!match) throw new Error(`${name} not found in ${filePath}`);
    return Number(match[1]);
}

describe('Input limits stay in sync between server and frontend', () => {
    test('MAX_NAME_LENGTH matches', () => {
        expect(readConstant('public/js/utils.js', 'MAX_NAME_LENGTH'))
            .toBe(gameLogic.MAX_NAME_LENGTH);
    });

    test('MAX_CHARACTER_LENGTH matches', () => {
        expect(readConstant('public/js/utils.js', 'MAX_CHARACTER_LENGTH'))
            .toBe(gameLogic.MAX_CHARACTER_LENGTH);
    });

    test('MAX_CUSTOM_AVATAR_LENGTH matches', () => {
        expect(readConstant('public/js/utils.js', 'MAX_CUSTOM_AVATAR_LENGTH'))
            .toBe(gameLogic.MAX_CUSTOM_AVATAR_LENGTH);
    });

    test('CUSTOM_AVATAR_PATTERN is character-for-character identical', () => {
        const readPattern = (filePath) => {
            const source = fs.readFileSync(path.join(__dirname, '..', filePath), 'utf8');
            const match = source.match(/const\s+CUSTOM_AVATAR_PATTERN\s*=\s*(\/[^\n]+\/)/);
            if (!match) throw new Error(`CUSTOM_AVATAR_PATTERN not found in ${filePath}`);
            return match[1];
        };

        expect(readPattern('public/js/utils.js')).toBe(readPattern('game-logic.js'));
    });

    test('game-room.js uses the constant instead of a hardcoded number', () => {
        const source = fs.readFileSync(path.join(__dirname, '..', 'public/js/game-room.js'), 'utf8');

        expect(source).toContain('inputElement.maxLength = MAX_CHARACTER_LENGTH;');
        expect(source).not.toMatch(/inputElement\.maxLength\s*=\s*\d+/);
    });

    test('index.html does not hardcode a name maxlength', () => {
        const source = fs.readFileSync(path.join(__dirname, '..', 'public/index.html'), 'utf8');
        const playerNameInput = source.match(/<input[^>]*id="playerName"[^>]*>/)[0];

        expect(playerNameInput).not.toMatch(/maxlength=/i);
    });

    test('the limits are the agreed values', () => {
        expect(gameLogic.MAX_NAME_LENGTH).toBe(128);
        expect(gameLogic.MAX_CHARACTER_LENGTH).toBe(128);
        expect(gameLogic.MAX_CUSTOM_AVATAR_LENGTH).toBe(32768);
    });
});
