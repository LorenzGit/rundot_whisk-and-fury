import { assetUrl } from "../assets/assetUrl.ts";
import { type RunSnapshot, store } from "../state/store.ts";
import { analytics, FIRST_PLAY_FUNNEL } from "../systems/analytics/analyticsConfig.ts";
import { consumeSpecial } from "../systems/dailySpecial.ts";
import { runtimeServices } from "../systems/runtimeServices.ts";
import { saveSystem } from "../systems/save.ts";
export type Flavor = "fresh" | "heat" | "rich" | "savory" | "sweet";
/** Cards may also be wild (match anything) or prep (never touch the sequence). */
export type CardFlavor = Flavor | "wild" | "prep";
export type EnemyId =
    | "kraken"
    | "citrus"
    | "gnocchi"
    | "souffle"
    | "ramen"
    | "macaron"
    | "phantom"
    | "waffle"
    | "ratatouille"
    | "paella"
    | "dumpling"
    | "croquembouche"
    | "vesper";
export type ArenaId = "sunlit" | "conservatory" | "rooftop" | "seaside";
export type EnemyMechanic = "eruption" | "shuffle" | "veiled" | "storm" | "rekindle" | "armor" | "critic";
export type DeckId = "classic" | "spice" | "patissier";
export type CombatEvent =
    | { id: number; type: "card"; card: Card; matched: boolean; combo: boolean; damage: number }
    | { id: number; type: "enemy"; damage: number; blocked: number }
    | { id: number; type: "surge"; label: string; color: number }
    | { id: number; type: "victory" }
    | { id: number; type: "defeat" };
type CombatEventInput = CombatEvent extends infer Event
    ? Event extends { id: number }
        ? Omit<Event, "id">
        : never
    : never;

export interface Card {
    id: string;
    /** Index into CARD_LIBRARY — the stable identity used by run persistence. */
    library: number;
    name: string;
    ingredient: string;
    flavor: CardFlavor;
    cost: number;
    damage: number;
    guard: number;
    copy: string;
    effect?: "draw1" | "scorch";
}

export interface EnemyDefinition {
    id: EnemyId;
    name: string;
    title: string;
    maxHp: number;
    sequence: Flavor[];
    attacks: number[];
    quip: string;
    arena: ArenaId;
    art: string;
    frameAspect: number;
    mechanic?: EnemyMechanic;
    /** One-line HUD copy explaining the signature mechanic. */
    trait?: string;
}

export const FLAVOR_META: Record<CardFlavor, { label: string; color: string; glyph: string }> = {
    fresh: { label: "FRESH", color: "#71c98b", glyph: "LEAF" },
    heat: { label: "HEAT", color: "#ed6548", glyph: "FIRE" },
    rich: { label: "RICH", color: "#f1bd58", glyph: "GOLD" },
    savory: { label: "SAVORY", color: "#ad79c8", glyph: "UMAMI" },
    sweet: { label: "SWEET", color: "#e98aa7", glyph: "SUGAR" },
    wild: { label: "WILD", color: "#6fc3dc", glyph: "WHISK" },
    prep: { label: "TECHNIQUE", color: "#93a2bd", glyph: "PREP" },
};

const ERUPTION_PRESSURE = 5;
const REKINDLE_HP = 24;
const ARMOR_PER_TURN = 6;
const STORM_CAP = 8;
const CRITIC_PHASE2_PRESSURE = 2;
const VESPER_SECOND_COURSE: Flavor[] = ["rich", "fresh", "sweet", "savory"];

