/**
 * Custom avatar (uploaded photo) tests
 *
 * A player can upload a photo instead of picking an emoji. The photo travels
 * as a small base64 data URL in the same player.avatar field the emoji uses,
 * so every persistence flow (join, reconnect, disk restore, recreate-game)
 * carries it automatically. These tests cover the server-side validation gate
 * and the client wiring (source-level checks in the style of
 * tests/avatar-shuffle.test.js).
 */

const fs = require('fs');
const path = require('path');

const {
    createGame,
    addPlayerToGame,
    recreateGameFromState,
    isCustomAvatar,
    MAX_CUSTOM_AVATAR_LENGTH
} = require('../game-logic');

const readFile = (relativePath) =>
    fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

const DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
// addPlayerToGame only honors a provided playerId if it is a valid UUID
const PLAYER_ID = '11111111-1111-1111-1111-111111111111';

describe('isCustomAvatar validation gate', () => {
    test('accepts the three safe raster image types', () => {
        expect(isCustomAvatar('data:image/jpeg;base64,/9j/AA==')).toBe(true);
        expect(isCustomAvatar('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
        expect(isCustomAvatar('data:image/webp;base64,UklGRg==')).toBe(true);
    });

    test('rejects emoji, other schemes and other MIME types', () => {
        expect(isCustomAvatar('😀')).toBe(false);
        expect(isCustomAvatar('javascript:alert(1)')).toBe(false);
        expect(isCustomAvatar('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
        expect(isCustomAvatar('data:image/svg+xml;base64,AAAA')).toBe(false);
        expect(isCustomAvatar('data:image/jpeg;base64,AB CD')).toBe(false);
        expect(isCustomAvatar(null)).toBe(false);
        expect(isCustomAvatar(42)).toBe(false);
    });

    test('enforces the length limit exactly at the boundary', () => {
        const prefix = 'data:image/jpeg;base64,';
        const atLimit = prefix + 'A'.repeat(MAX_CUSTOM_AVATAR_LENGTH - prefix.length);
        const overLimit = atLimit + 'A';

        expect(atLimit.length).toBe(MAX_CUSTOM_AVATAR_LENGTH);
        expect(isCustomAvatar(atLimit)).toBe(true);
        expect(isCustomAvatar(overLimit)).toBe(false);
    });
});

describe('Custom avatars flow through the game logic', () => {
    let games, gameId;

    beforeEach(() => {
        games = new Map();
        gameId = createGame(games).gameId;
    });

    test('a player can join with a data URL avatar', () => {
        const result = addPlayerToGame(games, gameId, 'Alice', DATA_URL, PLAYER_ID);

        expect(result.success).toBe(true);
        expect(result.player.avatar).toBe(DATA_URL);
    });

    test('a reconnect with the same playerId can switch emoji -> photo', () => {
        addPlayerToGame(games, gameId, 'Alice', '😀', PLAYER_ID);
        const result = addPlayerToGame(games, gameId, 'Alice', DATA_URL, PLAYER_ID);

        expect(result.success).toBe(true);
        expect(result.isNewPlayer).toBe(false);
        expect(result.player.avatar).toBe(DATA_URL);
    });

    test('recreate-game keeps data URL avatars intact', () => {
        const savedState = {
            players: [
                { id: 'player-1', name: 'Alice', avatar: DATA_URL, stickerColor: 'red' },
                { id: 'player-2', name: 'Bob', avatar: '😎', stickerColor: 'blue' }
            ],
            gameState: 'waiting'
        };

        const result = recreateGameFromState(games, 'ABC123', savedState);

        expect(result.success).toBe(true);
        const game = games.get('ABC123');
        expect(game.players[0].avatar).toBe(DATA_URL);
        expect(game.players[1].avatar).toBe('😎');
    });
});

describe('Upload button markup (index.html)', () => {
    const indexHtml = readFile('public/index.html');
    const uploadButton = indexHtml.match(/<button[^>]*id="uploadAvatar"[\s\S]*?<\/button>/);

    test('the upload control is a real button that cannot submit the form', () => {
        expect(uploadButton).not.toBeNull();
        expect(uploadButton[0]).toContain('type="button"');
        expect(uploadButton[0]).toContain('btn-outline-primary');
    });

    test('the upload button is localized via data-i18n attributes', () => {
        expect(uploadButton[0]).toContain('data-i18n-title="uploadAvatar"');
        expect(uploadButton[0]).toContain('data-i18n-aria-label="uploadAvatar"');
    });

    test('the icon is hidden from screen readers', () => {
        expect(uploadButton[0]).toContain('aria-hidden="true"');
        expect(uploadButton[0]).toContain('focusable="false"');
    });

    test('the upload button lives outside the avatar grid', () => {
        const gridMatch = indexHtml.match(/<div class="avatar-selector"[\s\S]*?<\/div>/);
        expect(gridMatch[0]).not.toContain('uploadAvatar');
    });

    test('the hidden file input accepts only images', () => {
        const fileInput = indexHtml.match(/<input[^>]*id="avatarFileInput"[^>]*>/);
        expect(fileInput).not.toBeNull();
        expect(fileInput[0]).toContain('type="file"');
        expect(fileInput[0]).toContain('accept="image/*"');
        expect(fileInput[0]).toContain('hidden');
    });
});

describe('Rendering is XSS-safe (client wiring)', () => {
    const gameJs = readFile('public/js/game.js');
    const gameRoomJs = readFile('public/js/game-room.js');
    const styleCss = readFile('public/css/style.css');

    test('game-room.js renders an <img> only behind the isCustomAvatar guard', () => {
        expect(gameRoomJs).toMatch(/isCustomAvatar\(player\.avatar\)/);
        expect(gameRoomJs).toMatch(/img\.src = player\.avatar/);
        expect(gameRoomJs).not.toContain('avatarEl.innerHTML');
    });

    test('populateAvatars branches on isCustomAvatar for grid tiles', () => {
        expect(gameJs).toMatch(/isCustomAvatar\(value\)/);
        expect(gameJs).not.toContain('avatarOption.innerHTML');
    });

    test('a click on the tile image counts as a click on the tile', () => {
        const tileImageCss = styleCss.match(/\.avatar-option img \{[\s\S]*?\}/);
        expect(tileImageCss).not.toBeNull();
        expect(tileImageCss[0]).toContain('pointer-events: none');
    });

    test('uploading alone does not save the avatar - only create/join do', () => {
        const uploadHandler = gameJs.match(/avatarFileInput\.addEventListener\('change'[\s\S]*?\n\s*\}\);/);
        expect(uploadHandler).not.toBeNull();
        expect(uploadHandler[0]).not.toContain("Storage.set('whoami-player-avatar'");
    });
});
