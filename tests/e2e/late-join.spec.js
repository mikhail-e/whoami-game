// Joining a started game: a latecomer asks, waits on the room page without
// seeing the room, and any player lets them in or declines (the rules:
// tests/late-join.test.js)
const {
    test, expect, text, playerCard, startedGame, waitForPlayers, askToJoin, waitForLanding, assignCharacter,
    revealOwnCharacter,
} = require('./helpers');

/* global socket, io, joinRequestQueue, PLAYER_ID, PLAYER_SECRET -- the room page's names (game-room.js, utils.js), inside page.evaluate() */

const requestWindow = page => page.locator('#joinRequestModal');
const notifications = page => page.locator('.alert.position-fixed');

// The request window shows this newcomer
async function expectRequestFrom(page, name) {
    await expect(requestWindow(page)).toHaveClass(/\bshow\b/);
    await expect(page.locator('#joinRequestName')).toHaveText(name);
}

test('a newcomer waits without seeing the room', async ({ newPlayer }) => {
    const { code } = await startedGame(newPlayer, ['Alice', 'Bob']);
    const dasha = await newPlayer('Dasha');

    await askToJoin(dasha, code);

    await expect(dasha.page.locator('#waitingName')).toHaveText('Dasha');
    await expect(dasha.page.locator('.seal-spinner')).toBeVisible();
    await expect(dasha.page.getByRole('status')).toHaveText(text('waitingForAdmission'));
    await expect(dasha.page.locator('.player-card')).toHaveCount(0);
    // Nothing of the room: not its status line, not its buttons
    await expect(dasha.page.locator('#gameStatus')).toBeHidden();
    await expect(dasha.page.locator('#leaveGame')).toBeHidden();
});

test('any player can let a newcomer in', async ({ newPlayer }) => {
    const { code, players: { Alice: alice, Bob: bob } } = await startedGame(newPlayer, ['Alice', 'Bob']);
    const dasha = await newPlayer('Dasha');
    await askToJoin(dasha, code);

    // Bob did not start the game
    await expectRequestFrom(bob.page, 'Dasha');
    await bob.page.getByRole('button', { name: text('admitPlayer') }).click();

    await waitForPlayers(dasha.page, 3);
    await expect(dasha.page.locator('#waitingSheet')).toBeHidden();
    await expect(playerCard(alice.page, 'Dasha')).toBeVisible();
    await expect(notifications(alice.page)).toContainText(text('playerAdmittedNotification', 'en', { playerName: 'Dasha' }));
});

test('the first answer decides', async ({ newPlayer }) => {
    const { code, players: { Alice: alice, Bob: bob } } = await startedGame(newPlayer, ['Alice', 'Bob']);
    const dasha = await newPlayer('Dasha');
    await askToJoin(dasha, code);
    await expectRequestFrom(alice.page, 'Dasha');
    await expectRequestFrom(bob.page, 'Dasha');

    await alice.page.getByRole('button', { name: text('admitPlayer') }).click();

    await expect(requestWindow(bob.page)).not.toHaveClass(/\bshow\b/);
    await waitForPlayers(bob.page, 3);
});

// Two players pressed at once: the second answer reaches the server after the
// first. The window closes for both, and nobody gets an error in their face
test('a late answer to an answered request shows nothing', async ({ newPlayer }) => {
    const { code, players: { Alice: alice, Bob: bob } } = await startedGame(newPlayer, ['Alice', 'Bob']);
    const dasha = await newPlayer('Dasha');
    await askToJoin(dasha, code);
    const dashaId = await dasha.page.evaluate(() => PLAYER_ID);
    await expectRequestFrom(bob.page, 'Dasha');

    await alice.page.getByRole('button', { name: text('admitPlayer') }).click();
    await expect(requestWindow(bob.page)).not.toHaveClass(/\bshow\b/);

    const error = await bob.page.evaluate(id => new Promise(resolve => {
        socket.once('error', resolve);
        socket.emit('admit-player', { playerId: id });
    }), dashaId);
    // The server's answer has arrived and the page has handled it: an alert
    // would fail the test (the guard of newPlayer)
    expect(error).toBe('This request has already been answered');
});

test('a declined newcomer goes home and may ask again', async ({ newPlayer }) => {
    const { code, players: { Alice: alice, Bob: bob } } = await startedGame(newPlayer, ['Alice', 'Bob']);
    const dasha = await newPlayer('Dasha');
    await askToJoin(dasha, code);
    await expectRequestFrom(bob.page, 'Dasha');

    await bob.page.getByRole('button', { name: text('declinePlayer') }).click();

    await expect(dasha.page).toHaveURL(new RegExp(`/\\?join=${code}&error=join-declined$`));
    await expect(dasha.page.locator('.alert-danger')).toContainText(text('joinDeclined'));
    await waitForLanding(dasha.page);
    await expect(dasha.page.locator('#roomCode')).toHaveValue(code);
    await expect(requestWindow(alice.page)).not.toHaveClass(/\bshow\b/);
    await waitForPlayers(alice.page, 2);

    await askToJoin(dasha, code);
    await expectRequestFrom(alice.page, 'Dasha');
});

test("a newcomer's name is shown as text", async ({ newPlayer }) => {
    const { code, players: { Alice: alice } } = await startedGame(newPlayer, ['Alice', 'Bob']);
    const dasha = await newPlayer('<b>Dasha</b>');

    await askToJoin(dasha, code);

    await expect(dasha.page.locator('#waitingName')).toHaveText('<b>Dasha</b>');
    await expectRequestFrom(alice.page, '<b>Dasha</b>');
    expect(await dasha.page.locator('#waitingName b').count()).toBe(0);
    expect(await alice.page.locator('#joinRequestName b').count()).toBe(0);
});

