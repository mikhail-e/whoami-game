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

// 12 avatars only lay out in even rows if the column count divides 12.
// `auto-fit` picked whatever fitted (10 + 2 on a wide screen), so the counts
// are now fixed: six columns on desktop, four on phones.
describe('Avatar grid lays out in even rows', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'public/css/style.css'), 'utf8');

    function columnsRule(block) {
        const match = block.match(/grid-template-columns:\s*([^;]+);/);
        return match ? match[1].trim() : null;
    }

    test('desktop uses six columns, not auto-fit', () => {
        const base = css.match(/\.avatar-selector\s*\{[\s\S]*?\}/)[0];

        expect(columnsRule(base)).toMatch(/repeat\(6,/);
        expect(base).not.toContain('auto-fit');
    });

    test('phones use four columns, not auto-fit', () => {
        const mobile = css.match(/@media \(max-width: 768px\)[\s\S]*?\.avatar-selector\s*\{[\s\S]*?\}/)[0];

        expect(columnsRule(mobile)).toMatch(/repeat\(4,/);
        expect(mobile).not.toContain('auto-fit');
    });

    test('tiles stay square', () => {
        const option = css.match(/\.avatar-option\s*\{[\s\S]*?\}/)[0];

        expect(option).toContain('aspect-ratio: 1');
        // Without this the emoji's line box makes the tile taller than it is wide
        expect(option).toContain('line-height: 1');
    });
});

describe('Localization supports aria-label', () => {
    test('updateTexts applies data-i18n-aria-label', () => {
        const translations = fs.readFileSync(path.join(__dirname, '..', 'public/js/translations.js'), 'utf8');

        expect(translations).toContain("querySelectorAll('[data-i18n-aria-label]')");
        expect(translations).toMatch(/setAttribute\('aria-label'/);
    });
});
