import { combat } from "../game/combat.ts";
import { store, useStore } from "../state/store.ts";
import { runtimeServices } from "../systems/runtimeServices.ts";
import { saveSystem } from "../systems/save.ts";
import { analytics } from "../systems/analytics/analyticsConfig.ts";

export default function ResultScreen() {
    const result = useStore((state) => state.result);
    const claimed = useStore((state) => state.resultBonusClaimed);
    const claimEncore = async () => {
        if (claimed) return;
        const outcome = await runtimeServices.watchResultsAd();
        runtimeServices.track("rewarded_encore_result", { outcome });
        // One schema for every payout so the whole economy reads off one event.
        if (outcome === "verified") {
            analytics.event("reward_granted", { amount: 1, currency: "encore", source: "rewarded_encore" });
        }
        if (outcome === "verified") {
            store.patch({
                cookbookStars: store.get().cookbookStars + 1,
                resultBonusClaimed: true,
                toast: "Encore! +1 cookbook star.",
            });
            await saveSystem.flush();
        } else {
            store.patch({
                toast:
                    outcome === "cancelled"
                        ? "Ad closed; no reward claimed."
                        : "Rewarded ads are available through RUN when ready.",
            });
        }
    };
    return (
        <main className={`result-screen ${result} pt-safe-top pb-safe-bottom`}>
            <div>
                <p className="title-kicker">
                    {result === "victory" ? "THE MIDNIGHT MENU IS SAVED" : "SERVICE IS NOT OVER"}
                </p>
                <h2>{result === "victory" ? "A standing ovation." : "Back to the prep table."}</h2>
                <p>
                    {result === "victory"
                        ? "Vesper smiles despite herself. Bea has earned a new cookbook star."
                        : "Every ruined dish teaches a better trick. Bea is ready for another service."}
                </p>
                <button type="button" className="primary-cta" onClick={() => combat.startRun()}>
                    COOK AGAIN →
                </button>
                <button type="button" className="encore-button" disabled={claimed} onClick={() => void claimEncore()}>
                    {claimed ? "ENCORE STAR CLAIMED ✓" : "WATCH OPTIONAL AD · +1 COOKBOOK STAR"}
                </button>
                <button type="button" className="quiet-button" onClick={() => store.patch({ phase: "menu" })}>
                    RETURN TO MENU
                </button>
            </div>
        </main>
    );
}
