/**
 * Avatar persistence tests
 *
 * The landing page must remember the avatar the player last actually played
 * with (saved on create/join, like the name) and pre-select it on the next
 * visit. Source-level checks in the style of tests/leave-game.test.js.
 */

const fs = require('fs');
const path = require('path');

const gameJs = fs.readFileSync(path.join(__dirname, '..', 'public/js/game.js'), 'utf8');

describe('Avatar is remembered between games (client wiring)', () => {
    test('the avatar is saved both when creating and when joining a game', () => {
        const saves = gameJs.match(/Storage\.set\('whoami-player-avatar', playerData\.avatar\)/g) || [];
        expect(saves.length).toBe(2);
    });

    test('the saved avatar is read on page load', () => {
        expect(gameJs).toMatch(/Storage\.get\('whoami-player-avatar'\)/);
    });

    test('stale or tampered values are ignored: the saved avatar must be in the pool', () => {
        expect(gameJs).toMatch(/savedAvatar && avatarPool\.includes\(savedAvatar\)/);
    });

    test('a saved custom avatar is restored only through the validation guard', () => {
        expect(gameJs).toMatch(/savedAvatar && isCustomAvatar\(savedAvatar\)/);
    });

    test('the saved avatar goes first so populateAvatars() auto-selects it, grid stays at 12', () => {
        expect(gameJs).toMatch(/\[savedAvatar, \.\.\.initialAvatars\.filter\(a => a !== savedAvatar\)\]\.slice\(0, 12\)/);
    });

    test('shuffle deals a fresh emoji set but keeps the custom avatar pinned first', () => {
        // The shuffle listener must not re-pin the saved emoji avatar; the only
        // pinned tile is the uploaded custom avatar (withCustomAvatarFirst)
        expect(gameJs).toMatch(/shuffleButton\.addEventListener\('click', \(\) => \{\s*populateAvatars\(withCustomAvatarFirst\(selectRandomAvatars\(\)\)\);\s*\}\)/);
    });
});
