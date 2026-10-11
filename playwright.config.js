// @ts-check
// Browser tests: the real game in Chromium, on a phone and on a desktop, with
// several players per room (docs/testing.md).
//
// Tests start their own server on port 3100, so a running `npm start` (3000)
// does not interfere, and never reuse one: a server left running would test
// yesterday's server.js. With BASE_URL set (npm run test:e2e:prod) the same
// tests run against that address and no server is started; the free Render
// plan may take up to a minute to wake, hence the longer timeouts.
const { defineConfig, devices } = require('@playwright/test');

const TEST_PORT = 3100;
const BASE_URL = process.env.BASE_URL;

module.exports = defineConfig({
    testDir: './tests/e2e',
    testMatch: '**/*.spec.js',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: [['list'], ['html', { open: 'never' }]],
    timeout: BASE_URL ? 120_000 : 30_000,
    expect: { timeout: BASE_URL ? 15_000 : 5_000 },

    use: {
        baseURL: BASE_URL || `http://localhost:${TEST_PORT}`,
        locale: 'en-US',
        // Bootstrap skips its fade animations: modals open at once, and axe
        // never measures half-transparent text
        reducedMotion: 'reduce',
        // The service worker stays on, as for players: it only caches icons, and
        // its update banner needs a new sw.js, which never happens during a run.
        // ('block' makes register() resolve to nothing, and pwa.js reports that
        // as an error a real browser never gives.)
        serviceWorkers: 'allow',
        trace: 'retain-on-failure',
    },

    // The game is played on phones first
    projects: [
        { name: 'mobile', use: { ...devices['Pixel 7'] } },
        { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    ],

    ...(!BASE_URL && {
        webServer: {
            command: 'node server.js',
            env: { PORT: String(TEST_PORT) },
            url: `http://localhost:${TEST_PORT}/api/version`,
            reuseExistingServer: false,
        },
    }),
});