export const ENEMIES: EnemyDefinition[] = [
    {
        id: "kraken",
        name: "Spaghetti Kraken",
        title: "The Tangled Course",
        maxHp: 42,
        sequence: ["fresh", "heat", "rich"],
        attacks: [7, 9, 6],
        quip: "Untangle me if you can, Chef.",
        arena: "sunlit",
        art: assetUrl("assets/art/spaghetti-kraken-anime.png"),
        frameAspect: 1,
    },
    {
        id: "citrus",
        name: "Citrus Basilisk",
        title: "The Zest Nest",
        maxHp: 49,
        sequence: ["fresh", "sweet", "heat"],
        attacks: [8, 10, 7],
        quip: "Pucker up. I bite back.",
        arena: "conservatory",
        art: assetUrl("assets/art/citrus-basilisk-anime.png"),
        frameAspect: 1,
    },
    {
        id: "gnocchi",
        name: "Gnocchi Gremlin",
        title: "The Pillowy Pest",
        maxHp: 52,
        sequence: ["rich", "fresh", "savory"],
        attacks: [8, 9, 7],
        quip: "Soft on the outside. Trouble inside.",
        arena: "sunlit",
        art: assetUrl("assets/art/gnocchi-gremlin-anime.png"),
        frameAspect: 1,
    },
    {
        id: "souffle",
        name: "Souffle Brute",
        title: "The Fallen Rise",
        maxHp: 57,
        sequence: ["rich", "savory", "fresh"],
        attacks: [8, 11, 7],
        quip: "One slammed door and I explode.",
        arena: "conservatory",
        art: assetUrl("assets/art/souffle-brute-anime.png"),
        frameAspect: 1,
        mechanic: "eruption",
        trait: `Slip the sequence and it erupts for ${ERUPTION_PRESSURE} pressure.`,
    },
    {
        id: "ramen",
        name: "Ramen Tempest",
        title: "The Thunder Broth",
        maxHp: 62,
        sequence: ["savory", "fresh", "heat"],
        attacks: [7, 10, 6],
        quip: "A perfect storm needs perfect seasoning!",
        arena: "seaside",
        art: assetUrl("assets/art/ramen-tempest-anime.png"),
        frameAspect: 1,
        mechanic: "storm",
        trait: "The broth builds: +1 pressure every turn.",
    },
    {
        id: "macaron",
        name: "Macaron Mimic",
        title: "The Counterfeit Confection",
        maxHp: 63,
        sequence: ["sweet", "rich", "savory"],
        attacks: [9, 12, 8],
        quip: "Pick a flavor. Any flavor. Wrong.",
        arena: "rooftop",
        art: assetUrl("assets/art/macaron-mimic-anime.png"),
        frameAspect: 1,
        mechanic: "shuffle",
        trait: "A wrong flavor reshuffles its whole recipe.",
    },
    {
        id: "phantom",
        name: "Tiramisu Phantom",
        title: "The Last Course",
        maxHp: 69,
        sequence: ["sweet", "rich", "fresh"],
        attacks: [9, 12, 8],
        quip: "Darling, dessert is inevitable.",
        arena: "rooftop",
        art: assetUrl("assets/art/tiramisu-phantom-anime.png"),
        frameAspect: 1,
        mechanic: "veiled",
        trait: "The final flavor stays veiled until it is next.",
    },
    {
        id: "waffle",
        name: "Waffle Wyrm",
        title: "The Maple Coil",
        maxHp: 66,
        sequence: ["sweet", "heat", "rich"],
        attacks: [9, 11, 8],
        quip: "Breakfast is never over.",
        arena: "sunlit",
        art: assetUrl("assets/art/waffle-wyrm-anime.png"),
        frameAspect: 1,
        mechanic: "storm",
        trait: "The syrup builds: +1 pressure every turn.",
    },
    {
        id: "ratatouille",
        name: "Ratatouille Golem",
        title: "The Layered Labyrinth",
        maxHp: 74,
        sequence: ["fresh", "savory", "rich", "heat"],
        attacks: [10, 13, 9],
        quip: "Every layer has another surprise.",
        arena: "conservatory",
        art: assetUrl("assets/art/ratatouille-golem-anime.png"),
        frameAspect: 1,
    },
    {
        id: "paella",
        name: "Paella Phoenix",
        title: "The Saffron Sunrise",
        maxHp: 78,
        sequence: ["savory", "heat", "fresh", "rich"],
        attacks: [11, 14, 9],
        quip: "From every scorched pan, I rise!",
        arena: "seaside",
        art: assetUrl("assets/art/paella-phoenix-anime.png"),
        frameAspect: 1,
        mechanic: "rekindle",
        trait: `Rises from defeat once, rekindled at ${REKINDLE_HP} HP.`,
    },
    {
        id: "dumpling",
        name: "Dumpling Drake",
        title: "The Steamer Seraph",
        maxHp: 80,
        sequence: ["savory", "fresh", "rich", "heat"],
        attacks: [10, 13, 11],
        quip: "Steam first. Chaos second.",
        arena: "seaside",
        art: assetUrl("assets/art/dumpling-drake-anime.png"),
        frameAspect: 1,
        mechanic: "veiled",
        trait: "The final flavor stays veiled until it is next.",
    },
    {
        id: "croquembouche",
        name: "Croquembouche Queen",
        title: "The Caramel Court",
        maxHp: 86,
        sequence: ["sweet", "rich", "fresh", "savory"],
        attacks: [11, 15, 10],
        quip: "Mind the crown, darling. It shatters.",
        arena: "rooftop",
        art: assetUrl("assets/art/croquembouche-queen-anime.png"),
        frameAspect: 1,
        mechanic: "armor",
        trait: `${ARMOR_PER_TURN} caramel armor re-hardens every turn.`,
    },
    {
        id: "vesper",
        name: "Chef Vesper",
        title: "The Midnight Critic",
        maxHp: 92,
        sequence: ["heat", "savory", "sweet", "fresh"],
        attacks: [10, 14, 9],
        quip: "Convince me. One plate at a time.",
        arena: "sunlit",
        art: assetUrl("assets/art/chef-vesper-anime.png"),
        frameAspect: 2 / 3,
        mechanic: "critic",
        trait: `At half health she rewrites the recipe, +${CRITIC_PHASE2_PRESSURE} pressure.`,
    },
];

export function enemyById(id: EnemyId | string): EnemyDefinition {
    return ENEMIES.find((enemy) => enemy.id === id) ?? ENEMIES[0]!;
}

export function isEnemyId(value: unknown): value is EnemyId {
    return typeof value === "string" && ENEMIES.some((enemy) => enemy.id === value);
}

/**
 * Course plan: each run walks these tiers in order. Tiers with two entries
 * present a "choose your next course" decision after the reward screen.
 */
export const TIERS: EnemyId[][] = [
    ["kraken", "citrus", "gnocchi"],
    ["souffle", "ramen"],
    ["macaron", "phantom", "waffle"],
    ["ratatouille", "paella", "dumpling"],
    ["croquembouche"],
    ["vesper"],
];

export const RUN_LENGTH = TIERS.length;

