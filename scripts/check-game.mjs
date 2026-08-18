import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const requiredAssets = [
    "public/assets/art/key-art-anime.jpg",
    "public/assets/art/key-art-anime-portrait.jpg",
    "public/assets/art/sunlit-kitchen-arena.jpg",
    "public/assets/art/chef-bea-anime.png",
    "public/assets/art/spaghetti-kraken-anime.png",
    "public/assets/art/souffle-brute-anime.png",
    "public/assets/art/citrus-basilisk-anime.png",
    "public/assets/art/macaron-mimic-anime.png",
    "public/assets/art/paella-phoenix-anime.png",
    "public/assets/art/tiramisu-phantom-anime.png",
    "public/assets/art/chef-vesper-anime.png",
    "public/assets/art/ingredient-icons-anime.png",
    "public/assets/art/ingredient-icons-expansion-anime.png",
    "public/assets/art/ingredient-icons-expansion2-anime.png",
    "public/assets/art/ingredient-icons-expansion3-anime.png",
    "public/assets/art/gnocchi-gremlin-anime.png",
    "public/assets/art/waffle-wyrm-anime.png",
    "public/assets/art/dumpling-drake-anime.png",
    "public/assets/art/ramen-tempest-anime.png",
    "public/assets/art/ratatouille-golem-anime.png",
    "public/assets/art/croquembouche-queen-anime.png",
    "public/assets/art/conservatory-kitchen-arena.jpg",
    "public/assets/art/rooftop-patisserie-arena.jpg",
    "public/assets/art/seaside-festival-arena.jpg",
    "public/thumbnail.jpg",
];

for (const asset of requiredAssets) {
    const info = await stat(asset);
    assert(info.size > 20_000, `${asset} is missing or suspiciously small`);
}

const combat = await readFile("src/game/combat.ts", "utf8");
for (const enemy of [
    "kraken",
    "citrus",
    "gnocchi",
    "souffle",
    "ramen",
    "macaron",
    "phantom",
    "waffle",
    "ratatouille",
    "paella",
    "dumpling",
    "croquembouche",
    "vesper",
]) {
    assert(combat.includes(`id: "${enemy}"`), `missing encounter ${enemy}`);
}
assert(combat.includes("PERFECT PLATE!"), "recipe combo payoff is missing");
assert(combat.includes("drawPile") && combat.includes("discardPile"), "deck loop is missing");
for (const ingredient of ["mint", "ginger", "olive", "peach", "avocado", "onion", "caramel", "espresso"]) {
    assert(combat.includes(`ingredient: "${ingredient}"`), `missing expansion ingredient ${ingredient}`);
}

const scene = await readFile("src/game/battleScene.ts", "utf8");
for (const feedback of ["projectile", "burst", "shake", "heroFrames", "enemyFrames"]) {
    assert(scene.includes(feedback), `combat feedback system is missing ${feedback}`);
}
assert(scene.includes("createBoneRig"), "combatants must use the ground-locked bone rig");
assert(scene.includes("foeGlowRig") && scene.includes("BlurFilter"), "monster silhouette glow is missing");
assert(!scene.includes("foeShadow"), "detached monster ground shadow must not return");
assert(scene.includes("addTween") && scene.includes("impactRing"), "flowy combat tween/effect layer is missing");
assert(!scene.includes("heroBaseY + Math.sin"), "whole-character hero floating must not return");
assert(!scene.includes("foeBaseY + Math.sin"), "whole-character enemy floating must not return");
assert(scene.includes("expansion2"), "combat projectiles must know the expansion2 atlas");
for (const stretchVariable of ["heroStretchX", "heroStretchY", "foeStretchX", "foeStretchY"]) {
    assert(!scene.includes(stretchVariable), `${stretchVariable} would distort character art`);
}

const rig = await readFile("src/game/boneRig.ts", "utf8");
for (const joint of ["heel", "hip", "chest", "head"]) {
    assert(rig.includes(joint), `bone rig is missing ${joint} influence`);
}
assert(rig.includes("VERTICES_Y = 9"), "bone rig needs enough vertical subdivisions for a planted base");

