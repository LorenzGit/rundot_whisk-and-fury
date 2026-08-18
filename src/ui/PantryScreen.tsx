import { useState } from "react";
import { runtimeServices } from "../systems/runtimeServices.ts";
import { store, useStore } from "../state/store.ts";
import MenuScreenLayout from "./MenuScreenLayout.tsx";

export default function PantryScreen() {
    const owned = useStore((state) => state.chefsTableOwned);
    const price = useStore((state) => state.shopPriceLabel);
    const runtimeReady = useStore((state) => state.runtimeReady);
    const loading = useStore((state) => state.monetizationLoading);
    const [purchasing, setPurchasing] = useState(false);

    const purchase = async () => {
        if (purchasing || owned) return;
        setPurchasing(true);
        runtimeServices.track("shop_purchase_started", { item: "chefs_table_pass" });
        const result = await runtimeServices.purchaseChefsTable(crypto.randomUUID());
        setPurchasing(false);
        runtimeServices.track("shop_purchase_result", { item: "chefs_table_pass", result });
        store.patch({
            toast:
                result === "verified"
                    ? "Chef's Table Pass unlocked!"
                    : result === "cancelled"
                      ? "Purchase cancelled."
                      : result === "unavailable"
                        ? "Open Whisk & Fury in RUN to see the live offer."
                        : "Purchase could not be verified. Nothing was granted.",
        });
    };

    return (
        <MenuScreenLayout title="The Pantry" kicker="OPTIONAL EXTRAS">
            <section className="shop-hero">
                <span className="shop-crown" aria-hidden="true">
                    ♛
                </span>
                <small>ONE-TIME COSMETIC PASS</small>
                <h3>Chef's Table Pass</h3>
                <p>Gild the cookbook, add Bea's copper patron badge, and support the next ridiculous recipe.</p>
                <ul>
                    <li>Golden cookbook frame and flourishes</li>
                    <li>Exclusive “Chef's Table” menu badge</li>
                    <li>No combat power, cards, or monsters withheld</li>
                </ul>
                <button
                    className="primary-cta"
                    type="button"
                    disabled={purchasing || owned || loading}
                    onClick={() => void purchase()}
                >
                    <span>
                        {owned ? "OWNED" : purchasing ? "VERIFYING…" : runtimeReady ? "UNLOCK PASS" : "CONNECTING…"}
                    </span>
                    <b>{owned ? "✓" : (price ?? "LIVE RUN PRICE")}</b>
                </button>
            </section>
            <section className="ad-policy-card">
                <small>REWARDED ADS</small>
                <h3>Encore Star</h3>
                <p>
                    After a completed service, you may watch one optional ad for one bonus cookbook star. Skipping never
                    slows the run, hides content, or changes combat odds.
                </p>
                <b>No forced ads at launch.</b>
            </section>
            <p className="shop-fineprint">
                Prices and ownership come directly from RUN. Local preview never simulates a purchase or grants a paid
                reward.
            </p>
        </MenuScreenLayout>
    );
}
