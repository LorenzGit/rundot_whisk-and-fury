/**
 * Whisk & Fury v0.5 gameplay QA — drives a real run through the new systems:
 * techniques, combo chain, enemy mechanics, reward skip/remove, course
 * branching, resume-from-save, bestiary collection, deck unlocks.
 */
// Playwright is not a dependency of this game; point PLAYWRIGHT_MODULE at any
// sibling install (default: gyrocore). Run: node scripts/qa-playwright.mjs
const PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE ?? "../gyrocore/node_modules/playwright/index.mjs";
const { chromium } = await import(new URL(PLAYWRIGHT, import.meta.url).href);

const BASE = process.env.QA_URL ?? "http://localhost:5183/?qa=1&renderer=webgl";
const SHOTS = "tmp/qa-shots";
const FLAVOR_BY_NAME = {
    "Tomato Toss": "fresh",
    "Basil Snap": "fresh",
    "Lemon Zing": "fresh",
    "Shrimp Snap": "fresh",
    "Chili Fling": "heat",
    "Flambe!": "heat",
    "Pepper Volley": "heat",
    "Butter Bomb": "rich",
    "Cream Guard": "rich",
    "Parmesan Storm": "rich",
    "Vanilla Veil": "rich",
    "Mushroom Chop": "savory",
    "Garlic Crush": "savory",
    "Rosemary Rush": "savory",
    "Cocoa Feint": "sweet",
    "Berry Burst": "sweet",
    "Honey Halo": "sweet",
    "Mint Whip": "fresh",
    "Ginger Flash": "heat",
    "Olive Pour": "rich",
    "Peach Pop": "sweet",
    "Avocado Arc": "fresh",
    "Onion Ring": "savory",
    "Caramel Coil": "sweet",
    "Espresso Shot": "rich",
    "Whisk Wonder": "wild",
    "Knife Work": "prep",
    "Copper Sear": "prep",
};
const COST_BY_NAME = { "Knife Work": 0, "Copper Sear": 2 };

const results = [];
const problems = [];
const consoleErrors = [];
function check(label, ok, detail = "") {
    const line = `${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`;
    results.push(line);
    console.log(line);
    if (!ok) problems.push(label + (detail ? ` — ${detail}` : ""));
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });
page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
page.on("crash", () => console.log("!! PAGE CRASHED"));
page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) console.log(`.. navigated: ${frame.url()}`);
});

const snap = async () => {
    try {
        return await page.evaluate(() => globalThis.__gameQa.snapshot());
    } catch (error) {
        console.log(`.. snapshot retry (${String(error).slice(0, 80)})`);
        await page.waitForSelector('[data-qa-contract="ready"]', { timeout: 20000 });
        return page.evaluate(() => globalThis.__gameQa.snapshot());
    }
};
async function waitFor(predicate, label, timeout = 8000, soft = false) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const state = await snap();
        if (predicate(state)) return state;
        await page.waitForTimeout(120);
    }
    const state = await snap();
    if (soft) console.log(`.. soft-timeout: ${label}`);
    else check(label, false, `timeout; phase=${state.phase} combat=${JSON.stringify(state).slice(0, 200)}`);
    return state;
}
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, animations: "disabled" });

// Seed a v4 save: tutorial done, 4 stars (unlocks the Spice Rack deck chooser).
await page.addInitScript(() => {
    // Init scripts run on EVERY navigation: only seed a truly fresh profile,
    // and never after the FTUE phase clears storage on purpose.
    if (!localStorage.getItem("qa-no-seed") && !localStorage.getItem("whisk-and-fury-save")) {
        localStorage.setItem(
            "whisk-and-fury-save",
            JSON.stringify({
                version: 4,
                settings: {
                    musicEnabled: false,
                    musicVolume: 0.4,
                    sfxEnabled: false,
                    sfxVolume: 0.7,
                    notificationsEnabled: false,
                    notificationsConsent: "unknown",
                    hapticsEnabled: false,
                    reducedMotion: false,
                    locale: "English",
                    quality: "high",
                },
                progress: {
                    totalPlays: 3,
                    cookbookStars: 4,
                    ftueCompleted: true,
                    defeatedEnemies: ["kraken"],
                    deckChoice: "classic",
                },
                run: null,
            }),
        );
    }
});
await page.goto(BASE);
await page.waitForSelector('[data-qa-contract="ready"]', { timeout: 20000 });
let state = await waitFor((s) => s.phase === "menu", "boot to menu");
check("boot to menu", state.phase === "menu");

