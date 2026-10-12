// English and Russian: the browser's language, the saved choice, the switch,
// and texts the game builds itself (status, cards, notifications)
const {
    test, expect, text, serverErrorText, seedStorage, createRoom, joinRoom, playerCard, waitForPlayers, waitForLanding,
    startedGame, revealOwnCharacter,
} = require('./helpers');

// i18n: the page's Localization from translations.js, used inside page.evaluate()
/* global i18n */

const heading = page => page.locator('h1');

test('a Russian browser gets Russian', async ({ newPlayer }) => {
    const { page } = await newPlayer('Алиса', { locale: 'ru-RU' });

    await page.goto('/');

    await expect(heading(page)).toHaveText(text('title', 'ru'));
});

test('an unknown language falls back to English', async ({ newPlayer }) => {
    const { page } = await newPlayer('Anna', { locale: 'de-DE' });

    await page.goto('/');

    await expect(heading(page)).toHaveText(text('title', 'en'));
});

test('the saved choice beats the browser language', async ({ newPlayer }) => {
    const alice = await newPlayer('Alice');
    await seedStorage(alice, { 'whoami-language': 'ru' });

    await alice.page.reload();

    await expect(heading(alice.page)).toHaveText(text('title', 'ru'));
});

test('an invalid saved language is ignored', async ({ newPlayer }) => {
    const alice = await newPlayer('Alice');
    await seedStorage(alice, { 'whoami-language': 'xx' });

    await alice.page.reload();

    await expect(heading(alice.page)).toHaveText(text('title', 'en'));
});

test('the switch changes texts, placeholders, titles and aria-labels and is remembered', async ({ newPlayer }) => {
    const { page } = await newPlayer('Alice');
    await page.goto('/');

    await page.locator('.lang-toggle-btn').click();

    await expect(heading(page)).toHaveText(text('title', 'ru'));
    await expect(page.locator('#playerName')).toHaveAttribute('placeholder', text('enterName', 'ru'));
    await expect(page.locator('#shuffleAvatars')).toHaveAttribute('title', text('shuffleAvatars', 'ru'));
    await expect(page.locator('#shuffleAvatars')).toHaveAttribute('aria-label', text('shuffleAvatars', 'ru'));

    await page.reload();
    await expect(heading(page)).toHaveText(text('title', 'ru'));
});

test('in a room the switch re-renders the status and the cards', async ({ newPlayer }) => {
    const alice = await newPlayer('Alice');
    const bob = await newPlayer('Bob', { locale: 'ru-RU' });
    const code = await createRoom(alice);
    await joinRoom(bob, code);
    await waitForPlayers(alice.page, 2);
    await expect(alice.page.locator('#gameStatus')).toHaveText(text('assignCharacters', 'en'));

    await alice.page.locator('.lang-toggle-btn').click();

    await expect(alice.page.locator('#gameStatus')).toHaveText(await bob.page.locator('#gameStatus').textContent());
    await expect(playerCard(alice.page, 'Alice').locator('.player-name')).toHaveText(`Alice (${text('you', 'ru')})`);
});

test("the reveal notification reads in each player's language", async ({ newPlayer }) => {
    const { players: { Alice: alice, Bob: bob }, characters } = await startedGame(newPlayer, ['Alice', 'Bob']);
    await bob.page.locator('.lang-toggle-btn').click();
    await expect(heading(bob.page)).toHaveText(text('title', 'ru'));

    await revealOwnCharacter(alice);

    await expect(bob.page.locator('.alert.position-fixed')).toContainText(
        text('playerRevealedNotification', 'ru', { playerName: 'Alice', character: characters.Alice }));
    await expect(alice.page.locator('.alert.position-fixed')).toContainText(
        text('playerRevealedNotification', 'en', { playerName: 'Alice', character: characters.Alice }));
});

test("a server error reads in the player's language", async ({ newPlayer }) => {
    const { code } = await startedGame(newPlayer, ['Alice', 'Bob']);
    const dasha = await newPlayer('Даша', { locale: 'ru-RU' });
    dasha.expectDialog(serverErrorText('Game has already started', 'ru'));
    // The server answers 400; the browser logs that response itself
    dasha.allowConsoleError(/status of 400/);

    await dasha.page.goto(`/?join=${code}`);
    await waitForLanding(dasha.page);
    await dasha.page.fill('#playerName', 'Даша');
    await dasha.page.click('#joinBtn');

    await expect.poll(() => dasha.expectedDialogs.length).toBe(0);
});

test('an unknown text key shows the key itself', async ({ newPlayer }) => {
    const { page } = await newPlayer('Alice');
    await page.goto('/');

    expect(await page.evaluate(() => i18n.getText('noSuchKey'))).toBe('noSuchKey');
});
