// The room before the game: joining, the players list, assigning characters,
// the Start Game button
const {
    test, expect, createRoom, joinRoom, playerCard, waitForPlayers, assignCharacter, countSentEvents,
} = require('./helpers');

// The names in the list, without the "(You)" label of the viewer's own card
const listedNames = page => page.locator('.player-name').evaluateAll(names =>
    names.map(name => name.firstChild.textContent));

async function roomWith(newPlayer, names) {
    const players = await Promise.all(names.map(name => newPlayer(name)));
    const code = await createRoom(players[0]);
    for (const player of players.slice(1)) await joinRoom(player, code);
    for (const player of players) await waitForPlayers(player.page, players.length);
    return { players, code };
}

test('both players see both cards in join order', async ({ newPlayer }) => {
    const { players: [alice, bob] } = await roomWith(newPlayer, ['Alice', 'Bob']);

    expect(await listedNames(alice.page)).toEqual(['Alice', 'Bob']);
    expect(await listedNames(bob.page)).toEqual(['Alice', 'Bob']);
});

test('two players may have the same name', async ({ newPlayer }) => {
    const { players: [alice] } = await roomWith(newPlayer, ['Alice', 'Sam', 'Sam']);

    await expect(playerCard(alice.page, 'Sam')).toHaveCount(2);
});

test('no + on your own card', async ({ newPlayer }) => {
    const { players: [alice] } = await roomWith(newPlayer, ['Alice', 'Bob']);

    await expect(playerCard(alice.page, 'Alice').locator('.add-character-btn')).toHaveCount(0);
    await expect(playerCard(alice.page, 'Bob').locator('.add-character-btn')).toHaveCount(1);
});

test('Enter saves a character; the target does not see it, the others do', async ({ newPlayer }) => {
    const { players: [alice, bob, carol] } = await roomWith(newPlayer, ['Alice', 'Bob', 'Carol']);

    await assignCharacter(alice, 'Bob', 'Napoleon');

    await expect(playerCard(carol.page, 'Bob').locator('.character-sticker')).toHaveText('Napoleon');
    await expect(playerCard(bob.page, 'Bob').locator('.character-sticker.mystery')).toHaveText('🎭');
    expect(await bob.page.content()).not.toContain('Napoleon');
});

test('clicking away saves the character', async ({ newPlayer }) => {
    const { players: [alice, bob] } = await roomWith(newPlayer, ['Alice', 'Bob']);
    const bobOnAlice = playerCard(alice.page, 'Bob');

    await bobOnAlice.locator('.add-character-btn').click();
    await bobOnAlice.locator('.character-input').fill('Napoleon');
    await alice.page.click('#gameStatus');

    await expect(bobOnAlice.locator('.character-sticker')).toHaveText('Napoleon');
    await expect(playerCard(bob.page, 'Bob').locator('.character-sticker.mystery')).toBeVisible();
});

test('Enter followed by losing focus saves once', async ({ newPlayer }) => {
    const alice = await newPlayer('Alice');
    const bob = await newPlayer('Bob');
    const sent = countSentEvents(alice.page, 'assign-character');
    const code = await createRoom(alice);
    await joinRoom(bob, code);
    await waitForPlayers(alice.page, 2);
    const bobOnAlice = playerCard(alice.page, 'Bob');

    await bobOnAlice.locator('.add-character-btn').click();
    await bobOnAlice.locator('.character-input').fill('Napoleon');
    // Enter, then focus leaves the field before the server answers
    await bobOnAlice.locator('.character-input').evaluate(input => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        input.blur();
    });

    await expect(bobOnAlice.locator('.character-sticker')).toHaveText('Napoleon');
    await expect(playerCard(bob.page, 'Bob').locator('.character-sticker.mystery')).toBeVisible();
    expect(sent()).toBe(1);
});

test('Escape restores the previous character', async ({ newPlayer }) => {
    const { players: [alice] } = await roomWith(newPlayer, ['Alice', 'Bob']);
    await assignCharacter(alice, 'Bob', 'Napoleon');
    const bobOnAlice = playerCard(alice.page, 'Bob');

    await bobOnAlice.locator('.character-sticker').click();
    await bobOnAlice.locator('.character-input').fill('Caesar');
    await bobOnAlice.locator('.character-input').press('Escape');

    await expect(bobOnAlice.locator('.character-input')).toHaveCount(0);
    await expect(bobOnAlice.locator('.character-sticker')).toHaveText('Napoleon');
});

