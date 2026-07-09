/**
 * Share button tests
 * The Share button opens the native share sheet (navigator.share) to send
 * the room link; browsers without Web Share API fall back to copying it.
 */
const fs = require('fs');
const path = require('path');

const gameHtml = fs.readFileSync(path.join(__dirname, '..', 'public/game.html'), 'utf8');
const gameRoomJs = fs.readFileSync(path.join(__dirname, '..', 'public/js/game-room.js'), 'utf8');
const translationsJs = fs.readFileSync(path.join(__dirname, '..', 'public/js/translations.js'), 'utf8');

function shareButtonTag() {
    const match = gameHtml.match(/<button[^>]*id="shareButton"[^>]*>/);
    if (!match) throw new Error('shareButton not found in game.html');
    return match[0];
}

describe('Share button markup (game.html)', () => {
    test('exists in the Share Room card', () => {
        expect(() => shareButtonTag()).not.toThrow();
    });

    test('has type="button"', () => {
        expect(shareButtonTag()).toMatch(/type="button"/);
    });

    test('the neighbouring copy button also has type="button"', () => {
        const copyButton = gameHtml.match(/<button[^>]*id="copyLink"[^>]*>/);
        expect(copyButton).not.toBeNull();
        expect(copyButton[0]).toMatch(/type="button"/);
    });

    test('label is localized through data-i18n', () => {
        const button = gameHtml.match(/<button[^>]*id="shareButton"[\s\S]*?<\/button>/)[0];
        expect(button).toMatch(/data-i18n="share"/);
    });
});

describe('Share button behaviour (game-room.js)', () => {
    test('uses the Web Share API', () => {
        expect(gameRoomJs).toContain('navigator.share');
    });

    test('is wired up by id', () => {
        expect(gameRoomJs).toMatch(/getElementById\('shareButton'\)/);
    });

    test('ignores AbortError (user closed the share sheet)', () => {
        expect(gameRoomJs).toContain('AbortError');
    });

    test('falls back to the shared copy helper', () => {
        expect(gameRoomJs).toMatch(/function copyRoomLink/);
        // helper definition + copy-button call + share fallback calls
        expect(gameRoomJs.match(/copyRoomLink\(/g).length).toBeGreaterThanOrEqual(3);
    });
});

describe('Share button translations', () => {
    test('has English strings', () => {
        expect(translationsJs).toContain('share: "Share"');
        expect(translationsJs).toContain('shareText: "Join my');
    });

    test('has Russian strings', () => {
        expect(translationsJs).toContain('share: "Поделиться"');
        expect(translationsJs).toContain('shareText: "Присоединяйся');
    });
});
