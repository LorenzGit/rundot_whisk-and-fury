import { useEffect, useState } from "react";
import packageJson from "../../package.json";
import { audioManager } from "../audio/audioManager.ts";
import { combat, DECKS, enemyById } from "../game/combat.ts";
import { store, useStore } from "../state/store.ts";
import { analytics, FIRST_PLAY_FUNNEL } from "../systems/analytics/analyticsConfig.ts";
import { claimSpecial, specialView } from "../systems/dailySpecial.ts";
import { runtimeServices } from "../systems/runtimeServices.ts";
import { saveSystem } from "../systems/save.ts";

/**
 * The daily special, and the only reason the 24h reminder is honest.
 *
 * Sits in the menu dock directly above the play CTA: a reward the player has
 * to go looking for is one they never claim, and the notification deep-links
 * to this screen expecting to find it.
 */
function DailySpecial() {
    const specialDay = useStore((state) => state.specialDay);
    const specialArmed = useStore((state) => state.specialArmed);
    // The trusted clock can answer after first paint, so keep checking on a
    // slow tick until it does rather than resting on a boot-time "not ready".
    const [, forceTick] = useState(0);
    const view = specialView();
    useEffect(() => {
        if (view.day) return;
        const timer = window.setInterval(() => forceTick((n) => n + 1), 1000);
        return () => window.clearInterval(timer);
    }, [view.day]);

    if (!view.day) return null;
    void specialDay;
    if (!view.claimable) {
        return (
            <p className="daily-special-note">
                {specialArmed
                    ? `TODAY'S SPECIAL IS ON THE BENCH — IT KEEPS FOR YOUR NEXT SERVICE`
                    : `SPECIAL USED — THE KITCHEN RESTOCKS TOMORROW (DAY ${Math.max(view.nextStreak, 1)})`}
            </p>
        );
    }
    return (
        <button
            type="button"
            className="daily-special-claim"
            onClick={() => {
                const claim = claimSpecial();
                if (!claim.ok) return;
                audioManager.play("start");
                void runtimeServices.haptic("success");
                store.patch({
                    banner: claim.guard
                        ? `DAY ${claim.streak} SPECIAL: +${claim.hp} HP AND ${claim.guard} GUARD`
                        : `DAY ${claim.streak} SPECIAL: +${claim.hp} HP`,
                });
            }}
        >
            <span className="daily-special-label">DAY {view.nextStreak} SPECIAL</span>
            <span className="daily-special-value">
                +{view.hp} HP{view.guard ? ` · ${view.guard} GUARD` : ""}
            </span>
        </button>
    );
}

export default function MainMenu() {
    const stars = useStore((state) => state.cookbookStars);
    const ftueCompleted = useStore((state) => state.ftueCompleted);
    const deckChoice = useStore((state) => state.deckChoice);
    const savedRun = useStore((state) => state.savedRun);
    const patron = useStore((state) => state.chefsTableOwned);
    const unlockedDecks = DECKS.filter((deck) => deck.stars <= stars);
    const unlockAudio = () =>
        void audioManager.unlock().then(() => {
            audioManager.play("start");
            void runtimeServices.haptic("light");
        });
    const start = async (tutorial?: boolean) => {
        analytics.funnelStep(FIRST_PLAY_FUNNEL, 2);
        if (tutorial === undefined) combat.startRun();
        else combat.startRun({ tutorial });
        unlockAudio();
    };
    const resume = () => {
        if (combat.resumeRun()) unlockAudio();
    };
    return (
        <main className="title-screen pt-safe-top pb-safe-bottom">
            <div className="title-vignette" />
            <section className="title-lockup">
                <p className="title-kicker">A CULINARY ROGUELIKE</p>
                <h1>
                    WHISK <i>&amp;</i>
                    <br />
                    <span>FURY</span>
                </h1>
                {patron && (
                    <p className="patron-plaque">
                        <i aria-hidden="true">♛</i>
                        CHEF'S TABLE
                    </p>
                )}
            </section>
            <section className="menu-dock">
                <p className="title-pitch">
                    Match flavors left to right. Build a Perfect Plate. Turn every monster into something delicious.
                </p>
                <div className="menu-loop">
                    <span>
                        <b>1</b> MATCH
                    </span>
                    <i>→</i>
                    <span>
                        <b>2</b> COMBO
                    </span>
                    <i>→</i>
                    <span>
                        <b>3</b> SERVE
                    </span>
                </div>
                <DailySpecial />
                {unlockedDecks.length > 1 && !savedRun && (
                    <fieldset className="deck-select">
                        <legend className="sr-only">Starting deck</legend>
                        {DECKS.map((deck) => {
                            const locked = deck.stars > stars;
                            return (
                                <button
                                    type="button"
                                    aria-pressed={deckChoice === deck.id}
                                    className={deckChoice === deck.id ? "active" : ""}
                                    disabled={locked}
                                    key={deck.id}
                                    onClick={() => {
                                        audioManager.play("tap");
                                        store.patch({ deckChoice: deck.id });
                                        void saveSystem.flush();
                                    }}
                                >
                                    <strong>{deck.name}</strong>
                                    <small>{locked ? `★ ${deck.stars} TO UNLOCK` : deck.blurb}</small>
                                </button>
                            );
                        })}
                    </fieldset>
                )}
                {savedRun && (
                    <button type="button" className="primary-cta" onClick={resume}>
                        <span>
                            RESUME SERVICE · COURSE {Math.min(6, savedRun.encounter + 1)} ·{" "}
                            {enemyById(savedRun.enemyId).name.toUpperCase()}
                        </span>
                        <b aria-hidden="true">→</b>
                    </button>
                )}
                <button
                    type="button"
                    className={savedRun ? "primary-cta secondary" : "primary-cta"}
                    onClick={() => void start()}
                >
                    <span>
                        {savedRun ? "NEW SERVICE" : ftueCompleted ? "ENTER THE KITCHEN" : "START COOKING LESSON"}
                    </span>
                    <b aria-hidden="true">→</b>
                </button>
                <div className="title-footer">
                    <span>COOKBOOK ★ {stars}</span>
                    <nav>
                        <button type="button" onClick={() => void start(true)}>
                            HOW TO PLAY
                        </button>
                        <button type="button" onClick={() => store.patch({ menuScreen: "bestiary" })}>
                            BESTIARY
                        </button>
                        <button type="button" onClick={() => store.patch({ menuScreen: "pantry" })}>
                            PANTRY
                        </button>
                        <button type="button" onClick={() => store.patch({ menuScreen: "settings" })}>
                            SETTINGS
                        </button>
                    </nav>
                </div>
            </section>
            <span className="build-version">v{packageJson.version}</span>
        </main>
    );
}
