// The site's own rules: only its own code on its pages, the security headers
const { test, expect, createRoom, waitForLanding } = require('./helpers');

test('the pages load nothing from other sites', async ({ newPlayer, baseURL }) => {
    const alice = await newPlayer('Alice');
    const origin = new URL(baseURL).origin;
    const foreign = [];
    alice.page.on('request', request => {
        const url = request.url();
        if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) foreign.push(url);
    });

    await createRoom(alice);
    await alice.page.goto('/');
    await waitForLanding(alice.page);
    await alice.page.waitForLoadState('load');

    expect(foreign).toEqual([]);
});