export const CARD_LIBRARY: Omit<Card, "id" | "library">[] = [
    {
        name: "Tomato Toss",
        ingredient: "tomato",
        flavor: "fresh",
        cost: 1,
        damage: 5,
        guard: 0,
        copy: "Bright, bold, airborne.",
    },
    {
        name: "Basil Snap",
        ingredient: "basil",
        flavor: "fresh",
        cost: 1,
        damage: 4,
        guard: 2,
        copy: "Aromatic and surprisingly sharp.",
    },
    {
        name: "Lemon Zing",
        ingredient: "lemon",
        flavor: "fresh",
        cost: 1,
        damage: 4,
        guard: 3,
        copy: "Cuts through a heavy mood.",
    },
    {
        name: "Chili Fling",
        ingredient: "chili",
        flavor: "heat",
        cost: 1,
        damage: 6,
        guard: 0,
        copy: "A small pepper with big plans.",
    },
    {
        name: "Flambe!",
        ingredient: "flame",
        flavor: "heat",
        cost: 1,
        damage: 8,
        guard: 0,
        copy: "Eyebrows are optional.",
    },
    {
        name: "Pepper Volley",
        ingredient: "pepper",
        flavor: "heat",
        cost: 1,
        damage: 5,
        guard: 1,
        copy: "Cracked with impeccable timing.",
    },
    {
        name: "Butter Bomb",
        ingredient: "butter",
        flavor: "rich",
        cost: 1,
        damage: 7,
        guard: 0,
        copy: "There is no such thing as too much.",
    },
    {
        name: "Cream Guard",
        ingredient: "cream",
        flavor: "rich",
        cost: 1,
        damage: 3,
        guard: 6,
        copy: "Silky, sturdy, sensible.",
    },
    {
        name: "Parmesan Storm",
        ingredient: "cheese",
        flavor: "rich",
        cost: 1,
        damage: 6,
        guard: 2,
        copy: "A blizzard worth standing in.",
    },
    {
        name: "Mushroom Chop",
        ingredient: "mushroom",
        flavor: "savory",
        cost: 1,
        damage: 6,
        guard: 2,
        copy: "Earthy with an edge.",
    },
    {
        name: "Garlic Crush",
        ingredient: "garlic",
        flavor: "savory",
        cost: 1,
        damage: 7,
        guard: 0,
        copy: "No subtlety. No regrets.",
    },
    {
        name: "Cocoa Feint",
        ingredient: "cocoa",
        flavor: "sweet",
        cost: 1,
        damage: 4,
        guard: 4,
        copy: "Bitter first. Brilliant later.",
    },
    {
        name: "Berry Burst",
        ingredient: "berry",
        flavor: "sweet",
        cost: 1,
        damage: 6,
        guard: 1,
        copy: "Juicy little troublemakers.",
    },
    {
        name: "Rosemary Rush",
        ingredient: "rosemary",
        flavor: "savory",
        cost: 1,
        damage: 5,
        guard: 3,
        copy: "A fragrant little power move.",
    },
    {
        name: "Honey Halo",
        ingredient: "honey",
        flavor: "sweet",
        cost: 1,
        damage: 4,
        guard: 5,
        copy: "Sticky, sunny, surprisingly sturdy.",
    },
    {
        name: "Shrimp Snap",
        ingredient: "shrimp",
        flavor: "fresh",
        cost: 1,
        damage: 7,
        guard: 1,
        copy: "A bright bite with perfect bounce.",
    },
    {
        name: "Vanilla Veil",
        ingredient: "vanilla",
        flavor: "rich",
        cost: 1,
        damage: 3,
        guard: 7,
        copy: "Soft perfume, serious protection.",
    },
    {
        name: "Whisk Wonder",
        ingredient: "whisk",
        flavor: "wild",
        cost: 1,
        damage: 4,
        guard: 0,
        copy: "Whatever the recipe needs, whisked on demand.",
    },
    {
        name: "Knife Work",
        ingredient: "knife",
        flavor: "prep",
        cost: 0,
        damage: 3,
        guard: 0,
        effect: "draw1",
        copy: "Quick prep. Keeps the hand moving.",
    },
    {
        name: "Copper Sear",
        ingredient: "pan",
        flavor: "prep",
        cost: 2,
        damage: 16,
        guard: 0,
        effect: "scorch",
        copy: "Everything burns — including the pattern.",
    },
    {
        name: "Mint Whip",
        ingredient: "mint",
        flavor: "fresh",
        cost: 1,
        damage: 3,
        guard: 4,
        copy: "Cool finish. Steady hands.",
    },
    {
        name: "Ginger Flash",
        ingredient: "ginger",
        flavor: "heat",
        cost: 1,
        damage: 7,
        guard: 1,
        copy: "A warm kick that never waits.",
    },
    {
        name: "Olive Pour",
        ingredient: "olive",
        flavor: "rich",
        cost: 1,
        damage: 4,
        guard: 5,
        copy: "Golden gloss for a sturdy plate.",
    },
    {
        name: "Peach Pop",
        ingredient: "peach",
        flavor: "sweet",
        cost: 1,
        damage: 6,
        guard: 2,
        copy: "Soft blush, bold finish.",
    },
    {
        name: "Avocado Arc",
        ingredient: "avocado",
        flavor: "fresh",
        cost: 1,
        damage: 5,
        guard: 3,
        copy: "Smooth curve, solid guard.",
    },
    {
        name: "Onion Ring",
        ingredient: "onion",
        flavor: "savory",
        cost: 1,
        damage: 6,
        guard: 2,
        copy: "Layers of loud umami.",
    },
    {
        name: "Caramel Coil",
        ingredient: "caramel",
        flavor: "sweet",
        cost: 1,
        damage: 5,
        guard: 4,
        copy: "Sticky sweet that holds the line.",
    },
    {
        name: "Espresso Shot",
        ingredient: "espresso",
        flavor: "rich",
        cost: 1,
        damage: 8,
        guard: 0,
        copy: "Short, dark, decisive.",
    },
    // Secret Menu pack — exclusive, stronger than the house 1-costs, not Copper Sear.
    {
        name: "Black Garlic",
        ingredient: "garlic",
        flavor: "savory",
        cost: 1,
        damage: 9,
        guard: 2,
        copy: "Twice the crush. None of the subtlety.",
    },
    {
        name: "Inferno Peach",
        ingredient: "peach",
        flavor: "heat",
        cost: 1,
        damage: 10,
        guard: 0,
        copy: "Ripe fruit. Bad decisions.",
    },
    {
        name: "Yuzu Crash",
        ingredient: "lemon",
        flavor: "fresh",
        cost: 1,
        damage: 8,
        guard: 3,
        copy: "Citric acid with ambition.",
    },
    {
        name: "Gold Leaf",
        ingredient: "cream",
        flavor: "rich",
        cost: 1,
        damage: 4,
        guard: 10,
        copy: "Edible armor for a loud kitchen.",
    },
    {
        name: "Morel Wild",
        ingredient: "mushroom",
        flavor: "wild",
        cost: 1,
        damage: 7,
        guard: 2,
        copy: "Matches any flavor. Still hits.",
    },
    {
        name: "Off-Menu Shot",
        ingredient: "espresso",
        flavor: "heat",
        cost: 0,
        damage: 6,
        guard: 0,
        copy: "Free heat. No ticket.",
    },
];

