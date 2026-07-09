// The "shuffle avatars" control used to be a <div> styled as a button, placed
// as a 13th cell inside the avatar grid. These tests lock in the fixes:
// it must be a real button, it must not submit the form it lives in, and it
// must stay out of the grid so it never reads as another avatar tile.

const fs = require('fs');
const path = require('path');

const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public/index.html'), 'utf8');
const gameJs = fs.readFileSync(path.join(__dirname, '..', 'public/js/game.js'), 'utf8');

function shuffleButtonTag() {
    const match = indexHtml.match(/<button[^>]*id="shuffleAvatars"[^>]*>/s);
    if (!match) throw new Error('shuffleAvatars button not found in index.html');
    return match[0];
}

describe('Avatar shuffle button', () => {
    test('is a real <button>, not a div styled as one', () => {
        expect(() => shuffleButtonTag()).not.toThrow();
        expect(gameJs).not.toContain("refreshButton");
    });

    test('has type="button" so it cannot submit the surrounding form', () => {
        // #playerForm wraps the avatar selector and contains a submit button.
        // Without type="button" a click here would join a game.
        expect(shuffleButtonTag()).toMatch(/type="button"/);
    });

    test('is styled as an outlined primary button', () => {
        expect(shuffleButtonTag()).toMatch(/btn-outline-primary/);
    });

    test('lives outside the avatar grid', () => {
        const grid = indexHtml.match(/<div class="avatar-selector"[^>]*>[\s\S]*?<\/div>/)[0];

        expect(grid).not.toContain('shuffleAvatars');
        expect(grid).not.toContain('<button');
    });

    test('is localized through data-i18n-title and data-i18n-aria-label', () => {
        const tag = shuffleButtonTag();

        expect(tag).toMatch(/data-i18n-title="shuffleAvatars"/);
        expect(tag).toMatch(/data-i18n-aria-label="shuffleAvatars"/);
    });

    test('uses an inline SVG icon instead of an emoji or an icon CDN', () => {
        expect(indexHtml).toMatch(/<button[^>]*id="shuffleAvatars"[\s\S]*?<svg[\s\S]*?<\/svg>[\s\S]*?<\/button>/);
        expect(indexHtml).not.toMatch(/font-awesome|fontawesome|bootstrap-icons/i);
    });

    test('its icon is hidden from screen readers (the button carries the label)', () => {
        const button = indexHtml.match(/<button[^>]*id="shuffleAvatars"[\s\S]*?<\/button>/)[0];

        expect(button).toMatch(/aria-hidden="true"/);
        expect(button).toMatch(/focusable="false"/);
    });

    test('populateAvatars only renders avatar tiles', () => {
        const fn = gameJs.match(/function populateAvatars\([\s\S]*?\n}/)[0];

        expect(fn).toContain('avatar-option');
        expect(fn).not.toContain('shuffleAvatars');
        expect(fn).not.toContain('btn');
    });

    test('the shuffle listener is attached once, outside populateAvatars', () => {
        const fn = gameJs.match(/function populateAvatars\([\s\S]*?\n}/)[0];

        expect(fn).not.toContain('addEventListener');
        expect(gameJs).toMatch(/getElementById\('shuffleAvatars'\)/);
    });
});

describe('Localization supports aria-label', () => {
    test('updateTexts applies data-i18n-aria-label', () => {
        const translations = fs.readFileSync(path.join(__dirname, '..', 'public/js/translations.js'), 'utf8');

        expect(translations).toContain("querySelectorAll('[data-i18n-aria-label]')");
        expect(translations).toMatch(/setAttribute\('aria-label'/);
    });
});
