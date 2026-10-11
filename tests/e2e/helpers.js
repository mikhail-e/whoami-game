// Helpers for the browser tests (docs/testing.md). Every player is a browser
// context of their own - their own localStorage, so their own player ID - and
// every helper acts the way a person would: through pages and buttons.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const base = require('@playwright/test');

// translations.js is a page script: it waits for the page's DOMContentLoaded
// as it loads. Run it apart, with just enough of a page, and take its texts
function loadTranslations() {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'translations.js'), 'utf8');
    const sandbox = { module: { exports: {} }, document: { addEventListener() {} } };
    vm.runInNewContext(source, sandbox);
    return sandbox.module.exports.translations;
}

const translations = loadTranslations();

// A text from translations.js, with {placeholders} filled the way
// Localization.getText fills them: tests never type the game's texts by hand
function text(key, lang = 'en', placeholders = {}) {
    let value = translations[lang][key] || translations.en[key];
    if (value === undefined) {
        throw new Error(`No translation for "${key}"`);
    }
    for (const [placeholder, replacement] of Object.entries(placeholders)) {
        value = value.split(`{${placeholder}}`).join(String(replacement));
    }
    return value;
}

// Collect what must never happen on a player's page unless the test said so:
// a JavaScript error, a console.error, an alert/confirm dialog
function watchForProblems(player) {
    const { page, problems, expectedDialogs, allowedErrors } = player;

    page.on('pageerror', error => problems.push(`${player.name}: page error: ${error.message}`));
    page.on('console', message => {
        if (message.type() !== 'error') return;
        if (allowedErrors.some(pattern => pattern.test(message.text()))) return;
        problems.push(`${player.name}: console.error: ${message.text()}`);
    });
    page.on('dialog', async dialog => {
        const expected = expectedDialogs[0];
        const matches = expected !== undefined && (expected instanceof RegExp
            ? expected.test(dialog.message())
            : dialog.message() === expected);
        if (matches) {
            expectedDialogs.shift();
            await dialog.accept();
        } else {
            problems.push(`${player.name}: unexpected ${dialog.type()}: ${dialog.message()}`);
            await dialog.dismiss();
        }
    });
}

const test = base.test.extend({
    // newPlayer(name, { locale }) opens a new browser context on the device of
    // the current project. After the test every context is closed, and the
    // test fails if any player page had a problem (see watchForProblems)
    newPlayer: async ({
        browser, baseURL, locale, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch,
        reducedMotion, serviceWorkers,
    }, use) => {
        const players = [];

        await use(async (name, options = {}) => {
            const context = await browser.newContext({
                baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, reducedMotion, serviceWorkers,
                locale: options.locale || locale,
            });
            const page = await context.newPage();
            const player = {
                name, page, context,
                problems: [], expectedDialogs: [], allowedErrors: [],
                // The next dialog must have this text (string: exactly, RegExp: matching); it is accepted
                expectDialog(match) { this.expectedDialogs.push(match); },
                // console.error messages matching this pattern are part of the scenario
                allowConsoleError(pattern) { this.allowedErrors.push(pattern); },
            };
            watchForProblems(player);
            players.push(player);
            return player;
        });

        await Promise.all(players.map(player => player.context.close()));
        const problems = players.flatMap(player => player.problems);
        const missedDialogs = players.flatMap(player =>
            player.expectedDialogs.map(match => `${player.name}: expected dialog never came: ${match}`));
        if (problems.length > 0 || missedDialogs.length > 0) {
            throw new Error(`Problems on the players' pages:\n${[...problems, ...missedDialogs].join('\n')}`);
        }
    },
});

module.exports = {
    test,
    expect: base.expect,
    text,
};
