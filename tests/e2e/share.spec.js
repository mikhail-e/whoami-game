// Sending the room link: the Share button (the phone's share sheet, or a copy
// where there is none) and Copy Link. The real share sheet never opens in a
// test: it would stop the browser, so stubShare() stands in for it
const { test, expect, text, createRoom, stubShare } = require('./helpers');

const shareButton = page => page.getByRole('button', { name: text('share') });

test('Share opens the share sheet with the room link', async ({ newPlayer }) => {
    const alice = await newPlayer('Alice');
    await stubShare(alice.page, 'record');
    const code = await createRoom(alice);

    await expect(shareButton(alice.page)).toHaveAttribute('type', 'button');
    await shareButton(alice.page).click();

    await expect.poll(() => alice.page.evaluate(() => window.shareCalls.length)).toBe(1);
    const [shared] = await alice.page.evaluate(() => window.shareCalls);
    expect(shared.url).toMatch(new RegExp(`/game/${code}$`));
    expect(shared.text).toBe(text('shareText'));
});

test('closing the share sheet is silent', async ({ newPlayer }) => {
    const alice = await newPlayer('Alice');
    await stubShare(alice.page, 'abort');
    await createRoom(alice);

    await shareButton(alice.page).click();

    await expect.poll(() => alice.page.evaluate(() => window.shareCalls.length)).toBe(1);
    // No copy fallback, no message; an error would fail the guard. Read the
    // label once, right after the call: a "Copied!" flash goes away by itself,
    // so waiting for its absence would always succeed
    expect(await alice.page.locator('#shareButton').textContent()).not.toContain(text('copiedSuccess'));
});

test('without Web Share the link is copied', async ({ newPlayer }) => {
    const alice = await newPlayer('Alice');
    await stubShare(alice.page, 'unsupported');
    const code = await createRoom(alice);

    await alice.page.locator('#shareButton').click();

    await expect(alice.page.locator('#shareButton')).toHaveText(text('copiedSuccess'));
    await expect(alice.page.locator('#shareLink')).toHaveValue(new RegExp(`/game/${code}$`));
});

test('Copy Link confirms the copy', async ({ newPlayer }) => {
    const alice = await newPlayer('Alice');
    const code = await createRoom(alice);

    await alice.page.locator('#copyLink').click();

    await expect(alice.page.locator('#copyLink')).toHaveText(text('copiedSuccess'));
    await expect(alice.page.locator('#shareLink')).toHaveValue(new RegExp(`/game/${code}$`));
});
