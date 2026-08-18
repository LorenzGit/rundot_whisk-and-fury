/**
 * Shared shell and combat state. React subscribes for UI; Pixi reads it only
 * at event boundaries so no React work occurs in the animation loop.
 */
import { useSyncExternalStore } from "react";
import type { Card, DeckId, EnemyId, Flavor } from "../game/combat.ts";

export type MenuScreen = "main" | "settings" | "bestiary" | "pantry";

/**
 * A resumable run captured at a stable point (start of a player turn, or a
 * reward/course screen). Cards persist as CARD_LIBRARY indices; everything is
 * primitive so it round-trips through app storage and survives schema drift —
 * combat.resumeRun() revalidates before trusting any of it.
 */
export interface RunSnapshot {
    stage: "battle" | "reward" | "course";
    deckId: string;
    tier: number;
    encounter: number;
    enemyId: string;
    enemySequence: string[];
    enemyHp: number;
    enemyMaxHp: number;
    enemyGuard: number;
    enemyReviveUsed: boolean;
    enemyPhase2: boolean;
    playerHp: number;
    playerMaxHp: number;
    guard: number;
    energy: number;
    recipeProgress: number;
    comboChain: number;
    turn: number;
    intentIndex: number;
    hand: number[];
    drawPile: number[];
    discardPile: number[];
    rewardChoices: number[];
    courseChoices: string[];
}

export interface AppState {
    /** Boot and navigation state */
    phase: "loading" | "menu" | "playing" | "reward" | "course" | "result";
    /** Progress bar state while critical assets warm */
    loadProgress: number;
    /** Game is paused by host lifecycle */
    paused: boolean;
    /** Selected menu screen (inside phase === 'menu') */
    menuScreen: MenuScreen;

    totalPlays: number;
    /**
     * Services RESOLVED (victory or defeat) — unlike totalPlays, which counts
     * starts, this moves +1 per resolution so the counted `engagement` funnel
     * (session_completed_N) can never skip a value across abandoned runs.
     */
    servicesCompleted: number;
    ftueCompleted: boolean;
    ftueStep: number | null;

    /** Player settings mirrored from save */
    musicEnabled: boolean;
    musicVolume: number;
    sfxEnabled: boolean;
    sfxVolume: number;
    /** Mirrors the app-wide RUN permission; re-derived on every boot. */
    notificationsEnabled: boolean;
    /**
     * The player's own "not in this game" choice, set only from Settings.
     * Separate from the host permission because that permission is shared by
     * every RUN game: turning reminders off here must not silence the others.
     */
    notificationsOptOut: boolean;
    notificationsConsent: "unknown" | "granted" | "denied";
    hapticsEnabled: boolean;
    reducedMotion: boolean;
    locale: string;
    quality: "high" | "low";

    /** One-time toasts surfaced from systems/purchases/tutorials */
    toast: string | null;
    /** Bumped on every toast set so a repeated identical toast restarts its timer. */
    toastSeq: number;

    runtimeReady: boolean;
    runtimeConfigVersion: string | null;
    trustedTimeReady: boolean;

    combatPhase: "player" | "animating" | "enemy" | "victory" | "defeat";
    /** Tier index into TIERS (course plan position). */
    tier: number;
    /** Courses completed so far this run (display: COURSE encounter+1). */
    encounter: number;
    playerHp: number;
    playerMaxHp: number;
    enemyId: EnemyId;
    enemyHp: number;
    enemyMaxHp: number;
    /** Live recipe — enemy mechanics may rewrite it mid-fight. */
    enemySequence: Flavor[];
    /** Caramel armor absorbing damage before HP (Croquembouche Queen). */
    enemyGuard: number;
    enemyReviveUsed: boolean;
    enemyPhase2: boolean;
    energy: number;
    guard: number;
    recipeProgress: number;
    /** Perfect Plates chained this fight without a broken sequence. */
    comboChain: number;
    turn: number;
    intentIndex: number;
    hand: Card[];
    drawPile: Card[];
    discardPile: Card[];
    banner: string;
    rewardChoices: Card[];
    /** Enemy options when phase === 'course'. */
    courseChoices: EnemyId[];
    result: "victory" | "defeat";
    cookbookStars: number;
    /** Monsters ever defeated — unlocks their Cookbook (bestiary) entry. */
    defeatedEnemies: EnemyId[];
    /** Starting deck for the next run (unlocked with cookbook stars). */
    deckChoice: DeckId;
    /** Daily special: last claimed local day key, the forgiving streak, and
     * whether a claimed special is still waiting to be spent on a service. */
    specialDay: string | null;
    specialStreak: number;
    specialArmed: boolean;
    /** Persisted mid-run state, if a service is waiting to be resumed. */
    savedRun: RunSnapshot | null;
    resultBonusClaimed: boolean;
    chefsTableOwned: boolean;
    shopPriceLabel: string | null;
    monetizationLoading: boolean;
}

const listeners = new Set<() => void>();

let state: AppState = {
    phase: "loading",
    loadProgress: 0,
    paused: false,
    menuScreen: "main",

    totalPlays: 0,
    servicesCompleted: 0,
    ftueCompleted: false,
    ftueStep: null,

    musicEnabled: true,
    // Reads as a present bed rather than a wall. The mastered track's loudness
    // is handled by MUSIC_TRIM in audioManager, so this stays a plain 0-1
    // slider position and the SFX still clear it by ~17 dB.
    musicVolume: 0.45,
    sfxEnabled: true,
    sfxVolume: 0.7,
    notificationsEnabled: false,
    notificationsOptOut: false,
    notificationsConsent: "unknown",
    hapticsEnabled: true,
    reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    locale: "English",
    quality: "high",

    toast: null,
    toastSeq: 0,
    runtimeReady: false,
    runtimeConfigVersion: null,
    trustedTimeReady: false,
    combatPhase: "player",
    tier: 0,
    encounter: 0,
    playerHp: 54,
    playerMaxHp: 54,
    enemyId: "kraken",
    enemyHp: 42,
    enemyMaxHp: 42,
    enemySequence: ["fresh", "heat", "rich"],
    enemyGuard: 0,
    enemyReviveUsed: false,
    enemyPhase2: false,
    energy: 3,
    guard: 0,
    recipeProgress: 0,
    comboChain: 0,
    turn: 1,
    intentIndex: 0,
    hand: [],
    drawPile: [],
    discardPile: [],
    banner: "",
    rewardChoices: [],
    courseChoices: [],
    result: "victory",
    cookbookStars: 0,
    defeatedEnemies: [],
    deckChoice: "classic",
    specialDay: null,
    specialStreak: 0,
    specialArmed: false,
    savedRun: null,
    resultBonusClaimed: false,
    chefsTableOwned: false,
    shopPriceLabel: null,
    monetizationLoading: false,
};

export const store = {
    get(): AppState {
        return state;
    },

    patch(partial: Partial<AppState>): void {
        // Stamp toastSeq whenever a toast is set so every producer gets the
        // repeat-safe behavior without changing its call site.
        state =
            typeof partial.toast === "string"
                ? { ...state, ...partial, toastSeq: state.toastSeq + 1 }
                : { ...state, ...partial };
        for (const l of listeners) l();
    },

    subscribe(l: () => void): () => void {
        listeners.add(l);
        return () => listeners.delete(l);
    },
};

export function useStore<T = AppState>(selector: (s: AppState) => T = (s) => s as unknown as T): T {
    return useSyncExternalStore(store.subscribe, () => selector(state));
}