export const SECRET_MENU_START = CARD_LIBRARY.length - 6;
export const SECRET_MENU_INDICES: readonly number[] = [0, 1, 2, 3, 4, 5].map((offset) => SECRET_MENU_START + offset);

export function isSecretMenuIndex(index: number): boolean {
    return index >= SECRET_MENU_START && index < SECRET_MENU_START + SECRET_MENU_INDICES.length;
}

export interface DeckDefinition {
    id: DeckId;
    name: string;
    blurb: string;
    stars: number;
    indices: number[];
}

export const DECKS: DeckDefinition[] = [
    {
        id: "classic",
        name: "House Menu",
        blurb: "Bea's balanced opening service.",
        stars: 0,
        indices: [0, 1, 2, 3, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25],
    },
    {
        id: "spice",
        name: "Spice Rack",
        blurb: "Heat-forward. All offense, thin apron.",
        stars: 3,
        indices: [0, 1, 2, 3, 3, 4, 4, 5, 5, 6, 8, 9, 10, 12, 14, 16, 17, 18, 21, 21, 25, 27],
    },
    {
        id: "patissier",
        name: "Patissier's Case",
        blurb: "Sweet, sturdy, and one searing pan.",
        stars: 6,
        indices: [0, 2, 3, 5, 6, 7, 7, 9, 10, 11, 11, 12, 12, 14, 16, 17, 18, 19, 22, 23, 26, 26],
    },
];

export function isDeckId(value: unknown): value is DeckId {
    return typeof value === "string" && DECKS.some((deck) => deck.id === value);
}

const COMBO_BASE = 14;
const COMBO_STEP = 6;
const COMBO_CAP = 32;

/** Taste bonus the NEXT Perfect Plate pays, given plates already chained this fight. */
export function comboBonus(chain: number): number {
    return Math.min(COMBO_BASE + COMBO_STEP * Math.max(0, chain), COMBO_CAP);
}

/** Extra Taste an on-sequence ingredient earns on top of its printed value. */
export const MATCH_BONUS = 3;

/**
 * How long the victory celebration on the battle stage runs before the reward
 * screen takes over. battleScene's "victory" handler is choreographed to this.
 */
export const VICTORY_CELEBRATION_MS = 2700;

export interface PlayPreview {
    /** Taste this card actually deals right now — match bonus and halving applied. */
    damage: number;
    matched: boolean;
    /** Wrong flavor: half Taste, chain broken, pattern progress lost. */
    brokeSequence: boolean;
    /** This card completes the pattern; `damage` already includes the plate bonus. */
    combo: boolean;
    /** Plate bonus folded into `damage` (0 unless `combo`). */
    bonus: number;
    isPrep: boolean;
    /** Recipe progress after this play, before enemy mechanics rewrite it. */
    progress: number;
    /** True when this play throws away pattern steps the player already cooked. */
    resetsPattern: boolean;
}

/**
 * Resolve what a card does against the live recipe step. `playCard` and the
 * hand UI both read this, so the number printed on a card is by construction
 * the number it deals — the two can never drift apart.
 */
export function previewPlay(card: Card, state = store.get()): PlayPreview {
    const expected = state.enemySequence[state.recipeProgress];
    const isPrep = card.flavor === "prep";
    const matched = !isPrep && (card.flavor === "wild" || card.flavor === expected);
    const brokeSequence = !isPrep && !matched;
    const progress = matched
        ? state.recipeProgress + 1
        : isPrep
          ? state.recipeProgress
          : card.flavor === state.enemySequence[0]
            ? 1
            : 0;
    const combo = progress >= state.enemySequence.length;
    const bonus = combo ? comboBonus(state.comboChain) : 0;
    // Matching is the core loop: full Taste + a clear match bonus.
    // Off-sequence ingredients still land, but at half Taste so spamming
    // high-damage wrong cards never outpaces cooking the recipe.
    const damage = isPrep
        ? card.damage
        : matched
          ? card.damage + MATCH_BONUS + bonus
          : Math.max(1, Math.ceil(card.damage * 0.5));
    return {
        damage,
        matched,
        brokeSequence,
        combo,
        bonus,
        isPrep,
        progress,
        resetsPattern: brokeSequence && progress < state.recipeProgress,
    };
}

