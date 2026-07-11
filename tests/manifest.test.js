// Tests for the PWA manifest - the invariants installability and link
// handling depend on. Style follows tests/service-worker.test.js: read the
// real file from disk and check its contents.
//
// Link-capturing reality check (why these fields matter):
// - iOS cannot open links in an installed web app at all (platform limit)
// - Android (installed via Chrome) captures in-scope links because scope is "/"
// - launch_handler controls window reuse when a link IS captured

const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'public', 'manifest.json');

describe('PWA manifest', () => {
    let manifest;

    beforeAll(() => {
        // JSON.parse throws on invalid JSON, failing the suite loudly
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    });

    test('scope covers the whole site, so /game/* links belong to the app', () => {
        expect(manifest.scope).toBe('/');
        expect(manifest.start_url).toBe('/');
    });

    test('installs as a standalone app', () => {
        expect(manifest.display).toBe('standalone');
    });

    test('captured links reuse the already-open app window', () => {
        expect(manifest.launch_handler).toEqual({ client_mode: 'navigate-existing' });
    });

    test('has the icon sizes required for installation (192 and 512)', () => {
        const sizes = manifest.icons.map(icon => icon.sizes);
        expect(sizes).toContain('192x192');
        expect(sizes).toContain('512x512');
    });

    test('every icon file referenced in the manifest exists', () => {
        for (const icon of manifest.icons) {
            const iconPath = path.join(__dirname, '..', 'public', icon.src);
            expect(fs.existsSync(iconPath)).toBe(true);
        }
    });
});
