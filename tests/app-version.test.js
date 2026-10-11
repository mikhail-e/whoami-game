/**
 * App version tests
 * The version is written in one place, package.json. The server answers it at
 * /api/version; tests/e2e/site.spec.js checks that every page shows it at the
 * bottom (docs/release.md checks it on production after a deploy).
 */
const request = require('supertest');
const { app } = require('../server');
const { version } = require('../package.json');

describe('App version', () => {
    test('GET /api/version answers the version from package.json', async () => {
        const response = await request(app).get('/api/version');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ version });
    });
});