/** The pressure the enemy will serve at end of turn, including mechanics. */
export function incomingPressure(state = store.get()): number {
    const enemy = enemyById(state.enemyId);
    const base = enemy.attacks[state.intentIndex % enemy.attacks.length]!;
    const storm = enemy.mechanic === "storm" ? Math.min(state.turn - 1, STORM_CAP) : 0;
    const critic = enemy.mechanic === "critic" && state.enemyPhase2 ? CRITIC_PHASE2_PRESSURE : 0;
    return base + storm + critic;
}

function makeCard(library: number, tag: string | number): Card {
    return {
        ...CARD_LIBRARY[library]!,
        library,
        id: `${library}-${tag}-${Math.random().toString(36).slice(2, 7)}`,
    };
}

function makeDeck(deckId: DeckId, extras = true): Card[] {
    const deck = DECKS.find((candidate) => candidate.id === deckId) ?? DECKS[0]!;
    const base = deck.indices.map((index, copy) => makeCard(index, copy));
    if (!extras || !store.get().secretMenuOwned) return base;
    return [...base, ...SECRET_MENU_INDICES.map((index, copy) => makeCard(index, `secret-${copy}`))];
}

function makeTutorialOpening(deck: Card[]): { hand: Card[]; drawPile: Card[]; discardPile: Card[] } {
    const openingIndices = [2, 5, 7, 10, 12];
    const hand = openingIndices.map((index, copy) => ({ ...makeCard(index, copy), id: `tutorial-${index}-${copy}` }));
    return { hand, drawPile: shuffle(deck), discardPile: [] };
}

function shuffle<T>(values: T[]): T[] {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
}

let eventId = 0;
const eventListeners = new Set<(event: CombatEvent) => void>();
function emit(event: CombatEventInput): void {
    const complete = { ...event, id: ++eventId } as CombatEvent;
    for (const listener of eventListeners) listener(complete);
}

function draw(
    count: number,
    hand = store.get().hand,
    drawPile = store.get().drawPile,
    discard = store.get().discardPile,
) {
    const nextHand = [...hand];
    let nextDraw = [...drawPile];
    let nextDiscard = [...discard];
    for (let i = 0; i < count; i += 1) {
        if (nextDraw.length === 0) {
            nextDraw = shuffle(nextDiscard);
            nextDiscard = [];
        }
        const card = nextDraw.pop();
        if (card) nextHand.push(card);
    }
    return { hand: nextHand, drawPile: nextDraw, discardPile: nextDiscard };
}

/** State fields that reset for every new encounter against `enemy`. */
function encounterFields(enemy: EnemyDefinition) {
    return {
        enemyId: enemy.id,
        enemyHp: enemy.maxHp,
        enemyMaxHp: enemy.maxHp,
        enemySequence: [...enemy.sequence],
        enemyGuard: enemy.mechanic === "armor" ? ARMOR_PER_TURN : 0,
        enemyReviveUsed: false,
        enemyPhase2: false,
        recipeProgress: 0,
        comboChain: 0,
        turn: 1,
        intentIndex: 0,
        banner: enemy.quip,
    };
}

const cardIndices = (cards: Card[]) => cards.map((card) => card.library);

/**
 * Capture the current run at a stable point so it survives leaving the app.
 * Tutorial runs are intentionally not resumable (the lesson is replayable).
 */
function stampRun(stage: RunSnapshot["stage"]): void {
    const state = store.get();
    if (state.ftueStep !== null) return;
    const savedRun: RunSnapshot = {
        stage,
        deckId: state.deckChoice,
        tier: state.tier,
        encounter: state.encounter,
        enemyId: state.enemyId,
        enemySequence: [...state.enemySequence],
        enemyHp: state.enemyHp,
        enemyMaxHp: state.enemyMaxHp,
        enemyGuard: state.enemyGuard,
        enemyReviveUsed: state.enemyReviveUsed,
        enemyPhase2: state.enemyPhase2,
        playerHp: state.playerHp,
        playerMaxHp: state.playerMaxHp,
        guard: state.guard,
        energy: state.energy,
        recipeProgress: state.recipeProgress,
        comboChain: state.comboChain,
        turn: state.turn,
        intentIndex: state.intentIndex,
        hand: cardIndices(state.hand),
        drawPile: cardIndices(state.drawPile),
        discardPile: cardIndices(state.discardPile),
        rewardChoices: cardIndices(state.rewardChoices),
        courseChoices: [...state.courseChoices],
    };
    store.patch({ savedRun });
}

/**
 * Funnel beats for a resolved service — the run genuinely ended (victory or
 * defeat), unlike run_left, which keeps a resumable snapshot. Returns the new
 * lifetime resolution count for the caller to patch into the store.
 */
