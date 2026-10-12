// What a link to the game looks like when it is shared: a messenger's bot
// downloads the page and reads the tags in <head> without running the page's
// scripts, then fetches the picture (docs/publishing.md). Search engines and
// AI assistants read robots.txt and llms.txt the same way
const { test, expect, createRoom } = require('./helpers');

// WhatsApp is known to drop a preview picture bigger than this
const MAX_PICTURE_BYTES = 300 * 1024;

// The page's head as a bot reads it: the server's answer, parsed, no scripts run
async function headOf(page, request, url) {
    const html = await (await request.get(url)).text();
    return page.evaluate(source => {
        const doc = new DOMParser().parseFromString(source, 'text/html');
        const tags = {};
        for (const meta of doc.querySelectorAll('meta[property], meta[name]')) {
            tags[meta.getAttribute('property') || meta.getAttribute('name')] = meta.getAttribute('content');
        }
        const ldJson = doc.querySelector('script[type="application/ld+json"]');
        return {
            tags,
            // Facebook reads only property="og:...", X only name="twitter:..."
            misplaced: [...doc.querySelectorAll('meta[name^="og:"], meta[property^="twitter:"]')].map(meta => meta.outerHTML),
            canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
            ldJson: ldJson ? ldJson.textContent : null,
        };
    }, html);
}

const pages = {
    'the landing page': async () => '/',
    'a room': async newPlayer => `/game/${await createRoom(await newPlayer('Alice'))}`,
};

for (const [name, address] of Object.entries(pages)) {
    test(`a link to ${name} shows a card with a title, a description and a picture`, async ({ newPlayer, request }) => {
        const url = await address(newPlayer);
        const { page } = await newPlayer('Reader');
        const { tags, misplaced } = await headOf(page, request, url);

        expect(tags['og:type']).toBe('website');
        expect(tags['og:site_name']).toBe('Who am I?');
        expect(tags['og:title']).toMatch(/^Who am I\?/);
        expect(tags['og:description']).toBeTruthy();
        expect(tags['og:image']).toMatch(/^https:\/\/[^/]+\/.+\.jpg$/);
        expect(tags['og:image:alt']).toBeTruthy();
        expect(tags['twitter:card']).toBe('summary_large_image');
        expect(tags['twitter:title']).toBe(tags['og:title']);
        expect(tags['twitter:description']).toBe(tags['og:description']);
        expect(tags['twitter:image']).toBe(tags['og:image']);
        expect(tags['twitter:image:alt']).toBe(tags['og:image:alt']);
        expect(misplaced).toEqual([]);
    });
}

test('the picture of a card is a 1200×630 JPEG of this site, small enough for WhatsApp', async ({ newPlayer, request }) => {
    const { page } = await newPlayer('Reader');
    const { tags, canonical } = await headOf(page, request, '/');
    const picture = new URL(tags['og:image']);
    expect(picture.origin).toBe(new URL(canonical).origin);

    // The address in the tag is the production one: the file is fetched by its
    // path from the site under test
    const answer = await request.get(picture.pathname);
    expect(answer.status()).toBe(200);
    expect(answer.headers()['content-type']).toBe('image/jpeg');
    expect((await answer.body()).length).toBeLessThan(MAX_PICTURE_BYTES);

    // Measured inside a page of the game: Chrome's own viewer of a bare image
    // styles itself inline, and the Content Security Policy blocks that
    await page.goto('/');
    const size = await page.evaluate(async address => {
        const image = new Image();
        image.src = address;
        await image.decode();
        return `${image.naturalWidth}×${image.naturalHeight}`;
    }, picture.pathname);
    expect(size).toBe('1200×630');
    expect(`${tags['og:image:width']}×${tags['og:image:height']}`).toBe(size);
});

test('the landing page names its own address, and Google gets a description of the game', async ({ newPlayer, request }) => {
    const { page } = await newPlayer('Reader');
    const { tags, canonical, ldJson } = await headOf(page, request, '/');

    expect(canonical).toMatch(/^https:\/\/[^/]+\/$/);
    expect(tags['og:url']).toBe(canonical);
    expect(tags.robots).toBeUndefined();

    const description = JSON.parse(ldJson);
    expect(description['@type']).toBe('WebApplication');
    expect(description.name).toBe('Who am I?');
    expect(description.url).toBe(canonical);
});

test('a room link keeps its card but stays out of search results', async ({ newPlayer, request }) => {
    const url = `/game/${await createRoom(await newPlayer('Alice'))}`;
    const { page } = await newPlayer('Reader');
    const { tags, canonical } = await headOf(page, request, url);

    expect(tags.robots).toBe('noindex');
    // One file serves every room: an address in it would send the card to
    // another page than the room it was shared for
    expect(tags['og:url']).toBeUndefined();
    expect(canonical).toBeNull();

    // Both pages carry the card as a copy of their own: the same game, one card
    const landing = (await headOf(page, request, '/')).tags;
    for (const key of ['og:title', 'og:description', 'og:image', 'og:image:alt', 'og:image:width', 'og:image:height']) {
        expect(tags[key], key).toBe(landing[key]);
    }
});

test('robots.txt lets every robot in, rooms included', async ({ request }) => {
    const answer = await request.get('/robots.txt');
    expect(answer.status()).toBe(200);
    expect(answer.headers()['content-type']).toMatch(/^text\/plain/);
    const rules = await answer.text();
    expect(rules).toMatch(/^User-agent: \*$/m);

    // X shows no card for a page robots.txt closes
    const closed = [...rules.matchAll(/^Disallow:[ \t]*(\S+)/gm)].map(([, prefix]) => prefix)
        .filter(prefix => ['/', '/game/ABC123'].some(address => address.startsWith(prefix)));
    expect(closed).toEqual([]);
});

test('llms.txt describes the game in plain text', async ({ request }) => {
    const answer = await request.get('/llms.txt');
    expect(answer.status()).toBe(200);
    expect(answer.headers()['content-type']).toMatch(/^text\/plain/);
    expect(await answer.text()).toMatch(/^# Who am I\?\n/);
});
