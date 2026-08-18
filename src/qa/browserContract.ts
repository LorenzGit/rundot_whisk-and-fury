import packageJson from "../../package.json";
import { audioManager } from "../audio/audioManager.ts";
import { getRunCapabilities } from "../sdk/runSdk.ts";
import { store } from "../state/store.ts";
import { combat } from "../game/combat.ts";

interface GameQa {
    snapshot(): Record<string, unknown>;
    startRun(): void;
    winEncounter(): void;
    openSettings(): void;
    returnToMenu(): void;
}

declare global {
    // Development-only semantic browser contract. Never present in production.
    var __gameQa: GameQa | undefined;
}

export function installBrowserQaContract(): void {
    if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get("qa") !== "1") return;
    document.documentElement.dataset.qaContract = "ready";
    globalThis.__gameQa = {
        snapshot() {
            const state = store.get();
            return {
                version: packageJson.version,
                phase: state.phase,
                combatPhase: state.combatPhase,
                menuScreen: state.menuScreen,
                paused: state.paused,
                encounter: state.encounter,
                tier: state.tier,
                enemyId: state.enemyId,
                enemySequence: state.enemySequence,
                recipeProgress: state.recipeProgress,
                comboChain: state.comboChain,
                enemyGuard: state.enemyGuard,
                energy: state.energy,
                guard: state.guard,
                ftueCompleted: state.ftueCompleted,
                ftueStep: state.ftueStep,
                playerHp: state.playerHp,
                enemyHp: state.enemyHp,
                savedRun: state.savedRun?.stage ?? null,
                courseChoices: state.courseChoices,
                hand: state.hand.map((card) => card.name),
                renderer: document.documentElement.dataset.renderer ?? "pending",
                host: getRunCapabilities().host,
                audio: audioManager.debugSnapshot(),
            };
        },
        startRun() {
            combat.startRun();
        },
        winEncounter() {
            // Fast-forward for automated QA of late-run screens.
            if (store.get().phase === "playing") combat.winEncounter();
        },
        openSettings() {
            store.patch({ phase: "menu", menuScreen: "settings" });
        },
        returnToMenu() {
            store.patch({ phase: "menu", menuScreen: "main" });
        },
    };
}
