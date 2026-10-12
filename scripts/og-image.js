// Takes the link preview picture: scripts/og-image.html → public/img/og-image.jpg
// (docs/publishing.md). Run it after a change to the source or to the game's
// look: node scripts/og-image.js
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('@playwright/test');

const SOURCE = path.join(__dirname, 'og-image.html');
const PICTURE = path.join(__dirname, '..', 'public', 'img', 'og-image.jpg');

async function main() {
    const browser = await chromium.launch();
    // The size of a preview picture (og:image:width/height in the pages)
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await page.goto(pathToFileURL(SOURCE).href);
    await page.evaluate(() => document.fonts.ready);
    // Quality 90 keeps the picture well under WhatsApp's limit (tests/e2e/link-preview.spec.js)
    await page.screenshot({ path: PICTURE, type: 'jpeg', quality: 90 });
    await browser.close();
    console.log(`Saved ${path.relative(process.cwd(), PICTURE)}`);
}

main();
