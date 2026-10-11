// The started game: the mystery sticker, revealing your character, restarting
const { test, expect, text, playerCard, startedGame, revealOwnCharacter } = require('./helpers');

const notifications = page => page.locator('.alert.position-fixed');

test('your own sticker is the light dashed 🎭 that reveals your character', async ({ newPlayer }) => {
    const { players: { Alice: alice } } = await startedGame(newPlayer, ['Alice', 'Bob']);
    const own = playerCard(alice.page, 'Alice').locator('.character-sticker');

    await expect(own).toHaveClass(/\bmystery\b/);
    await expect(own).toHaveText('🎭');
    await expect(own).not.toHaveClass(/\bcolor-/);
    await expect(own).toHaveAttribute('title', text('yourCharacterClickReveal'));
    expect(await own.evaluate(sticker => getComputedStyle(sticker).borderTopStyle)).toBe('dashed');
    await expect(alice.page.locator('#gameSteps li').nth(3)).toContainText('🎭');
});

test("the others' characters keep their player colors", async ({ newPlayer }) => {
    const { players, characters } = await startedGame(newPlayer, ['Alice', 'Bob', 'Carol']);

    for (const name of ['Bob', 'Carol']) {
        const sticker = playerCard(players.Alice.page, name).locator('.character-sticker');
        await expect(sticker).toHaveText(characters[name]);
        await expect(sticker).toHaveClass(/\bcolor-[a-z]+\b/);
    }
});

test('characters cannot be edited after the start', async ({ newPlayer }) => {
    const { players: { Alice: alice } } = await startedGame(newPlayer, ['Alice', 'Bob']);

    await playerCard(alice.page, 'Bob').locator('.character-sticker').click();

    await expect(alice.page.locator('.character-input')).toHaveCount(0);
});

test('Cancel in the reveal window reveals nothing', async ({ newPlayer }) => {
    const { players: { Alice: alice, Bob: bob } } = await startedGame(newPlayer, ['Alice', 'Bob']);

    await playerCard(alice.page, 'Alice').locator('.character-sticker.mystery').click();
    await expect(alice.page.locator('#revealModal')).toHaveClass(/\bshow\b/);
    await alice.page.locator('#revealModal .btn-secondary').click();

    await expect(alice.page.locator('#revealModal')).not.toHaveClass(/\bshow\b/);
    await expect(playerCard(alice.page, 'Alice').locator('.character-sticker.mystery')).toBeVisible();
    await expect(notifications(bob.page)).toHaveCount(0);
});

test('revealing shows your character and tells everyone', async ({ newPlayer }) => {
    const { players: { Alice: alice, Bob: bob }, characters } = await startedGame(newPlayer, ['Alice', 'Bob']);

    await revealOwnCharacter(alice);

    await expect(playerCard(alice.page, 'Alice').locator('.character-sticker')).toHaveText(characters.Alice);
    await expect(notifications(bob.page)).toContainText(
        text('playerRevealedNotification', 'en', { playerName: 'Alice', character: characters.Alice }));
    await expect(playerCard(bob.page, 'Alice').locator('.character-sticker.revealed')).toHaveText(characters.Alice);
});

test('restart returns the room to assigning characters', async ({ newPlayer }) => {
    const { players: { Alice: alice, Bob: bob } } = await startedGame(newPlayer, ['Alice', 'Bob']);

    await alice.page.click('#restartGame');
    await expect(alice.page.locator('#restartModal')).toHaveClass(/\bshow\b/);
    await alice.page.click('#confirmRestart');

    for (const page of [alice.page, bob.page]) {
        await expect(page.locator('.character-sticker')).toHaveCount(0);
        await expect(page.locator('.add-character-btn')).toHaveCount(1);
        await expect(page.locator('#startGame')).toBeDisabled();
        await expect(page.locator('#restartGame')).toBeHidden();
    }
});