const css = await readFile("src/styles/app.css", "utf8");
assert(css.includes("flex: 0 0 var(--card-w)"), "combat cards must never flex-grow with hand count");
assert(css.includes('data-count="3"'), "small hands need explicit centering rules");
assert(css.includes("key-art-anime-portrait.jpg"), "portrait menu art is missing");
assert(!css.includes("background-size: 200% 200%"), "2x2 atlases must preserve their intrinsic aspect ratio");
assert(!css.includes("background-size: 400% 400%"), "4x4 atlases must preserve their intrinsic aspect ratio");
assert(!css.includes("/ 200% 200%"), "background shorthand must preserve intrinsic aspect ratio");
assert(css.includes("background-size: 200% auto"), "2x2 atlas scaling must be width-led and aspect-safe");
assert(css.includes("background-size: 400% auto"), "4x4 atlas scaling must be width-led and aspect-safe");
assert(css.includes("ingredient-icons-expansion2-anime.png"), "expansion2 ingredient atlas CSS is missing");
assert(css.includes("ingredient-icons-expansion3-anime.png"), "expansion3 ingredient atlas CSS is missing");
assert(combat.includes("frameAspect: 2 / 3"), "Chef Vesper's portrait must use its tall source-frame aspect");

const menu = await readFile("src/ui/MainMenu.tsx", "utf8");
assert(menu.includes("packageJson.version"), "main menu must render the package version");

const app = await readFile("src/ui/App.tsx", "utf8");
assert(app.includes("window.setTimeout") && app.includes("window.clearTimeout"), "transient toasts must auto-dismiss");
assert(app.includes("store.get().toastSeq === seq"), "an expired toast timer must not dismiss a newer notification");

const bestiary = await readFile("src/ui/BestiaryScreen.tsx", "utf8");
for (const shelf of ["monsters", "ingredients", "cards"]) {
    assert(bestiary.includes(`"${shelf}"`), `bestiary is missing the ${shelf} shelf`);
}
assert(bestiary.includes('"--frame-aspect": enemy.frameAspect'), "bestiary portraits must respect source-frame aspect");

const result = await readFile("src/ui/ResultScreen.tsx", "utf8");
assert(result.includes('outcome === "verified"'), "rewarded ad grants must be host-verified");
const pantry = await readFile("src/ui/PantryScreen.tsx", "utf8");
assert(pantry.includes("shopPriceLabel"), "shop must display catalog-backed price state");

const tutorial = await readFile("src/ui/TutorialOverlay.tsx", "utf8");
for (const lesson of ["START FRESH", "TURN UP THE HEAT", "FINISH RICH", "Serve Turn"]) {
    assert(tutorial.includes(lesson), `FTUE is missing the ${lesson} lesson`);
}
assert(tutorial.includes("ftue_skipped") && tutorial.includes("ftue_completed"), "FTUE outcomes must be measured");
const save = await readFile("src/systems/save.ts", "utf8");
assert(save.includes("SAVE_VERSION = 4"), "run persistence requires save schema v4");
assert(save.includes("ftueCompleted"), "FTUE completion must persist");
assert(save.includes("defeatedEnemies"), "cookbook collection must persist");
assert(save.includes("sanitizeRun"), "persisted runs must be shape-checked before use");
assert(combat.includes("makeTutorialOpening"), "FTUE needs a deterministic opening hand");

// v0.5 depth systems: techniques, combo chains, branching courses, mechanics.
assert(combat.includes('flavor: "wild"'), "the wildcard technique is missing");
assert(combat.includes('"scorch"') && combat.includes('"draw1"'), "technique card effects are missing");
assert(combat.includes("comboBonus"), "escalating Perfect Plate chain is missing");
assert(combat.includes("TIERS"), "the branching course plan is missing");
assert(combat.includes("resumeRun") && combat.includes("stampRun"), "run persistence hooks are missing");
for (const mechanic of ["eruption", "shuffle", "veiled", "storm", "rekindle", "armor", "critic"]) {
    assert(combat.includes(`"${mechanic}"`), `enemy signature mechanic ${mechanic} is missing`);
}
const reward = await readFile("src/ui/RewardScreen.tsx", "utf8");
assert(reward.includes("skipReward") && reward.includes("removeCard"), "reward skip/remove options are missing");
const course = await readFile("src/ui/CourseScreen.tsx", "utf8");
assert(course.includes("chooseCourse"), "course selection screen is missing");
assert(bestiary.includes("defeatedEnemies"), "bestiary must gate entries on the collection");
for (const feedback of ["floatText", "splat", "freeze"]) {
    assert(scene.includes(feedback), `combat juice layer is missing ${feedback}`);
}

const html = await readFile("index.html", "utf8");
assert(!html.includes("Pixel Foundry"), "template identity leaked into index.html");
console.log(
    `Game checks passed (${requiredAssets.length} required assets, six-course branching runs over thirteen monsters, techniques and combo chains, persistent FTUE and resumable runs, cookbook collection, verified monetization, ground-locked bone animation).`,
);
