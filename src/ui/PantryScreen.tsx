import { useState } from "react";
import { CARD_LIBRARY, type Card, ENEMIES, FLAVOR_META, SECRET_MENU_START } from "../game/combat.ts";
import { getRunCapabilities } from "../sdk/runSdk.ts";
import { store, useStore } from "../state/store.ts";
import { runtimeServices } from "../systems/runtimeServices.ts";
import MenuScreenLayout from "./MenuScreenLayout.tsx";

const SECRET_MENU_CARDS = CARD_LIBRARY.slice(SECRET_MENU_START);

function PackFace({ card }: { card: Omit<Card, "id" | "library"> }) {
    const meta = FLAVOR_META[card.flavor];
    return (
        <li className="pack-face" style={{ "--flavor": meta.color } as React.CSSProperties}>
            <span className={`ingredient ingredient-${card.ingredient}`} aria-hidden="true" />
            <strong>{card.name}</strong>
            <small>
                {meta.label} · {card.cost} HEAT
            </small>
            <em>
                {card.damage} TASTE
                {card.guard > 0 ? ` · ${card.guard} GD` : ""}
            </em>
        </li>
    );
}

const PREVIEW_DISH = ENEMIES.find((enemy) => enemy.id === "kraken") ?? ENEMIES[0];

function purchaseToast(result: "verified" | "cancelled" | "unavailable" | "failed"): string {
    if (result === "verified") return "Chef's Table kitchen unlocked!";
    if (result === "cancelled") return "Purchase cancelled.";
    if (result === "unavailable") {
        return getRunCapabilities().host
            ? "Chef's Table Pass isn't available from RUN Shop right now."
            : "Open Whisk & Fury in RUN to buy this pass.";
    }
    return "Purchase could not be verified. Nothing was granted.";
}

export default function PantryScreen() {
    const owned = useStore((state) => state.chefsTableOwned);
    const price = useStore((state) => state.shopPriceLabel);
    const packOwned = useStore((state) => state.secretMenuOwned);
    const packPrice = useStore((state) => state.secretMenuPriceLabel);
    const runtimeReady = useStore((state) => state.runtimeReady);
    const loading = useStore((state) => state.monetizationLoading);
    const [purchasing, setPurchasing] = useState<"kitchen" | "pack" | null>(null);
    const hosted = getRunCapabilities().host && !getRunCapabilities().mock;
    const busy = purchasing !== null || loading;

    const buyKitchen = async () => {
        if (purchasing || owned) return;
        setPurchasing("kitchen");
        runtimeServices.track("shop_purchase_started", { item: "chefs_table_pass" });
        const result = await runtimeServices.purchaseChefsTable(crypto.randomUUID());
        setPurchasing(null);
        runtimeServices.track("shop_purchase_result", { item: "chefs_table_pass", result });
        store.patch({ toast: purchaseToast(result) });
    };

    const buyPack = async () => {
        if (purchasing || packOwned) return;
        setPurchasing("pack");
        runtimeServices.track("shop_purchase_started", { item: "secret_menu" });
        const result = await runtimeServices.purchaseSecretMenu(crypto.randomUUID());
        setPurchasing(null);
        runtimeServices.track("shop_purchase_result", { item: "secret_menu", result });
        store.patch({
            toast:
                result === "verified"
                    ? "Secret Menu is in your bag. Next service, all six ride along."
                    : purchaseToast(result).replace("Chef's Table Pass", "Secret Menu"),
        });
    };

    const priceCaption = owned ? "✓" : loading || !runtimeReady ? "…" : (price ?? (hosted ? "—" : "SEE IN RUN"));
    const packCaption = packOwned ? "✓" : loading || !runtimeReady ? "…" : (packPrice ?? (hosted ? "—" : "SEE IN RUN"));

    return (
        <MenuScreenLayout title="The Pantry" kicker="OPTIONAL EXTRAS">
            <section className="shop-hero shop-pack">
                <small>ONE-TIME CARD PACK</small>
                <h3>Secret Menu</h3>
                <p>
                    Six off-menu cards drop into every service after this one. Stronger than the house 1-costs. They
                    never show up as free reward picks.
                </p>
                <ul className="pack-grid" aria-label="The six Secret Menu cards">
                    {SECRET_MENU_CARDS.map((card) => (
                        <PackFace card={card} key={card.name} />
                    ))}
                </ul>
                <p className="shop-not shop-not-warn">
                    These cards deal more Taste and Guard than the free menu. Non-payers keep the full house library.
                </p>
                <button
                    className="primary-cta"
                    type="button"
                    disabled={busy || packOwned}
                    onClick={() => void buyPack()}
                >
                    <span>
                        {packOwned
                            ? "IN THE BAG"
                            : purchasing === "pack"
                              ? "VERIFYING…"
                              : runtimeReady
                                ? "BUY SECRET MENU"
                                : "CONNECTING…"}
                    </span>
                    <b>{packCaption}</b>
                </button>
            </section>
            <section className="shop-hero">
                <small>ONE-TIME KITCHEN THEME</small>
                <h3>Chef's Table Pass</h3>
                <p>
                    Dress Bea's kitchen in copper and gold. You see it every menu, every hand, every plated dish. Combat
                    stays the same.
                </p>
                <ul className="shop-get" aria-label="What the pass unlocks">
                    <li>
                        <span className="shop-preview shop-preview-card" aria-hidden="true">
                            <i className="ingredient ingredient-tomato" />
                            <b>TOMATO</b>
                        </span>
                        <strong>Gilded cards</strong>
                        <span>Gold foil frames on every ingredient you play.</span>
                    </li>
                    <li>
                        <span
                            className="shop-preview shop-preview-dish"
                            aria-hidden="true"
                            style={PREVIEW_DISH ? { backgroundImage: `url(${PREVIEW_DISH.art})` } : undefined}
                        />
                        <strong>Plated frames</strong>
                        <span>Copper rings on cookbook dishes and victory plates.</span>
                    </li>
                    <li>
                        <span className="shop-preview shop-preview-plaque" aria-hidden="true">
                            <i>♛</i>
                            CHEF'S TABLE
                        </span>
                        <strong>Menu plaque</strong>
                        <span>A copper Chef's Table badge on the title kitchen.</span>
                    </li>
                    <li>
                        <span className="shop-preview shop-preview-apron" aria-hidden="true">
                            <b>CHEF BEA</b>
                            <i>♛ PATRON</i>
                        </span>
                        <strong>Patron apron</strong>
                        <span>Copper nameplate during service. No extra Taste or HP.</span>
                    </li>
                </ul>
                <p className="shop-not">Never grants cards, stars, decks, monsters, or combat power.</p>
                <button
                    className="primary-cta"
                    type="button"
                    disabled={busy || owned}
                    onClick={() => void buyKitchen()}
                >
                    <span>
                        {owned
                            ? "OWNED"
                            : purchasing === "kitchen"
                              ? "VERIFYING…"
                              : runtimeReady
                                ? "UNLOCK KITCHEN"
                                : "CONNECTING…"}
                    </span>
                    <b>{priceCaption}</b>
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
                {hosted
                    ? "Price comes from RUN Shop. Refresh after buying — ownership is read from your RUN entitlement."
                    : "Prices and ownership come from RUN Shop. Local preview never simulates a purchase or grants a paid reward."}
            </p>
        </MenuScreenLayout>
    );
}
