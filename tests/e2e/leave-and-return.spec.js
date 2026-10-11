// Leaving a room, coming back to it, reloading the page: one person is always
// one player
const {
    test, expect, text, seedStorage, createRoom, joinRoom, playerCard, waitForPlayers, startedGame, leaveGame,
} = require('./helpers');

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const storedPlayerId = page => page.evaluate(() => localStorage.getItem('playerId'));
const listedNames = page => page.locator('.player-name').evaluateAll(names =>
    names.map(name => name.firstChild.textContent));

async function roomWith(newPlayer, names) {
    const players = [];
    for (const name of names) players.push(await newPlayer(name));
    const code = await createRoom(players[0]);
    for (const player of players.slice(1)) await joinRoom(player, code);
    for (const player of players) await waitForPlayers(player.page, players.length);
    return { players, code };
}

test('leaving goes home with the code and the name filled in', async ({ newPlayer }) => {
    const { players: [alice, bob], code } = await roomWith(newPlayer, ['Alice', 'Bob']);

    await leaveGame(bob);

    await expect(bob.page).toHaveURL(new RegExp(`/\\?join=${code}$`));
    await expect(bob.page.locator('#playerName')).toHaveValue('Bob');
    await expect(bob.page.locator('#roomCode')).toHaveValue(code);
    await waitForPlayers(alice.page, 1);
    await expect(alice.page.locator('.alert.position-fixed')).toContainText(
        text('playerLeftNotification', 'en', { playerName: 'Bob' }));
});

test('the last player to leave deletes the room', async ({ newPlayer }) => {
    const { players: [alice, bob], code } = await roomWith(newPlayer, ['Alice', 'Bob']);

    await leaveGame(bob);
    await waitForPlayers(alice.page, 1);
    await leaveGame(alice);

    await expect(alice.page).toHaveURL(/\/$/);
    await alice.page.goto(`/game/${code}`);
    await expect(alice.page).toHaveURL(/\/\?error=room-not-found$/);
});

test('a leaver returns to the started round with the same character, color and place', async ({ newPlayer }) => {
    const { players, code, characters } = await startedGame(newPlayer, ['Alice', 'Bob', 'Carol']);
    const { Alice: alice, Bob: bob } = players;
    const bobsSticker = () => playerCard(alice.page, 'Bob').locator('.character-sticker');
    const colorBefore = (await bobsSticker().getAttribute('class')).match(/\bcolor-[a-z]+\b/)[0];

    await leaveGame(bob);
    await waitForPlayers(alice.page, 2);
    await joinRoom(bob, code);

    await waitForPlayers(alice.page, 3);
    expect(await listedNames(alice.page)).toEqual(['Alice', 'Bob', 'Carol']);
    await expect(bobsSticker()).toHaveText(characters.Bob);
    await expect(bobsSticker()).toHaveClass(new RegExp(`\\b${colorBefore}\\b`));
    await expect(playerCard(bob.page, 'Bob').locator('.character-sticker.mystery')).toBeVisible();
    await expect(bob.page.locator('#restartGame')).toBeVisible();
});

test('a newcomer cannot join a started game', async ({ newPlayer }) => {
    const { code } = await startedGame(newPlayer, ['Alice', 'Bob']);
    const dave = await newPlayer('Dave');
    dave.expectDialog(/already started/i);
    // The server answers 400; the browser logs that response itself
    dave.allowConsoleError(/status of 400/);

    await dave.page.goto(`/game/${code}`);
    await expect(dave.page).toHaveURL(new RegExp(`/\\?join=${code}$`));
    await dave.page.fill('#playerName', 'Dave');
    await dave.page.click('#joinBtn');

    await expect.poll(() => dave.expectedDialogs.length).toBe(0);
    await expect(dave.page).toHaveURL(new RegExp(`/\\?join=${code}$`));
});

test('reloading keeps the same player', async ({ newPlayer }) => {
    const { players: [alice, bob] } = await roomWith(newPlayer, ['Alice', 'Bob']);
    const id = await storedPlayerId(bob.page);
    expect(id).toMatch(UUID_V4);

    await bob.page.reload();

    await waitForPlayers(bob.page, 2);
    expect(await storedPlayerId(bob.page)).toBe(id);
    await waitForPlayers(alice.page, 2);
});

test('reloading during a game keeps your place and your hidden character', async ({ newPlayer }) => {
    const { players: { Alice: alice, Bob: bob }, characters } = await startedGame(newPlayer, ['Alice', 'Bob']);

    await bob.page.reload();

    await expect(playerCard(bob.page, 'Bob').locator('.character-sticker.mystery')).toBeVisible();
    await expect(playerCard(bob.page, 'Alice').locator('.character-sticker')).toHaveText(characters.Alice);
    await waitForPlayers(bob.page, 2);
    await waitForPlayers(alice.page, 2);
});

test('a broken stored player ID is replaced without a double', async ({ newPlayer }) => {
    const alice = await newPlayer('Alice');
    const bob = await newPlayer('Bob');
    const code = await createRoom(alice);
    await seedStorage(bob, { playerId: 'player_123' });

    await joinRoom(bob, code);

    expect(await storedPlayerId(bob.page)).toMatch(UUID_V4);
    await waitForPlayers(alice.page, 2);
    await bob.page.reload();
    await waitForPlayers(bob.page, 2);
    await waitForPlayers(alice.page, 2);
});

test('two browsers get two different player IDs', async ({ newPlayer }) => {
    const { players: [alice, bob] } = await roomWith(newPlayer, ['Alice', 'Bob']);

    const [aliceId, bobId] = [await storedPlayerId(alice.page), await storedPlayerId(bob.page)];

    expect(aliceId).toMatch(UUID_V4);
    expect(bobId).toMatch(UUID_V4);
    expect(aliceId).not.toBe(bobId);
});