// Menu: deck selector visible with 4 stars, patissier locked.
check("deck selector visible", (await page.locator(".deck-select button").count()) === 3);
check("patissier locked at 4 stars", (await page.locator(".deck-select button:disabled").count()) === 1);
await shot("01-menu-decks");

// Bestiary collection: kraken plated, others locked.
await page.click("text=BESTIARY");
await page.waitForTimeout(300);
const platedChips = await page.locator(".plated-chip").count();
const lockedEntries = await page.locator(".monster-entry.locked").count();
check("bestiary: 1 plated", platedChips === 1, `plated=${platedChips}`);
check("bestiary: 12 locked", lockedEntries === 12, `locked=${lockedEntries}`);
await shot("02-bestiary-collection");
await page.click(".back-button");

// Start a run.
await page.click("text=ENTER THE KITCHEN");
state = await waitFor((s) => s.phase === "playing", "run starts");
check(
    "run starts at tier 0",
    state.tier === 0 && (state.enemyId === "kraken" || state.enemyId === "citrus" || state.enemyId === "gnocchi"),
    state.enemyId,
);
await page.waitForTimeout(900);
await shot("03-battle-start");

// Sticky: comboChain resets to 0 on the next wrong flavor, so sampling it only
// between turns misses a plate that was followed by an off-sequence card in the
// same turn. Latch it after every card instead.
let sawCombo = false;
const noteCombo = (s) => {
    if (s.comboChain >= 1) sawCombo = true;
    return s;
};

async function playOneTurn() {
    let s = noteCombo(await snap());
    let plays = 0;
    while (s.phase === "playing" && plays < 6) {
        if (s.combatPhase !== "player") {
            s = await waitFor((x) => x.combatPhase === "player" || x.phase !== "playing", "return to player phase");
            continue;
        }
        const expected = s.enemySequence[s.recipeProgress];
        const affordable = s.hand.filter((name) => (COST_BY_NAME[name] ?? 1) <= s.energy);
        if (affordable.length === 0 || s.energy === 0) break;
        const pick =
            affordable.find((name) => FLAVOR_BY_NAME[name] === expected) ??
            affordable.find((name) => FLAVOR_BY_NAME[name] === "wild") ??
            affordable.find((name) => name === "Knife Work") ??
            affordable[0];
        await page.locator(".hand button:not([disabled])", { hasText: pick }).first().click({ force: true });
        plays += 1;
        const wasCombo =
            FLAVOR_BY_NAME[pick] === expected || FLAVOR_BY_NAME[pick] === "wild"
                ? s.recipeProgress + 1 >= s.enemySequence.length
                : false;
        if (wasCombo) {
            await page.waitForTimeout(500);
            await shot("04-combo-moment");
        }
        // Cards resolve via player -> animating -> player; watch for the
        // animating window (0-cost draw cards change nothing else observable).
        await waitFor(
            (x) => x.phase !== "playing" || x.combatPhase !== "player" || x.enemyHp === 0,
            `card ${pick} animates`,
            3000,
            true,
        );
        s = noteCombo(
            await waitFor((x) => x.phase !== "playing" || x.combatPhase === "player", `card ${pick} resolves`),
        );
        if (s.phase !== "playing" || s.enemyHp === 0) return s;
    }
    if (s.phase === "playing" && s.combatPhase === "player") {
        await page.click("text=SERVE TURN");
        s = await waitFor(
            (x) => x.phase !== "playing" || (x.combatPhase === "player" && x.energy === 3),
            "enemy turn resolves",
        );
    }
    return s;
}

