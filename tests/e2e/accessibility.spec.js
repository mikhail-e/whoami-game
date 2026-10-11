// WCAG 2.1 AA checks with axe on every screen and window of the game.
// axe cannot measure contrast on the page's gradient background (it reports
// such text as "incomplete", not as a violation): that needs a pixel check
const { AxeBuilder } = require('@axe-core/playwright');
const { test, expect, createRoom, joinRoom, waitForPlayers, playerCard, startedGame } = require('./helpers');

const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// "rule: element, element" for each violation - a readable diff when it fails
async function violations(page, only) {
    // Measure the colors as they end up, not half-way through a CSS transition:
    // on a phone the confirm button sits under the finger that opened its
    // window and turns red, and .mobile-modal-btn animates that change even
    // with reduced motion. A transition can start at any moment, so waiting
    // for running ones is not enough: switch them off for the scan
    await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
    let builder = new AxeBuilder({ page }).withTags(WCAG_21_AA);
    if (only) builder = builder.include(only);
    const result = await builder.analyze();
    return result.violations.map(violation =>
        `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(', ')}`);
}

test('the landing page', async ({ newPlayer }) => {
    const { page } = await newPlayer('Alice');
    await page.goto('/');
    await expect(page.locator('#avatarSelector .avatar-option')).toHaveCount(12);

    expect(await violations(page)).toEqual([]);
});

test('a room while players assign characters', async ({ newPlayer }) => {
    const alice = await newPlayer('Alice');
    const bob = await newPlayer('Bob');
    const code = await createRoom(alice);
    await joinRoom(bob, code);
    await waitForPlayers(alice.page, 2);

    expect(await violations(alice.page)).toEqual([]);
});

test('a started game', async ({ newPlayer }) => {
    const { players: { Alice: alice } } = await startedGame(newPlayer, ['Alice', 'Bob']);

    expect(await violations(alice.page)).toEqual([]);
});

const windows = [
    { id: 'revealModal', open: page => playerCard(page, 'Alice').locator('.character-sticker.mystery').click() },
    { id: 'restartModal', open: page => page.click('#restartGame') },
    { id: 'leaveModal', open: page => page.click('#leaveGame') },
];

for (const { id, open } of windows) {
    test(`the ${id} window`, async ({ newPlayer }) => {
        const { players: { Alice: alice } } = await startedGame(newPlayer, ['Alice', 'Bob']);

        await open(alice.page);
        await expect(alice.page.locator(`#${id}`)).toHaveClass(/\bshow\b/);

        expect(await violations(alice.page, `#${id}`)).toEqual([]);
    });
}
