import { getRunCapabilities, readAppStorage, writeAppStorage } from "../sdk/runSdk.ts";
import { store, type AppState, type RunSnapshot } from "../state/store.ts";

const SAVE_KEY = "whisk-and-fury-save";
export const SAVE_VERSION = 4;

/**
 * Music defaults this game has shipped and then replaced. See migrate(): a save
 * still carrying one of these was never touched by the player, so it should
 * follow the current default rather than freeze at a level tuned for a mix that
 * no longer exists.
 *   0.42 — procedural motif, before there was a music track at all
 *   0.2  — first pass with the track, before MUSIC_TRIM; inaudible in practice
 */
const SUPERSEDED_MUSIC_DEFAULTS = [0.42, 0.2];

export interface GameSaveV4 {
    version: 4;
    settings: Pick<
        AppState,
        | "musicEnabled"
        | "musicVolume"
        | "sfxEnabled"
        | "sfxVolume"
        | "notificationsEnabled"
        | "notificationsOptOut"
        | "notificationsConsent"
        | "hapticsEnabled"
        | "reducedMotion"
        | "locale"
        | "quality"
    >;
    progress: Pick<
        AppState,
        | "totalPlays"
        | "servicesCompleted"
        | "cookbookStars"
        | "ftueCompleted"
        | "defeatedEnemies"
        | "deckChoice"
        | "specialDay"
        | "specialStreak"
        | "specialArmed"
    >;
    /** Mid-run snapshot for RESUME SERVICE; shape-checked here, revalidated by combat.resumeRun(). */
    run: RunSnapshot | null;
}

export type SaveSource = "run" | "local" | "defaults";

function readLocalSave(): string | null {
    try {
        return window.localStorage.getItem(SAVE_KEY);
    } catch (error) {
        console.warn("[save] local fallback read failed", error);
        return null;
    }
}

function clamp01(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function enumOr<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
    return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function nonNegativeInteger(value: unknown, fallback = 0): number {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(number))) : fallback;
}

function stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string").slice(0, 64) : [];
}

function indexArray(value: unknown): number[] {
    return Array.isArray(value)
        ? value
              .map((entry) => nonNegativeInteger(entry, -1))
              .filter((entry) => entry >= 0)
              .slice(0, 128)
        : [];
}

/**
 * Shape-check a persisted run without importing game content (save must not
 * depend on combat). Semantic validation — enemy ids, card indices in range —
 * happens in combat.resumeRun() before any of this is trusted.
 */
function sanitizeRun(raw: unknown): RunSnapshot | null {
    if (!raw || typeof raw !== "object") return null;
    const run = raw as Partial<RunSnapshot>;
    if (run.stage !== "battle" && run.stage !== "reward" && run.stage !== "course") return null;
    if (typeof run.enemyId !== "string" || run.enemyId.length === 0) return null;
    return {
        stage: run.stage,
        deckId: typeof run.deckId === "string" ? run.deckId : "classic",
        tier: nonNegativeInteger(run.tier),
        encounter: nonNegativeInteger(run.encounter),
        enemyId: run.enemyId,
        enemySequence: stringArray(run.enemySequence),
        enemyHp: nonNegativeInteger(run.enemyHp),
        enemyMaxHp: nonNegativeInteger(run.enemyMaxHp),
        enemyGuard: nonNegativeInteger(run.enemyGuard),
        enemyReviveUsed: run.enemyReviveUsed === true,
        enemyPhase2: run.enemyPhase2 === true,
        playerHp: nonNegativeInteger(run.playerHp),
        playerMaxHp: nonNegativeInteger(run.playerMaxHp),
        guard: nonNegativeInteger(run.guard),
        energy: nonNegativeInteger(run.energy),
        recipeProgress: nonNegativeInteger(run.recipeProgress),
        comboChain: nonNegativeInteger(run.comboChain),
        turn: nonNegativeInteger(run.turn, 1),
        intentIndex: nonNegativeInteger(run.intentIndex),
        hand: indexArray(run.hand),
        drawPile: indexArray(run.drawPile),
        discardPile: indexArray(run.discardPile),
        rewardChoices: indexArray(run.rewardChoices),
        courseChoices: stringArray(run.courseChoices),
    };
}

function snapshot(): GameSaveV4 {
    const state = store.get();
    return {
        version: SAVE_VERSION,
        settings: {
            musicEnabled: state.musicEnabled,
            musicVolume: state.musicVolume,
            sfxEnabled: state.sfxEnabled,
            sfxVolume: state.sfxVolume,
            notificationsEnabled: state.notificationsEnabled,
            notificationsOptOut: state.notificationsOptOut,
            notificationsConsent: state.notificationsConsent,
            hapticsEnabled: state.hapticsEnabled,
            reducedMotion: state.reducedMotion,
            locale: state.locale,
            quality: state.quality,
        },
        progress: {
            totalPlays: state.totalPlays,
            servicesCompleted: state.servicesCompleted,
            cookbookStars: state.cookbookStars,
            ftueCompleted: state.ftueCompleted,
            defeatedEnemies: state.defeatedEnemies,
            deckChoice: state.deckChoice,
            specialDay: state.specialDay,
            specialStreak: state.specialStreak,
            specialArmed: state.specialArmed,
        },
        run: state.savedRun,
    };
}