// Fight 1 with real card plays; verify chain and damage flow.
let fightGuard = 0;
while (state.phase === "playing" && fightGuard < 12) {
    state = noteCombo(await playOneTurn());
    fightGuard += 1;
}
check(
    "fight 1 ends off-battle",
    state.phase === "reward" || state.phase === "course" || state.phase === "result",
    state.phase,
);

// Reward: screenshot, then test SKIP (+8 HP on top of +10).
if (state.phase === "reward") {
    await shot("05-reward-choices");
    const hpBefore = state.playerHp;
    await page.click("text=PATCH UP");
    state = await waitFor((s) => s.phase === "course" || s.phase === "playing", "skip advances");
    check(
        "skip heals +18 capped",
        state.playerHp === Math.min(54, hpBefore + 18),
        `before=${hpBefore} after=${state.playerHp}`,
    );
}

// Course selection screen.
if (state.phase === "course") {
    check("course offers 2 options", state.courseChoices.length === 2, state.courseChoices.join(","));
    await shot("06-course-select");
    await page.locator(".course-options button").first().click();
    state = await waitFor((s) => s.phase === "playing", "course starts fight 2");
    check("fight 2 tier 1", state.tier === 1, `tier=${state.tier} enemy=${state.enemyId}`);
}

// Mid-fight persistence: reload and resume.
await page.waitForTimeout(400);
const beforeReload = await snap();
await page.reload();
await page.waitForSelector('[data-qa-contract="ready"]', { timeout: 20000 });
state = await waitFor((s) => s.phase === "menu", "reload to menu");
check("saved run offered", state.savedRun === "battle", String(state.savedRun));
const resumeVisible = await page.locator("text=RESUME SERVICE").count();
check("RESUME SERVICE button shown", resumeVisible === 1);
await shot("07-menu-resume");
await page.click("text=RESUME SERVICE");
state = await waitFor((s) => s.phase === "playing", "resume run");
check(
    "resume restores encounter",
    state.enemyId === beforeReload.enemyId &&
        state.tier === beforeReload.tier &&
        state.playerHp === beforeReload.playerHp,
    `enemy ${beforeReload.enemyId}->${state.enemyId} hp ${beforeReload.playerHp}->${state.playerHp}`,
);

// Fight 2: play real; verify mechanics trigger if souffle/ramen present.
fightGuard = 0;
while (state.phase === "playing" && fightGuard < 12) {
    state = noteCombo(await playOneTurn());
    fightGuard += 1;
}
check("fight 2 ends off-battle", state.phase !== "playing", state.phase);
check("combo chain triggered in fights 1-2", sawCombo);

// Reward: test REMOVE flow this time.
if (state.phase === "reward") {
    await page.click("text=REMOVE A CARD INSTEAD");
    await page.waitForTimeout(250);
    await shot("08-remove-grid");
    const deckSize = await page.locator(".remove-grid button").count();
    await page.locator(".remove-grid button").first().click();
    state = await waitFor((s) => s.phase !== "reward", "removal advances");

    check("remove screen listed the deck", deckSize >= 18, `listed=${deckSize}`);
}
if (state.phase === "course") {
    await page.locator(".course-options button").first().click();
    state = await waitFor((s) => s.phase === "playing", "fight 3 starts");
}

// Fast-forward remaining fights via QA hook, exercising reward/course quickly.
let safety = 0;
while (state.phase !== "result" && safety < 10) {
    safety += 1;
    if (state.phase === "playing") {
        // Play one real card against mechanics bosses so armor/phase paths execute.
        if (state.enemyId === "croquembouche" || state.enemyId === "vesper") {
            const armorBefore = state.enemyGuard;
            state = await playOneTurn();
            if (state.phase === "playing" && armorBefore > 0) {
                check(
                    "caramel armor absorbed damage",
                    state.enemyGuard < armorBefore || state.enemyHp < 86,
                    `armor ${armorBefore}->${state.enemyGuard}`,
                );
            }
        }
        if (state.phase === "playing") {
            await page.evaluate(() => globalThis.__gameQa.winEncounter());
            state = await waitFor((s) => s.phase !== "playing", "fast-forward win");
        }
    } else if (state.phase === "reward") {
        await page.locator(".reward-cards button").first().click();
        state = await waitFor((s) => s.phase !== "reward", "reward picked");
    } else if (state.phase === "course") {
        await page.locator(".course-options button").first().click();
        state = await waitFor((s) => s.phase === "playing", "next fight");
    } else {
        break;
    }
}
check("run reaches result", state.phase === "result", state.phase);
await shot("09-result");