function recordRunResolved(result: "victory" | "defeat"): number {
    const servicesCompleted = store.get().servicesCompleted + 1;
    // Step 4 is gated on step 3's once-ever mark: veterans from builds where
    // ftue_completed never fired must not produce a first_run_ended row with
    // no ftue_completed row, or the funnel reads non-monotonic. New players
    // always pass — the coaching completes before any run can resolve.
    if (!analytics.isFirstTime(FIRST_PLAY_FUNNEL, 3)) {
        analytics.funnelStep(FIRST_PLAY_FUNNEL, 4, { result });
    }
    // Counted engagement funnel: the Nth resolved service. The counter moves
    // +1 per resolution, so no value is ever skipped; past 12 the
    // out-of-range step no-ops by design.
    analytics.funnelStep("engagement", servicesCompleted, { result });
    return servicesCompleted;
}

function loseRun(): void {
    const servicesCompleted = recordRunResolved("defeat");
    store.patch({ combatPhase: "defeat", banner: "THE KITCHEN WINS THIS ROUND", servicesCompleted });
    emit({ type: "defeat" });
    window.setTimeout(() => {
        store.patch({ phase: "result", result: "defeat", savedRun: null });
        void saveSystem.flush();
    }, 1050);
}

const isFlavor = (value: unknown): value is Flavor =>
    value === "fresh" || value === "heat" || value === "rich" || value === "savory" || value === "sweet";

