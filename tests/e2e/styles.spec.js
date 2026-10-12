// Checks of public/css/style.css, read by the browser itself (CSSOM): what the
// browser accepted is what players get
const { test, expect, waitForLanding } = require('./helpers');

// Every rule of the game's stylesheet, with the @media conditions around it
async function readAppRules(page) {
    return page.evaluate(() => {
        const sheet = [...document.styleSheets].find(s => s.href && s.href.endsWith('/css/style.css'));
        const rules = [];
        const walk = (ruleList, media) => {
            for (const rule of ruleList) {
                if (rule instanceof CSSStyleRule) {
                    rules.push({ selector: rule.selectorText, media });
                }
                // Rules inside @supports, @layer or a nested rule count too;
                // only @media adds a condition
                if (rule.cssRules) {
                    walk(rule.cssRules, rule instanceof CSSMediaRule ? [...media, rule.conditionText] : media);
                }
            }
        };
        walk(sheet.cssRules, []);
        return rules;
    });
}

// On a touch screen :hover sticks after a tap (CLAUDE.md: hover effects only with a mouse)
test('every :hover rule applies only with a mouse', async ({ newPlayer }) => {
    const { page } = await newPlayer('Alice');
    await page.goto('/');
    await waitForLanding(page);

    const rules = await readAppRules(page);
    const touchHover = rules
        .filter(rule => rule.selector.includes(':hover'))
        .filter(rule => !rule.media.some(condition => condition.includes('(hover: hover)') && condition.includes('(pointer: fine)')))
        .map(rule => rule.selector);

    expect(rules.length).toBeGreaterThan(0);
    expect(touchHover).toEqual([]);
});
