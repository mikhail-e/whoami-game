/**
 * Mystery sticker tests
 * Your own hidden character is shown as a light dashed "secret" sticker
 * with the 🎭 glyph, so it is visible on top of any player color and
 * clearly reads as "unknown" (the old red ❓ emoji blended into red,
 * pink and purple sticker gradients).
 */
const fs = require('fs');
const path = require('path');

const styleCss = fs.readFileSync(path.join(__dirname, '..', 'public/css/style.css'), 'utf8');
const gameHtml = fs.readFileSync(path.join(__dirname, '..', 'public/game.html'), 'utf8');
const gameRoomJs = fs.readFileSync(path.join(__dirname, '..', 'public/js/game-room.js'), 'utf8');
const translationsJs = fs.readFileSync(path.join(__dirname, '..', 'public/js/translations.js'), 'utf8');

function mysteryRule() {
    const match = styleCss.match(/\.character-sticker\.mystery\s*\{[^}]*\}/);
    if (!match) throw new Error('.character-sticker.mystery rule not found in style.css');
    return match[0];
}

describe('Mystery sticker style (style.css)', () => {
    test('has a dedicated .mystery rule', () => {
        expect(() => mysteryRule()).not.toThrow();
    });

    test('uses a light background, not a player-color gradient', () => {
        expect(mysteryRule()).toMatch(/#f8f9fa/);
    });

    test('has a dashed border so it reads as "unknown"', () => {
        expect(mysteryRule()).toMatch(/dashed/);
    });

    test('uses a dark glyph color for contrast on the light background', () => {
        expect(mysteryRule()).toMatch(/color:\s*#495057/);
    });
});

describe('Mystery sticker rendering (game-room.js)', () => {
    test('applies the mystery class instead of the player color', () => {
        expect(gameRoomJs).toContain("'character-sticker mystery'");
    });

    test('shows the 🎭 glyph', () => {
        expect(gameRoomJs).toContain("'🎭'");
    });

    test('the red ❓ emoji is gone', () => {
        expect(gameRoomJs).not.toContain('❓');
    });
});

describe('Mystery sticker texts', () => {
    test('step4 mentions 🎭 in both languages', () => {
        expect(translationsJs).toContain('step4: "Click your mystery sticker (🎭)');
        expect(translationsJs).toContain('step4: "Нажмите на свой загадочный стикер (🎭)');
    });

    test('no ❓ left in translations or static markup', () => {
        expect(translationsJs).not.toContain('❓');
        expect(gameHtml).not.toContain('❓');
    });
});