export const combat = {
    subscribe(listener: (event: CombatEvent) => void): () => void {
        eventListeners.add(listener);
        return () => eventListeners.delete(listener);
    },

    startRun(options: { tutorial?: boolean } = {}): void {
        const state = store.get();
        const tutorial = options.tutorial ?? !state.ftueCompleted;
        const deckId: DeckId = tutorial ? "classic" : state.deckChoice;
        const deck = shuffle(makeDeck(deckId, !tutorial));
        const enemy = enemyById(tutorial ? "kraken" : TIERS[0]![Math.floor(Math.random() * TIERS[0]!.length)]!);
        const opening = tutorial ? makeTutorialOpening(deck) : draw(5, [], deck, []);
        // A claimed daily special is spent by the NEXT service, not by every
        // service that day. The tutorial run is excluded: a first-timer has not
        // seen the baseline yet, so a buffed opening teaches the wrong numbers.
        const special = tutorial ? { hp: 0, guard: 0 } : consumeSpecial();
        store.patch({
            phase: "playing",
            combatPhase: "player",
            tier: 0,
            encounter: 0,
            playerHp: 54 + special.hp,
            playerMaxHp: 54 + special.hp,
            guard: special.guard,
            energy: 3,
            totalPlays: state.totalPlays + 1,
            resultBonusClaimed: false,
            ftueStep: tutorial ? 0 : null,
            courseChoices: [],
            rewardChoices: [],
            savedRun: null,
            ...encounterFields(enemy),
            ...opening,
        });
        if (!tutorial) stampRun("battle");
        void saveSystem.flush();
    },

    /** Rebuild a run from the persisted snapshot. Returns false if it was unusable. */
    resumeRun(): boolean {
        const state = store.get();
        const run = state.savedRun;
        if (!run || !isEnemyId(run.enemyId)) {
            store.patch({ savedRun: null });
            return false;
        }
        const enemy = enemyById(run.enemyId);
        const validIndex = (index: number) => Number.isInteger(index) && index >= 0 && index < CARD_LIBRARY.length;
        const cards = (indices: number[], tag: string) =>
            indices.filter(validIndex).map((index, position) => makeCard(index, `${tag}-${position}`));
        const sequence = run.enemySequence.filter(isFlavor);
        const hand = cards(run.hand, "h");
        const drawPile = cards(run.drawPile, "d");
        const discardPile = cards(run.discardPile, "x");
        if (sequence.length === 0 || hand.length + drawPile.length + discardPile.length < 5) {
            store.patch({ savedRun: null });
            return false;
        }
        const clamp = (value: number, max: number) => Math.max(0, Math.min(max, Math.floor(value)));
        const shared = {
            deckChoice: isDeckId(run.deckId) ? run.deckId : state.deckChoice,
            tier: clamp(run.tier, TIERS.length - 1),
            encounter: clamp(run.encounter, RUN_LENGTH - 1),
            playerMaxHp: 54,
            playerHp: clamp(run.playerHp, 54) || 1,
            guard: clamp(run.guard, 999),
            energy: clamp(run.energy, 3),
            enemyHp: clamp(run.enemyHp, enemy.maxHp) || 1,
            enemyMaxHp: enemy.maxHp,
            enemyGuard: clamp(run.enemyGuard, 99),
            enemySequence: sequence,
            enemyId: enemy.id,
            enemyReviveUsed: run.enemyReviveUsed === true,
            enemyPhase2: run.enemyPhase2 === true,
            recipeProgress: clamp(run.recipeProgress, sequence.length - 1),
            comboChain: clamp(run.comboChain, 99),
            turn: Math.max(1, clamp(run.turn, 999)),
            intentIndex: clamp(run.intentIndex, 9999),
            hand,
            drawPile,
            discardPile,
            resultBonusClaimed: false,
            ftueStep: null,
            banner: "Back to the pass, Chef.",
        };
        runtimeServices.track("run_resumed", { stage: run.stage, encounter: shared.encounter });
        if (run.stage === "reward") {
            const rewardChoices = cards(run.rewardChoices, "r");
            if (rewardChoices.length === 3) {
                store.patch({ ...shared, phase: "reward", rewardChoices, courseChoices: [] });
                return true;
            }
        }
        if (run.stage === "course") {
            const courseChoices = run.courseChoices.filter(isEnemyId);
            if (courseChoices.length > 0) {
                store.patch({ ...shared, phase: "course", courseChoices, rewardChoices: [] });
                return true;
            }
        }
        store.patch({
            ...shared,
            phase: "playing",
            combatPhase: "player",
            rewardChoices: [],
            courseChoices: [],
        });
        return true;
    },

    /** Bail out to the menu mid-run, preserving the run for RESUME SERVICE. */
    leaveRun(): void {
        const state = store.get();
        if (state.phase === "playing" && state.combatPhase === "player") stampRun("battle");
        store.patch({ phase: "menu", menuScreen: "main", paused: false });
        void saveSystem.flush();
    },

    playCard(cardId: string): void {
        const state = store.get();
        if (state.combatPhase !== "player") return;
        const card = state.hand.find((candidate) => candidate.id === cardId);
        if (!card || state.energy < card.cost) return;
        const enemy = enemyById(state.enemyId);
        const preview = previewPlay(card, state);
        const { damage, matched, brokeSequence, combo, bonus, isPrep, resetsPattern } = preview;
        let progress = preview.progress;
        let comboChain = combo ? state.comboChain + 1 : brokeSequence ? 0 : state.comboChain;

        // Caramel armor absorbs damage before HP.
        const absorbed = Math.min(state.enemyGuard, damage);
        let nextHp = Math.max(0, state.enemyHp - (damage - absorbed));
        let enemySequence = state.enemySequence;
        let enemyPhase2 = state.enemyPhase2;
        let enemyReviveUsed = state.enemyReviveUsed;
        let playerHp = state.playerHp;
        // Guard always applies — Cream Guard etc. stay useful as defense even
        // when the flavor is wrong — but Taste is what the sequence pays for.
        let guard = state.guard + card.guard;
        let surge: { label: string; color: number } | null = null;
        let banner = combo
            ? state.comboChain > 0
                ? `PERFECT PLATE ×${state.comboChain + 1}! +${bonus} TASTE`
                : `PERFECT PLATE! +${bonus} TASTE`
            : matched
              ? `${FLAVOR_META[card.flavor].label} — NICE MATCH! +${damage} TASTE`
              : isPrep
                ? card.effect === "scorch"
                    ? "SEARED! The pattern burns away."
                    : "Quick prep — extra card."
                : resetsPattern
                  ? `Wrong flavor — only ${damage} Taste, and the pattern resets!`
                  : `Wrong flavor — only ${damage} Taste. Match the glowing step!`;

        if (card.effect === "scorch") {
            progress = 0;
            comboChain = 0;
        }
        if (brokeSequence && enemy.mechanic === "eruption") {
            const spent = Math.min(guard, ERUPTION_PRESSURE);
            guard -= spent;
            playerHp = Math.max(0, playerHp - (ERUPTION_PRESSURE - spent));
            banner = `IT ERUPTS! ${ERUPTION_PRESSURE} pressure back at Bea.`;
            surge = { label: "ERUPTION!", color: 0xed6548 };
        }
        if (brokeSequence && enemy.mechanic === "shuffle") {
            enemySequence = shuffle([...enemySequence]);
            progress = 0;
            banner = "THE MIMIC RESHUFFLES THE RECIPE!";
            surge = { label: "RESHUFFLED!", color: 0xe98aa7 };
        }
        if (nextHp <= 0 && enemy.mechanic === "rekindle" && !enemyReviveUsed) {
            nextHp = REKINDLE_HP;
            enemyReviveUsed = true;
            banner = "FROM EVERY SCORCHED PAN — IT RISES!";
            surge = { label: "REKINDLED!", color: 0xf6a13d };
        }
        if (nextHp > 0 && enemy.mechanic === "critic" && !enemyPhase2 && nextHp <= Math.floor(state.enemyMaxHp / 2)) {
            enemyPhase2 = true;
            enemySequence = [...VESPER_SECOND_COURSE];
            progress = 0;
            banner = "“Round two. Impress me.” The recipe is rewritten!";
            surge = { label: "NEW RECIPE!", color: 0xad79c8 };
        }

        const hand = state.hand.filter((candidate) => candidate.id !== cardId);
        const discarded = [...state.discardPile, card];
        const piles =
            card.effect === "draw1"
                ? draw(1, hand, state.drawPile, discarded)
                : { hand, drawPile: state.drawPile, discardPile: discarded };
        const ftueAdvance =
            matched && state.ftueStep === 1 && card.flavor === "fresh"
                ? 2
                : matched && state.ftueStep === 2 && card.flavor === "heat"
                  ? 3
                  : combo && state.ftueStep === 3
                    ? 4
                    : state.ftueStep;
        store.patch({
            ...piles,
            energy: state.energy - card.cost,
            guard,
            playerHp,
            enemyHp: nextHp,
            enemyGuard: state.enemyGuard - absorbed,
            enemySequence,
            enemyPhase2,
            enemyReviveUsed,
            comboChain,
            recipeProgress: combo ? 0 : progress,
            banner,
            combatPhase: "animating",
            ftueStep: ftueAdvance,
        });
        emit({ type: "card", card, matched, combo, damage });
        if (surge) emit({ type: "surge", ...surge });
        // Keep the input lock close to the projectile flight so multi-card
        // turns do not feel like a slideshow. Combo holds a beat longer for
        // the Perfect Plate beat.
        window.setTimeout(
            () => {
                if (nextHp <= 0) this.winEncounter();
                else if (store.get().playerHp <= 0) loseRun();
                else {
                    store.patch({ combatPhase: "player" });
                    stampRun("battle");
                }
            },
            combo ? 820 : 420,
        );
    },

    endTurn(): void {
        const state = store.get();
        if (state.combatPhase !== "player") return;
        const enemy = enemyById(state.enemyId);
        const incoming = incomingPressure(state);
        const blocked = Math.min(state.guard, incoming);
        const damage = incoming - blocked;
        const hp = Math.max(0, state.playerHp - damage);
        store.patch({
            combatPhase: "enemy",
            playerHp: hp,
            guard: 0,
            banner: `${enemy.name} serves ${incoming} pressure!`,
        });
        emit({ type: "enemy", damage, blocked });
        window.setTimeout(() => {
            if (hp <= 0) {
                loseRun();
                return;
            }
            const current = store.get();
            const discarded = [...current.discardPile, ...current.hand];
            const refill = draw(5, [], current.drawPile, discarded);
            store.patch({
                ...refill,
                energy: 3,
                turn: current.turn + 1,
                intentIndex: current.intentIndex + 1,
                enemyGuard: enemy.mechanic === "armor" ? ARMOR_PER_TURN : current.enemyGuard,
                combatPhase: "player",
                banner: "Your move, Chef.",
                ftueStep: current.ftueStep === 4 ? 5 : current.ftueStep,
            });
            stampRun("battle");
            void saveSystem.flush();
        }, 850);
    },

    winEncounter(): void {
        const state = store.get();
        const defeatedEnemies = state.defeatedEnemies.includes(state.enemyId)
            ? state.defeatedEnemies
            : [...state.defeatedEnemies, state.enemyId];
        store.patch({ combatPhase: "victory", enemyHp: 0, banner: "DISH RESCUED!", defeatedEnemies });
        emit({ type: "victory" });
        window.setTimeout(() => {
            const current = store.get();
            if (current.tier >= TIERS.length - 1) {
                const servicesCompleted = recordRunResolved("victory");
                store.patch({
                    phase: "result",
                    result: "victory",
                    cookbookStars: current.cookbookStars + 1,
                    savedRun: null,
                    servicesCompleted,
                });
            } else {
                const picks = shuffle(
                    CARD_LIBRARY.map((_, index) => index).filter((index) => !isSecretMenuIndex(index)),
                ).slice(0, 3);
                store.patch({
                    phase: "reward",
                    rewardChoices: picks.map((index, i) => makeCard(index, `reward-${i}`)),
                });
                stampRun("reward");
            }
            void saveSystem.flush();
            // Long enough for the battle stage's victory celebration (dish pop,
            // rays, confetti, title card) to play out. Shorten this and the win
            // reads as a screen swap again — see battleScene's victory handler.
        }, VICTORY_CELEBRATION_MS);
    },

    chooseReward(card: Card): void {
        this.advanceAfterReward([...store.get().drawPile, ...store.get().discardPile, ...store.get().hand, card], 0);
    },

    /** Decline the card and patch up instead. */
    skipReward(): void {
        runtimeServices.track("reward_skipped", { encounter: store.get().encounter });
        this.advanceAfterReward([...store.get().drawPile, ...store.get().discardPile, ...store.get().hand], 8);
    },

    /** Thin the deck instead of growing it. */
    removeCard(cardId: string): void {
        const state = store.get();
        const all = [...state.drawPile, ...state.discardPile, ...state.hand];
        const target = all.find((candidate) => candidate.id === cardId);
        if (!target) return;
        runtimeServices.track("card_removed", { card: target.name, encounter: state.encounter });
        this.advanceAfterReward(
            all.filter((candidate) => candidate.id !== cardId),
            0,
        );
    },

    advanceAfterReward(deck: Card[], extraHeal: number): void {
        const state = store.get();
        const playerHp = Math.min(state.playerMaxHp, state.playerHp + 10 + extraHeal);
        const options = TIERS[state.tier + 1]!;
        if (options.length > 1) {
            store.patch({
                phase: "course",
                playerHp,
                hand: [],
                discardPile: [],
                drawPile: deck,
                rewardChoices: [],
                courseChoices: [...options],
            });
            stampRun("course");
            void saveSystem.flush();
            return;
        }
        this.startEncounter(options[0]!, deck, playerHp);
    },

    chooseCourse(enemyId: EnemyId): void {
        const state = store.get();
        if (state.phase !== "course" || !state.courseChoices.includes(enemyId)) return;
        runtimeServices.track("course_selected", { enemyId, tier: state.tier + 1 });
        // Depth of service is this roguelite's progression — the number a player
        // would quote, unlike a per-run score.
        analytics.event("milestone_reached", {
            milestone: "deepest_course",
            value: state.tier + 1,
            previous: state.tier,
        });
        this.startEncounter(enemyId, state.drawPile, state.playerHp);
    },

    startEncounter(enemyId: EnemyId, deckCards: Card[], playerHp: number): void {
        const state = store.get();
        const enemy = enemyById(enemyId);
        const deck = shuffle(deckCards);
        const opening = draw(5, [], deck, []);
        store.patch({
            phase: "playing",
            combatPhase: "player",
            tier: state.tier + 1,
            encounter: state.encounter + 1,
            playerHp,
            guard: 0,
            energy: 3,
            rewardChoices: [],
            courseChoices: [],
            ...encounterFields(enemy),
            ...opening,
        });
        stampRun("battle");
        void saveSystem.flush();
    },
};
