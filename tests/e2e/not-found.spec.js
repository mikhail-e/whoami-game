// An address nobody answers gets the game's own page, public/404.html, with
// status 404 - at any depth, so its links all start at the site root
const { test, expect, text, waitForLanding } = require('./helpers');

// The browser reports the page's own status 404 in the console: expected here
const PAGE_STATUS_404 = /^Failed to load resource: the server responded with a status of 404/;

test('a missing address answers 404 with a page in the style of the game', async ({ newPlayer, baseURL }) => {
    const alice = await newPlayer('Alice');
    alice.allowConsoleError(PAGE_STATUS_404);
    const { page } = alice;
    const origin = new URL(baseURL).origin;
    const failedFiles = [];
    page.on('response', response => {
        if (response.url().startsWith(origin) && response.request().resourceType() !== 'document' && !response.ok()) {
            failedFiles.push(`${response.status()} ${response.url()}`);
        }
    });

    const response = await page.goto('/no-such/page/here');

    expect(response.status()).toBe(404);
    await expect(page.getByRole('heading', { name: text('notFoundTitle') })).toBeVisible();
    await page.waitForLoadState('load');
    expect(failedFiles).toEqual([]);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundImage)).toContain('linear-gradient');

    await page.getByRole('link', { name: text('openGame') }).click();
    await waitForLanding(page);
});

test("the 404 page speaks the player's language", async ({ newPlayer }) => {
    const alice = await newPlayer('Алиса', { locale: 'ru-RU' });
    alice.allowConsoleError(PAGE_STATUS_404);
    const { page } = alice;
    await page.goto('/no-such-page');
    await expect(page.getByRole('heading', { name: text('notFoundTitle', 'ru') })).toBeVisible();
});

test('an unknown API address answers 404, not a page of the game', async ({ request }) => {
    const response = await request.get('/api/no-such-thing');
    expect(response.status()).toBe(404);
    expect(await response.text()).toContain('data-i18n="notFoundTitle"');
});
