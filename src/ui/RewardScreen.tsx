import { useState } from "react";
import { audioManager } from "../audio/audioManager.ts";
import { combat, enemyById, FLAVOR_META } from "../game/combat.ts";
import { useStore } from "../state/store.ts";

export default function RewardScreen() {
    const cards = useStore((state) => state.rewardChoices);
    const hand = useStore((state) => state.hand);
    const drawPile = useStore((state) => state.drawPile);
    const discardPile = useStore((state) => state.discardPile);
    const encounter = useStore((state) => state.encounter);
    const enemy = enemyById(useStore((state) => state.enemyId));
    const [removing, setRemoving] = useState(false);
    const deck = [...drawPile, ...discardPile, ...hand].sort((a, b) =>
        a.library === b.library ? a.id.localeCompare(b.id) : a.library - b.library,
    );

    if (removing) {
        return (
            <main className="reward-screen pt-safe-top pb-safe-bottom">
                <p className="title-kicker">SHAPE YOUR DECK</p>
                <h2>Remove one card for good.</h2>
                <p>A leaner deck finds the right flavor faster. {deck.length} cards in your deck.</p>
                <div className="remove-grid">
                    {deck.map((card) => (
                        <button
                            type="button"
                            onClick={() => {
                                audioManager.play("tap");
                                combat.removeCard(card.id);
                            }}
                            style={{ "--flavor": FLAVOR_META[card.flavor].color } as React.CSSProperties}
                            key={card.id}
                        >
                            <span className={`ingredient ingredient-${card.ingredient}`} aria-hidden="true" />
                            <strong>{card.name}</strong>
                            <small>{FLAVOR_META[card.flavor].label}</small>
                        </button>
                    ))}
                </div>
                <div className="reward-actions">
                    <button type="button" className="quiet-button" onClick={() => setRemoving(false)}>
                        ◄ BACK TO NEW CARDS
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="reward-screen pt-safe-top pb-safe-bottom">
            {/* Lead with the win. The kill itself lasts ~1.2s on the battle
                stage, which is easy to miss — without this the next screen
                just looks like another menu and players ask if they won. */}
            <section className="victory-crest">
                <span
                    className="victory-dish"
                    style={{ backgroundImage: `url(${enemy.art})` }}
                    role="img"
                    aria-label={`${enemy.name}, plated`}
                />
                <div>
                    <p className="title-kicker">COURSE {encounter + 1} OF 6 · PLATED</p>
                    <strong>{enemy.name} is a dish now.</strong>
                </div>
            </section>
            <h2>Pick a card.</h2>
            <p>It joins your deck for the rest of this run — you'll draw it in later fights.</p>
            <div className="reward-cards">
                {cards.map((card) => {
                    const meta = FLAVOR_META[card.flavor];
                    return (
                        <button
                            type="button"
                            onClick={() => {
                                audioManager.play("reward");
                                combat.chooseReward(card);
                            }}
                            style={{ "--flavor": meta.color } as React.CSSProperties}
                            aria-label={`Add ${card.name}, ${meta.label}, costs ${card.cost} heat, ${card.damage} taste${card.guard ? `, ${card.guard} guard` : ""}`}
                            key={card.id}
                        >
                            {/* Same chrome as a card in hand — cost pip, flavour
                                border, ◆/◇ stats — so the thing being chosen is
                                visibly the thing you will hold. */}
                            <span className="reward-face">
                                <span className="card-cost">{card.cost}</span>
                                <span className={`ingredient ingredient-${card.ingredient}`} aria-hidden="true" />
                                <small>{meta.label}</small>
                            </span>
                            <strong>{card.name}</strong>
                            <p>{card.copy}</p>
                            <b>
                                <i>◆{card.damage}</i> TASTE
                                {card.guard > 0 && (
                                    <>
                                        {" · "}
                                        <i>◇{card.guard}</i> GUARD
                                    </>
                                )}
                                {card.effect === "draw1" ? " · DRAW 1" : ""}
                                {card.effect === "scorch" ? " · BURNS PATTERN" : ""}
                            </b>
                        </button>
                    );
                })}
            </div>
            <div className="reward-actions">
                <button
                    type="button"
                    className="quiet-button"
                    onClick={() => {
                        audioManager.play("tap");
                        combat.skipReward();
                    }}
                >
                    NO CARD · PATCH UP +8 HP
                </button>
                <button
                    type="button"
                    className="quiet-button"
                    onClick={() => {
                        audioManager.play("tap");
                        setRemoving(true);
                    }}
                >
                    REMOVE A CARD INSTEAD
                </button>
            </div>
        </main>
    );
}
