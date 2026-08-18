import { recordAnalytics, recordFunnelStep } from "../../sdk/runSdk.ts";
import packageJson from "../../../package.json";
import { countedSteps, createAnalytics } from "./analytics.ts";

/**
 * whisk-and-fury funnel registry.
 *
 * The shipped funnel was a single `game_loaded` step — enough to prove the app
 * booted and nothing else. The name and step 1 are UNCHANGED so the existing
 * trend line survives; everything after it is new.
 *
 * Step names and numbers are frozen once deployed: append, never renumber.
 */
export const analytics = createAnalytics({
    emitEvent: (name, payload) => {
        void recordAnalytics(name, { ...payload, build_version: packageJson.version });
    },
    emitFunnelStep: (step, name, funnel, order) => {
        // Return the delivery promise so once-ever marks persist only after
        // the SDK confirms the step (see AnalyticsConfig.emitFunnelStep).
        return recordFunnelStep(step, name, funnel, order);
    },
    funnels: {
        /**
         * The loading phase itself, ahead of the first-run funnel (order 0).
         * Step 1 fires before any await and is buffered until the SDK transport
         * is up, so a player who quits mid-load still produces a row.
         */
        load: {
            order: 0,
            onceEver: true,
            steps: [
                "load_started", // first line of script execution
                "load_sdk_ready", // host handshake resolved
                "load_save_ready", // progress restored
                "load_assets_ready", // playable frame reachable
            ],
        },
        recipe_rumble: {
            order: 1,
            onceEver: true,
            steps: [
                "game_loaded", // shipped step 1 — preserved
                "run_started", // shipped step 2 — preserved
                "ftue_completed", // finished the coaching
                "first_run_ended", // first service resolved
            ],
        },
        // Repeatable: how deep players get across their first 12 sessions.
        engagement: { order: 2, steps: countedSteps("session_completed_", 12) },
    },
    marksKey: "whisk_and_fury_funnel_marks",
    debug: import.meta.env.DEV,
});

/** The funnel whose steps this game's first session is measured by. */
export const FIRST_PLAY_FUNNEL = "recipe_rumble";