test('an empty or blank character removes it', async ({ newPlayer }) => {
    const { players: [alice, bob] } = await roomWith(newPlayer, ['Alice', 'Bob']);
    await assignCharacter(alice, 'Bob', 'Napoleon');
    await expect(playerCard(bob.page, 'Bob').locator('.character-sticker.mystery')).toBeVisible();
    const bobOnAlice = playerCard(alice.page, 'Bob');

    await bobOnAlice.locator('.character-sticker').click();
    await bobOnAlice.locator('.character-input').fill('   ');
    await bobOnAlice.locator('.character-input').press('Enter');

    await expect(bobOnAlice.locator('.add-character-btn')).toBeVisible();
    await expect(playerCard(bob.page, 'Bob').locator('.character-sticker')).toHaveCount(0);
});

test('the character field stops at the limit', async ({ newPlayer }) => {
    const { players: [alice] } = await roomWith(newPlayer, ['Alice', 'Bob']);
    const bobOnAlice = playerCard(alice.page, 'Bob');

    await bobOnAlice.locator('.add-character-btn').click();
    await bobOnAlice.locator('.character-input').pressSequentially('x'.repeat(200));

    await expect(bobOnAlice.locator('.character-input')).toHaveValue('x'.repeat(128));
});

test('Start Game waits for two players and a character for everyone', async ({ newPlayer }) => {
    const alice = await newPlayer('Alice');
    const bob = await newPlayer('Bob');
    const code = await createRoom(alice);
    const start = page => page.locator('#startGame');

    await expect(start(alice.page)).toBeDisabled();

    await joinRoom(bob, code);
    await waitForPlayers(alice.page, 2);
    await expect(start(alice.page)).toBeDisabled();

    await assignCharacter(alice, 'Bob', 'Napoleon');
    await expect(start(alice.page)).toBeDisabled();

    // A blank character is no character
    await playerCard(bob.page, 'Alice').locator('.add-character-btn').click();
    await playerCard(bob.page, 'Alice').locator('.character-input').fill('   ');
    await playerCard(bob.page, 'Alice').locator('.character-input').press('Enter');
    await expect(playerCard(bob.page, 'Alice').locator('.add-character-btn')).toBeVisible();
    await expect(start(bob.page)).toBeDisabled();

    await assignCharacter(bob, 'Alice', 'Cleopatra');
    await expect(start(alice.page)).toBeEnabled();
    await expect(start(bob.page)).toBeEnabled();
});

test('a name and a character with HTML stay text on every screen', async ({ newPlayer }) => {
    const { players: [alice, bob] } = await roomWith(newPlayer, ['Alice', '<b>Bob</b>']);
    const forged = '<img src=x onerror=alert(1)>';

    await assignCharacter(alice, '<b>Bob</b>', forged);

    for (const page of [alice.page, bob.page]) {
        const card = playerCard(page, '<b>Bob</b>');
        await expect(card).toHaveCount(1);
        await expect(card.locator('.player-name b, .character-sticker img')).toHaveCount(0);
    }
    await expect(playerCard(alice.page, '<b>Bob</b>').locator('.character-sticker')).toHaveText(forged);
    // An alert from onerror would fail the test through the guard
});

test('a lower-case room link opens the room', async ({ newPlayer }) => {
    const alice = await newPlayer('Alice');
    const bob = await newPlayer('Bob');
    const code = await createRoom(alice);

    await bob.page.goto(`/game/${code.toLowerCase()}`);
    await expect(bob.page).toHaveURL(new RegExp(`/\\?join=${code}$`, 'i'));
    await bob.page.fill('#playerName', 'Bob');
    await bob.page.click('#joinBtn');

    await expect(bob.page).toHaveURL(new RegExp(`/game/${code}$`));
    await waitForPlayers(alice.page, 2);
    await waitForPlayers(bob.page, 2);
});

test('a player who joins during an edit appears once the edit ends', async ({ newPlayer }) => {
    const { players: [alice], code } = await roomWith(newPlayer, ['Alice', 'Bob']);
    const carol = await newPlayer('Carol');
    const bobOnAlice = playerCard(alice.page, 'Bob');
    await bobOnAlice.locator('.add-character-btn').click();
    await bobOnAlice.locator('.character-input').fill('Napoleon');

    await joinRoom(carol, code);
    await bobOnAlice.locator('.character-input').press('Enter');

    await waitForPlayers(alice.page, 3);
    await expect(playerCard(alice.page, 'Carol')).toBeVisible();
});
