/**
 * App version tests
 * The version is written in one place, package.json. The server answers it at
 * /api/version and every page shows it at the bottom, so anyone can see which
 * release is live (docs/release.md checks it after a deploy).
 */
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { app } = require('../server');
const { version } = require('../package.json');

const readPublic = (file) => fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');

describe('App version', () => {
    test('GET /api/version answers the version from package.json', async () => {
        const response = await request(app).get('/api/version');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ version });
    });

    test.each(['index.html', 'game.html'])('%s shows the version in its footer', (page) => {
        expect(readPublic(page)).toMatch(/<footer[^>]*>[\s\S]*?data-app-version[\s\S]*?<\/footer>/);
    });

    test('utils.js loads the version for every page', () => {
        const utilsJs = readPublic('js/utils.js');

        expect(utilsJs).toMatch(/fetch\('\/api\/version'\)/);
        expect(utilsJs).toMatch(/document\.addEventListener\('DOMContentLoaded', showAppVersion\)/);
    });
});