function migrate(raw: unknown): GameSaveV4 | null {
    if (!raw || typeof raw !== "object") return null;
    const candidate = raw as Omit<Partial<GameSaveV4>, "version"> & { version?: number };
    if (
        (candidate.version !== 1 &&
            candidate.version !== 2 &&
            candidate.version !== 3 &&
            candidate.version !== SAVE_VERSION) ||
        !candidate.settings ||
        !candidate.progress
    )
        return null;
    const defaults = snapshot();
    return {
        version: SAVE_VERSION,
        settings: {
            musicEnabled: booleanOr(candidate.settings.musicEnabled, defaults.settings.musicEnabled),
            musicVolume: SUPERSEDED_MUSIC_DEFAULTS.includes(candidate.settings.musicVolume as number)
                ? defaults.settings.musicVolume
                : clamp01(candidate.settings.musicVolume, defaults.settings.musicVolume),
            sfxEnabled: booleanOr(candidate.settings.sfxEnabled, defaults.settings.sfxEnabled),
            sfxVolume: clamp01(candidate.settings.sfxVolume, defaults.settings.sfxVolume),
            hapticsEnabled: booleanOr(candidate.settings.hapticsEnabled, defaults.settings.hapticsEnabled),
            reducedMotion: booleanOr(candidate.settings.reducedMotion, defaults.settings.reducedMotion),
            locale: enumOr(
                candidate.settings.locale,
                ["English", "PortugueseBR", "SpanishLA"] as const,
                defaults.settings.locale,
            ),
            quality: enumOr(candidate.settings.quality, ["high", "low"] as const, defaults.settings.quality),
            notificationsConsent: enumOr(
                candidate.settings.notificationsConsent,
                ["unknown", "granted", "denied"] as const,
                defaults.settings.notificationsConsent,
            ),
            // Additive back-fill: "absent" must mean "has not opted out", or the
            // flag would re-silence every existing player.
            notificationsOptOut: booleanOr(candidate.settings.notificationsOptOut, false),
            notificationsEnabled: booleanOr(candidate.settings.notificationsEnabled, false),
        },
        progress: {
            totalPlays: nonNegativeInteger(candidate.progress.totalPlays),
            // Additive back-fill: saves written before this counter existed
            // resume at 0 — the engagement funnel measures from instrumentation
            // onward rather than guessing a history it never saw.
            servicesCompleted: nonNegativeInteger(candidate.progress.servicesCompleted),
            cookbookStars: nonNegativeInteger(candidate.progress.cookbookStars),
            ftueCompleted: booleanOr(candidate.progress.ftueCompleted, false),
            // Pre-v4 saves carry no collection or deck choice. The UI and
            // combat.resumeRun() treat unknown ids defensively, so a
            // permissive string filter is sufficient here.
            defeatedEnemies: stringArray(
                candidate.progress.defeatedEnemies,
            ) as GameSaveV4["progress"]["defeatedEnemies"],
            deckChoice: enumOr(candidate.progress.deckChoice, ["classic", "spice", "patissier"] as const, "classic"),
            // Additive back-fill: a save from before the daily special existed
            // has simply never claimed one, so it starts the ladder at day 1.
            specialDay:
                typeof candidate.progress.specialDay === "string" &&
                /^\d{4}-\d{2}-\d{2}$/.test(candidate.progress.specialDay)
                    ? candidate.progress.specialDay
                    : null,
            specialStreak: nonNegativeInteger(candidate.progress.specialStreak),
            specialArmed: booleanOr(candidate.progress.specialArmed, false),
        },
        run: candidate.version === SAVE_VERSION ? sanitizeRun(candidate.run) : null,
    };
}

function parse(raw: string | null): GameSaveV4 | null {
    if (!raw) return null;
    try {
        return migrate(JSON.parse(raw));
    } catch {
        return null;
    }
}

function apply(save: GameSaveV4): void {
    store.patch({ ...save.settings, ...save.progress, savedRun: save.run });
}

let lastSaved = "";
let pendingSave: string | null = null;
let flushInFlight: Promise<boolean> | null = null;

function usesRunStorage(): boolean {
    const capabilities = getRunCapabilities();
    return capabilities.host && !capabilities.mock;
}

async function persist(serialized: string): Promise<boolean> {
    if (usesRunStorage()) return writeAppStorage(SAVE_KEY, serialized);
    try {
        window.localStorage.setItem(SAVE_KEY, serialized);
        return true;
    } catch (error) {
        console.warn("[save] local fallback write failed", error);
        return false;
    }
}

export const saveSystem = {
    async load(): Promise<SaveSource> {
        if (!usesRunStorage()) {
            const save = parse(readLocalSave());
            if (save) apply(save);
            lastSaved = JSON.stringify(snapshot());
            return save ? "local" : "defaults";
        }

        const remote = await readAppStorage(SAVE_KEY);
        if (remote.ok) {
            const save = parse(remote.value);
            if (save) apply(save);
            lastSaved = JSON.stringify(snapshot());
            return save ? "run" : "defaults";
        }

        return "defaults";
    },

    async flush(): Promise<boolean> {
        const serialized = JSON.stringify(snapshot());
        if (serialized === lastSaved && pendingSave === null) return true;
        pendingSave = serialized;
        if (flushInFlight) return flushInFlight;

        // Serialize remote writes and coalesce rapid settings/gameplay changes.
        // An older, slower RPC can never complete after and overwrite a newer one.
        flushInFlight = (async () => {
            let allSucceeded = true;
            while (pendingSave !== null) {
                const next = pendingSave;
                pendingSave = null;
                if (next === lastSaved) continue;
                const saved = await persist(next);
                if (saved) lastSaved = next;
                else allSucceeded = false;
            }
            return allSucceeded;
        })().finally(() => {
            flushInFlight = null;
        });
        return flushInFlight;
    },
};