test('two newcomers wait in turn', async ({ newPlayer }) => {
    const { code, players: { Alice: alice } } = await startedGame(newPlayer, ['Alice', 'Bob']);
    const dasha = await newPlayer('Dasha');
    const eve = await newPlayer('Eve');
    await askToJoin(dasha, code);
    await expectRequestFrom(alice.page, 'Dasha');
    await askToJoin(eve, code);
    // Eve's request has reached Alice's page, behind Dasha's window
    await expect.poll(() => alice.page.evaluate(() => joinRequestQueue.length)).toBe(2);

    await alice.page.getByRole('button', { name: text('admitPlayer') }).click();

    await waitForPlayers(dasha.page, 3);
    await expectRequestFrom(alice.page, 'Eve');
});

test('a request waits while another window is open', async ({ newPlayer }) => {
    const { code, players: { Alice: alice, Bob: bob } } = await startedGame(newPlayer, ['Alice', 'Bob']);
    await playerCard(alice.page, 'Alice').locator('.character-sticker.mystery').click();
    await expect(alice.page.locator('#revealModal')).toHaveClass(/\bshow\b/);
    const dasha = await newPlayer('Dasha');

    await askToJoin(dasha, code);
    // Once the request has reached Bob, it has reached Alice too
    await expectRequestFrom(bob.page, 'Dasha');
    expect(await requestWindow(alice.page).evaluate(modal => modal.classList.contains('show'))).toBe(false);

    await alice.page.locator('#revealModal .btn-secondary').click();
    await expectRequestFrom(alice.page, 'Dasha');
});

test('the request window closes only by its buttons', async ({ newPlayer }) => {
    const { code, players: { Alice: alice } } = await startedGame(newPlayer, ['Alice', 'Bob']);
    const dasha = await newPlayer('Dasha');
    await askToJoin(dasha, code);
    await expectRequestFrom(alice.page, 'Dasha');

    await alice.page.keyboard.press('Escape');
    // Outside the window: the backdrop
    await alice.page.mouse.click(5, 5);

    expect(await requestWindow(alice.page).evaluate(modal => modal.classList.contains('show'))).toBe(true);
    await expect(dasha.page.locator('#waitingSheet')).toBeVisible();
});

// Dasha types into her console: a socket of her own asks with her real ID and
// secret, then tries to let herself in. A waiting socket is not a player's
test('a waiting socket cannot let itself in', async ({ newPlayer }) => {
    const { code, players: { Alice: alice } } = await startedGame(newPlayer, ['Alice', 'Bob']);
    const dasha = await newPlayer('Dasha');
    await askToJoin(dasha, code);
    await expectRequestFrom(alice.page, 'Dasha');

    const error = await dasha.page.evaluate(gameId => new Promise(resolve => {
        const own = io({ forceNew: true });
        own.on('connect', () => {
            own.emit('ask-to-join', { gameId, playerId: PLAYER_ID, playerSecret: PLAYER_SECRET, playerName: 'Dasha', avatar: '🐻' });
            own.emit('admit-player', { playerId: PLAYER_ID });
        });
        own.on('error', message => {
            own.disconnect();
            resolve(message);
        });
    }), code);

    expect(error).toBe('You are not in this game');
    await waitForPlayers(alice.page, 2);
    await expect(dasha.page.locator('#waitingSheet')).toBeVisible();
});

// A started round of Alice and Bob, and Dasha let in by Bob
async function admittedNewcomer(newPlayer) {
    const { code, players: { Alice: alice, Bob: bob } } = await startedGame(newPlayer, ['Alice', 'Bob']);
    const dasha = await newPlayer('Dasha');
    await askToJoin(dasha, code);
    await expectRequestFrom(bob.page, 'Dasha');
    await bob.page.getByRole('button', { name: text('admitPlayer') }).click();
    await waitForPlayers(dasha.page, 3);
    return { alice, bob, dasha };
}

test('a newcomer gets a character from any player and plays on', async ({ newPlayer }) => {
    const { alice, bob, dasha } = await admittedNewcomer(newPlayer);
    const own = playerCard(dasha.page, 'Dasha').locator('.character-sticker');

    // An envelope still open: nothing in it yet, nothing to press
    await expect(own).toHaveClass(/\bopen-envelope\b/);
    await expect(own).toHaveText(text('envelopeEmpty'));
    await expect(own).toHaveAttribute('title', text('noCharacterYet'));
    await expect(own.locator('.seal')).toHaveCount(0);
    await expect(dasha.page.locator('#gameStatus')).toHaveText(text('waitingForCharacter'));

    await assignCharacter(bob, 'Dasha', 'Gandalf');

    await expect(own.locator('.seal')).toBeVisible();
    await expect(own).not.toHaveClass(/\bopen-envelope\b/);
    await expect(dasha.page.locator('#gameStatus')).toHaveText(text('gameInProgress'));
    // Given once, the character stays
    await playerCard(alice.page, 'Dasha').locator('.character-sticker').click();
    expect(await alice.page.locator('.character-input').count()).toBe(0);

    await revealOwnCharacter(dasha);
    await expect(own).toHaveText('Gandalf');
});

test('a newcomer without a character keeps the empty envelope after a reload', async ({ newPlayer }) => {
    const { alice, dasha } = await admittedNewcomer(newPlayer);

    await dasha.page.reload();

    await expect(playerCard(dasha.page, 'Dasha').locator('.character-sticker.open-envelope')).toBeVisible();
    await expect(playerCard(alice.page, 'Dasha').locator('.add-character-btn')).toBeVisible();
});
