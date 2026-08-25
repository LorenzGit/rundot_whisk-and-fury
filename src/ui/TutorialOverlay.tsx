import { useEffect } from "react";
import { audioManager } from "../audio/audioManager.ts";
import { analytics, FIRST_PLAY_FUNNEL } from "../systems/analytics/analyticsConfig.ts";
import { saveSystem } from "../systems/save.ts";
import { runtimeServices } from "../systems/runtimeServices.ts";
import { store, useStore } from "../state/store.ts";

const COPY: Record<number, { eyebrow: string; title: string; body: string }> = {
    0: {
        eyebrow: "CHEF BEA'S QUICK LESSON",
        title: "Cook the pattern.",
        body: "Every recipe asks for flavors from left to right. Match the glowing flavor to build a Perfect Plate.",
    },
    // Steps 1–4 run beside a live board, so each body carries exactly one rule
    // in one line — this is the only place those rules are ever stated.
    1: {
        eyebrow: "STEP 1 · START FRESH",
        title: "Tap a green FRESH card.",
        body: "The lit token shows the flavor the recipe wants next.",
    },
    2: {
        eyebrow: "STEP 2 · TURN UP THE HEAT",
        title: "Now play a red HEAT card.",
        body: "On-flavor cards add +3 Taste. Wrong ones deal half.",
    },
    3: {
        eyebrow: "STEP 3 · FINISH RICH",
        title: "Complete it with a gold RICH card.",
        body: "Finishing the pattern serves a Perfect Plate: +14 Taste.",
    },
    4: {
        eyebrow: "STEP 4 · THE BOSS ANSWERS",
        title: "Your Heat is empty. Serve Turn.",
        body: "The boss hits for the number top-right. Guard soaks it first.",
    },
    5: {
        eyebrow: "LESSON COMPLETE",
        title: "That's the whole recipe.",
        body: "Read the next flavor, spend up to 3 Heat, build Guard when needed, and rescue the dish.",
    },
};

/** Steps 0 and 5 book-end the lesson as full-screen cards; 1–4 coach in place. */
const MODAL_STEPS = new Set([0, 5]);

async function completeFtue(step: number, skipped: boolean): Promise<void> {
    audioManager.play("tap");
    store.patch({
        ftueCompleted: true,
        ftueStep: null,
        toast: skipped ? "Tutorial skipped. Replay it from HOW TO PLAY." : "Lesson complete — rescue that recipe!",
    });
    runtimeServices.track(skipped ? "ftue_skipped" : "ftue_completed", { step });
    // Funnel step 3 fires on skip too: it marks the same store transition
    // (ftueCompleted: true) — the coaching phase ended and real play began.
    // The parallel ftue_skipped/ftue_completed events above keep the
    // distinction; once-ever dedup covers HOW TO PLAY replays.
    analytics.funnelStep(FIRST_PLAY_FUNNEL, 3);
    await saveSystem.flush();
}

function useStepTracking(step: number | null): void {
    useEffect(() => {
        if (step !== null) {
            runtimeServices.track("ftue_step_viewed", { step });
            // Canonical onboarding beat: the first coaching card IS the start.
            if (step === 0) runtimeServices.track("ftue_started", { step });
        }
    }, [step]);
}

/**
 * Steps 1–4, rendered IN FLOW in the HUD column directly above the chef status.
 *
 * It used to be an absolutely-positioned bar pinned under the battle banner,
 * which put it squarely over the monster — the thing the step is about. In flow
 * with `margin-top: auto` it docks to the bottom of the dead band between the
 * arena floor and the hand, so it covers only counter and Bea's midsection, and
 * appears/disappears without shifting a single other box.
 */
export function TutorialCoach() {
    const step = useStore((state) => state.ftueStep);
    useStepTracking(step);
    if (step === null || MODAL_STEPS.has(step)) return null;
    const copy = COPY[step] ?? COPY[0]!;
    return (
        <section className="ftue-inline" aria-live="polite">
            <div className="ftue-copy">
                <small>{copy.eyebrow}</small>
                <h2>{copy.title}</h2>
                <p>{copy.body}</p>
            </div>
            <button type="button" className="ftue-skip" onClick={() => void completeFtue(step, true)}>
                SKIP
            </button>
        </section>
    );
}

/** Steps 0 and 5 only — the full-screen open and close of the lesson. */
export default function TutorialOverlay() {
    const step = useStore((state) => state.ftueStep);
    if (step === null || !MODAL_STEPS.has(step)) return null;
    const copy = COPY[step] ?? COPY[0]!;

    return (
        <aside className={`ftue-layer ftue-step-${step}`} aria-live="polite">
            <section className="ftue-coach">
                <div className="ftue-bea" aria-hidden="true" />
                <div className="ftue-copy">
                    <small>{copy.eyebrow}</small>
                    <h2>{copy.title}</h2>
                    <p>{copy.body}</p>
                </div>
                <div className="ftue-actions">
                    {step === 0 && (
                        <button type="button" className="ftue-next" onClick={() => store.patch({ ftueStep: 1 })}>
                            SHOW ME →
                        </button>
                    )}
                    {step === 5 && (
                        <button type="button" className="ftue-next" onClick={() => void completeFtue(step, false)}>
                            LET'S COOK →
                        </button>
                    )}
                    {step === 0 && (
                        <button type="button" className="ftue-skip" onClick={() => void completeFtue(step, true)}>
                            SKIP LESSON
                        </button>
                    )}
                </div>
            </section>
        </aside>
    );
}