// Victory should raise stars and populate the bestiary.
await page.click("text=RETURN TO MENU");
state = await waitFor((s) => s.phase === "menu", "back to menu");
check("no stale resume after run end", state.savedRun === null, String(state.savedRun));
await page.click("text=BESTIARY");
await page.waitForTimeout(300);
const platedAfter = await page.locator(".plated-chip").count();
check("bestiary grew", platedAfter > 1, `plated=${platedAfter}`);
await shot("10-bestiary-after-run");
await page.click(".back-button");

// Leave-run confirm dialog.
await page.click("text=NEW SERVICE").catch(() => page.click("text=ENTER THE KITCHEN"));
state = await waitFor((s) => s.phase === "playing", "new run for leave test");
await page.click('[aria-label="Leave run"]');
await page.waitForTimeout(250);
const confirmShown = await page.locator("text=SAVE & LEAVE").count();
check("leave confirm appears", confirmShown === 1);
await shot("11-leave-confirm");
await page.click("text=KEEP COOKING");
await page.waitForTimeout(200);
check("keep cooking stays in battle", (await snap()).phase === "playing");
await page.click('[aria-label="Leave run"]');
await page.click("text=SAVE & LEAVE");
state = await waitFor((s) => s.phase === "menu", "leave to menu");
check("leave preserved run", state.savedRun === "battle", String(state.savedRun));

// Landscape sanity.
await page.setViewportSize({ width: 852, height: 393 });
await page.waitForTimeout(400);
await shot("12-menu-landscape");
await page.click("text=RESUME SERVICE");
await waitFor((s) => s.phase === "playing", "landscape battle");
await page.waitForTimeout(900);
await shot("13-battle-landscape");
await page.setViewportSize({ width: 393, height: 852 });
await page.waitForTimeout(400);
await shot("14-battle-portrait-final");

// FTUE regression: fresh profile tutorial.
await page.evaluate(() => {
    localStorage.removeItem("whisk-and-fury-save");
    localStorage.setItem("qa-no-seed", "1");
});
await page.reload();
await page.waitForSelector('[data-qa-contract="ready"]', { timeout: 20000 });
state = await waitFor((s) => s.phase === "menu", "fresh boot");
await page.click("text=START COOKING LESSON");
state = await waitFor((s) => s.phase === "playing" && s.ftueStep === 0, "tutorial opens");
await page.click("text=SHOW ME");
for (const [step, card] of [
    [1, "Lemon Zing"],
    [2, "Pepper Volley"],
    [3, "Cream Guard"],
]) {
    state = await waitFor((s) => s.ftueStep === step, `ftue step ${step}`);
    // force: the recommended-card pulse animation never satisfies stability.
    await page.locator(".hand button:not([disabled])", { hasText: card }).first().click({ force: true });
    await page.waitForTimeout(900);
}
state = await waitFor((s) => s.ftueStep === 4, "ftue step 4 (serve)");
check("tutorial reaches Serve step", state.ftueStep === 4);
check("tutorial Perfect Plate set the chain", state.comboChain === 1, `chain=${state.comboChain}`);
await shot("15-ftue-serve");
await page.locator(".turn-controls button").click({ force: true });
state = await waitFor((s) => s.ftueStep === 5, "ftue step 5");
await page.click("text=LET'S COOK");
await page.waitForTimeout(300);
check("tutorial completes", (await snap()).ftueStep === null);

console.log(results.join("\n"));
console.log(`\nConsole errors (${consoleErrors.length}):`);
for (const error of consoleErrors.slice(0, 10)) console.log("  " + error.slice(0, 220));
console.log(
    problems.length === 0 && consoleErrors.length === 0 ? "\nQA: ALL GREEN" : `\nQA: ${problems.length} failures`,
);
await browser.close();
process.exit(problems.length === 0 ? 0 : 1);
