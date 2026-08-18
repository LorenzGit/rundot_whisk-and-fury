import { useState } from "react";
import { CARD_LIBRARY, ENEMIES, FLAVOR_META, type Card } from "../game/combat.ts";
import { useStore } from "../state/store.ts";
import MenuScreenLayout from "./MenuScreenLayout.tsx";

type Shelf = "monsters" | "ingredients" | "cards";

function CardTile({ card }: { card: Omit<Card, "id" | "library"> }) {
    const meta = FLAVOR_META[card.flavor];
    return (
        <article className="catalog-card" style={{ "--flavor": meta.color } as React.CSSProperties}>
            <span className={`ingredient ingredient-${card.ingredient}`} aria-hidden="true" />
            <div>
                <small>
                    {meta.label} · {card.cost} HEAT
                </small>
                <h3>{card.name}</h3>
                <p>{card.copy}</p>
                <b>
                    {card.damage} TASTE {card.guard > 0 ? `· ${card.guard} GUARD` : ""}
                    {card.effect === "draw1" ? "· DRAW 1" : ""}
                    {card.effect === "scorch" ? "· BURNS PATTERN" : ""}
                </b>
            </div>
        </article>
    );
}

export default function BestiaryScreen() {
    const [shelf, setShelf] = useState<Shelf>("monsters");
    const defeatedEnemies = useStore((state) => state.defeatedEnemies);
    const ingredients = Array.from(new Map(CARD_LIBRARY.map((card) => [card.ingredient, card])).values());
    const plated = ENEMIES.filter((enemy) => defeatedEnemies.includes(enemy.id)).length;
    return (
        <MenuScreenLayout title="Bea's Big Cookbook" kicker="BESTIARY & PANTRY">
            <nav className="cookbook-tabs" aria-label="Cookbook shelves">
                {(["monsters", "ingredients", "cards"] as const).map((tab) => (
                    <button
                        className={shelf === tab ? "active" : ""}
                        onClick={() => setShelf(tab)}
                        type="button"
                        key={tab}
                    >
                        {tab.toUpperCase()}{" "}
                        <span>
                            {tab === "monsters"
                                ? `${plated}/${ENEMIES.length}`
                                : tab === "cards"
                                  ? CARD_LIBRARY.length
                                  : ingredients.length}
                        </span>
                    </button>
                ))}
            </nav>
            {shelf === "monsters" && (
                <section className="monster-grid" aria-label="All recipe monsters">
                    {ENEMIES.map((enemy, index) => {
                        const unlocked = defeatedEnemies.includes(enemy.id);
                        return (
                            <article className={`monster-entry ${unlocked ? "" : "locked"}`} key={enemy.id}>
                                <div
                                    className={`monster-portrait ${unlocked ? "plated" : ""}`}
                                    style={
                                        {
                                            backgroundImage: `url(${enemy.art})`,
                                            "--frame-aspect": enemy.frameAspect,
                                        } as React.CSSProperties
                                    }
                                />
                                <div>
                                    <small>
                                        DISH {index + 1} · {unlocked ? enemy.title : "STILL COOKING"}
                                    </small>
                                    <h3>{unlocked ? enemy.name : "???"}</h3>
                                    <p>{unlocked ? enemy.quip : "Defeat this course to plate its dish."}</p>
                                    {unlocked ? (
                                        <div className="mini-sequence">
                                            {enemy.sequence.map((flavor, step) => (
                                                <i
                                                    style={{ background: FLAVOR_META[flavor].color }}
                                                    // biome-ignore lint/suspicious/noArrayIndexKey: positional pips; flavors may repeat
                                                    key={step}
                                                    title={FLAVOR_META[flavor].label}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="mini-sequence">
                                            {enemy.sequence.map((_, step) => (
                                                // biome-ignore lint/suspicious/noArrayIndexKey: positional pips
                                                <i style={{ background: "#c9c2d6" }} key={step} title="Unknown" />
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {unlocked && <b className="plated-chip">PLATED ✓</b>}
                            </article>
                        );
                    })}
                </section>
            )}
            {shelf === "ingredients" && (
                <section className="ingredient-grid" aria-label="All ingredients">
                    {ingredients.map((card) => (
                        <article key={card.ingredient}>
                            <span className={`ingredient ingredient-${card.ingredient}`} aria-hidden="true" />
                            <h3>{card.ingredient.toUpperCase()}</h3>
                            <small style={{ color: FLAVOR_META[card.flavor].color }}>
                                {FLAVOR_META[card.flavor].label}
                            </small>
                        </article>
                    ))}
                </section>
            )}
            {shelf === "cards" && (
                <section className="card-catalog">
                    {CARD_LIBRARY.map((card) => (
                        <CardTile card={card} key={card.name} />
                    ))}
                </section>
            )}
        </MenuScreenLayout>
    );
}
