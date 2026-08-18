import { useEffect, useRef, useState } from "react";
import { audioManager } from "../audio/audioManager.ts";
import {
    combat,
    comboBonus,
    enemyById,
    incomingPressure,
    previewPlay,
    FLAVOR_META,
    MATCH_BONUS,
    type Card,
    type PlayPreview,
} from "../game/combat.ts";
import { store, useStore } from "../state/store.ts";
import { runtimeServices } from "../systems/runtimeServices.ts";
import TutorialOverlay, { TutorialCoach } from "./TutorialOverlay.tsx";

const SPARKLE_IDS = ["lemon", "mint", "peach", "berry", "sky", "sugar", "cocoa", "cream"];

function Meter({ value, max, enemy = false }: { value: number; max: number; enemy?: boolean }) {
    return (
        <div className={`health-meter ${enemy ? "enemy" : "chef"}`}>
            <span style={{ width: `${Math.max(0, (value / max) * 100)}%` }} />
        </div>
    );
}

function RecipeSequence() {
    const sequence = useStore((state) => state.enemySequence);
    const progress = useStore((state) => state.recipeProgress);
    const chain = useStore((state) => state.comboChain);
    const enemyId = useStore((state) => state.enemyId);
    const enemy = enemyById(enemyId);
    return (
        <section className="recipe-panel" aria-label="Recipe flavor order">
            <span className="recipe-label">
                MATCH LEFT → RIGHT · PERFECT PLATE = +{comboBonus(chain)} TASTE
                {chain > 0 && <b className="chain-pill">CHAIN ×{chain + 1}</b>}
            </span>
            <div className="recipe-ribbon">
                {sequence.map((flavor, index) => {
                    const veiled = enemy.mechanic === "veiled" && index === sequence.length - 1 && index > progress;
                    const state = index < progress ? "complete" : index === progress ? "next" : "";
                    return (
                        // biome-ignore lint/suspicious/noArrayIndexKey: steps are positional; sequences may repeat a flavor and can be rewritten mid-fight
                        <div className="recipe-step" key={index}>
                            {index > 0 && <i className="recipe-arrow">›</i>}
                            <div
                                className={`flavor-pip ${state} ${veiled ? "veiled" : ""}`}
                                style={
                                    {
                                        "--flavor": veiled ? "#9a92b8" : FLAVOR_META[flavor].color,
                                    } as React.CSSProperties
                                }
                            >
                                {/* First letter of the flavor label (F/H/R/S/W), not the internal glyph name. */}
                                <b>{index < progress ? "✓" : veiled ? "?" : FLAVOR_META[flavor].label.slice(0, 1)}</b>
                                <span>
                                    {index === progress ? "NEXT · " : ""}
                                    {veiled ? "VEILED" : FLAVOR_META[flavor].label}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
            {enemy.trait && <span className="enemy-trait">◈ {enemy.trait}</span>}
        </section>
    );
}

/** Why the printed Taste differs from the card's base value, in the player's words. */
function playReason(preview: PlayPreview): string | null {
    if (preview.isPrep) return null;
    if (preview.combo) return `PLATE +${preview.bonus}`;
    if (preview.matched) return `MATCH +${MATCH_BONUS}`;
    return preview.resetsPattern ? "HALF · RESET" : "HALVED";
}

/**
 * At-a-glance effectiveness for THIS turn — ▲ green boosts the play, ▼ red
 * halves it, ★ completes the pattern. Every one of these is still playable;
 * only the dimmed-out `:disabled` cards (too little Heat) are not.
 *
 * Solid triangles rather than shafted ↑/↓: at 16px the shaft is the first
 * thing to turn to mush, and the silhouette has to survive.
 */
function verdictGlyph(preview: PlayPreview): string | null {
    if (preview.isPrep) return null;
    if (preview.combo) return "★";
    return preview.matched ? "▲" : "▼";
}

function HandCard({
    card,
    preview,
    disabled,
    index,
    recommended,
    offSequence,
    dealing,
    onGuardGain,
}: {
    card: Card;
    /** Live resolution against the current recipe step — the face shows this, not `card.damage`. */
    preview: PlayPreview;
    disabled: boolean;
    index: number;
    recommended: boolean;
    /** Affordable but not the glowing recipe step — still playable, dimmed. */
    offSequence: boolean;
    /** True only for brand-new cards so the deal animation never re-fires mid-hand. */
    dealing: boolean;
    /** Fired with the card's on-screen box so the ◇ can fly to the Guard total. */
    onGuardGain: (amount: number, from: DOMRect) => void;
}) {
    const meta = FLAVOR_META[card.flavor];
    const reason = playReason(preview);
    const verdict = verdictGlyph(preview);
    const shifted = preview.damage !== card.damage;
    return (
        <button
            type="button"
            disabled={disabled}
            className="combat-card"
            data-recommended={recommended ? "true" : "false"}
            data-off-sequence={offSequence ? "true" : "false"}
            data-technique={card.flavor === "wild" || card.flavor === "prep" ? "true" : "false"}
            data-dealing={dealing ? "true" : "false"}
            data-outcome={preview.combo ? "plate" : preview.matched ? "match" : preview.isPrep ? "prep" : "halved"}
            style={{ "--flavor": meta.color, "--card-index": index } as React.CSSProperties}
            aria-label={`${card.name}, ${meta.label}, deals ${preview.damage} taste${shifted ? ` instead of ${card.damage}` : ""}${card.guard ? `, ${card.guard} guard` : ""}${preview.combo ? ", completes the pattern" : preview.matched ? ", matches next flavor" : preview.resetsPattern ? ", wrong flavor and resets the pattern" : ""}`}
            onClick={(clickEvent) => {
                audioManager.play("tap");
                void runtimeServices.haptic("light");
                // Read the box BEFORE playing — the card leaves the hand and the
                // rest of the fan reindexes the moment the store updates.
                if (card.guard > 0) onGuardGain(card.guard, clickEvent.currentTarget.getBoundingClientRect());
                combat.playCard(card.id);
            }}
        >
            <span className="card-cost">{card.cost}</span>
            {verdict && (
                <span className="card-verdict" aria-hidden="true">
                    {verdict}
                </span>
            )}
            <span className={`ingredient ingredient-${card.ingredient}`} aria-hidden="true" />
            <strong>{card.name}</strong>
            <small>{meta.label}</small>
            <em>
                {/* Resolved Taste, not the base value: the number on the card is
                    always the number this play deals right now. */}
                <b>◆{preview.damage}</b>
                <span>TASTE</span>
                {card.guard > 0 && (
                    <>
                        <b>◇{card.guard}</b>
                        <span>GUARD</span>
                    </>
                )}
                {reason && <span className="card-reason">{reason}</span>}
                {card.effect === "draw1" && <span className="card-effect">DRAW 1</span>}
                {card.effect === "scorch" && <span className="card-effect">BURNS</span>}
            </em>
        </button>
    );
}

/** A ◇+N in flight from the played card to the Guard total. */
interface GuardFlight {
    id: number;
    amount: number;
    fromX: number;
    fromY: number;
    dx: number;
    dy: number;
}

/** Matches the guard-fly keyframes; the node is removed once it lands. */
const GUARD_FLIGHT_MS = 720;

export default function Hud() {
    const [rulesOpen, setRulesOpen] = useState(false);
    const [leaveOpen, setLeaveOpen] = useState(false);
    const [guardFlights, setGuardFlights] = useState<GuardFlight[]>([]);
    const guardAnchor = useRef<HTMLSpanElement>(null);
    const flightId = useRef(0);
    const state = useStore((value) => value);
    const enemy = enemyById(state.enemyId);
    const incoming = incomingPressure(state);
    const locked = state.combatPhase !== "player";
    const tutorialFlavor =
        state.ftueStep === 1 ? "fresh" : state.ftueStep === 2 ? "heat" : state.ftueStep === 3 ? "rich" : null;
    const tutorialLocksCards = state.ftueStep !== null && tutorialFlavor === null;
    const endTurnLocked = state.combatPhase !== "player" || (state.ftueStep !== null && state.ftueStep !== 4);
    // Track which card instances have already played their deal animation.
    // Playing a card reindexes the hand; without this the whole fan re-flies.
    const settledCardIds = useRef(new Set<string>());
    /** Launch the card's Guard value toward the Guard readout in the status bar. */
    const launchGuard = (amount: number, from: DOMRect) => {
        const target = guardAnchor.current?.getBoundingClientRect();
        if (!target) return;
        const id = ++flightId.current;
        const fromX = from.left + from.width / 2;
        const fromY = from.top + from.height * 0.42;
        // The slot is zero-width until the chip exists; fall back to roughly
        // where the chip will render so the first ◇ of a fight still lands right.
        const toX = target.left + (target.width > 8 ? target.width / 2 : 42);
        const toY = target.top + (target.height > 4 ? target.height / 2 : 8);
        setGuardFlights((flights) => [...flights, { id, amount, fromX, fromY, dx: toX - fromX, dy: toY - fromY }]);
        window.setTimeout(
            () => setGuardFlights((flights) => flights.filter((flight) => flight.id !== id)),
            GUARD_FLIGHT_MS,
        );
    };
    const [, bumpDealFrame] = useState(0);
    useEffect(() => {
        const present = new Set(state.hand.map((card) => card.id));
        for (const id of [...settledCardIds.current]) {
            if (!present.has(id)) settledCardIds.current.delete(id);
        }
        const fresh = state.hand.filter((card) => !settledCardIds.current.has(card.id));
        if (fresh.length === 0) return;
        const timer = window.setTimeout(() => {
            for (const card of state.hand) settledCardIds.current.add(card.id);
            bumpDealFrame((frame) => frame + 1);
        }, 700);
        return () => window.clearTimeout(timer);
    }, [state.hand]);
    return (
        <div
            className="combat-ui pt-safe-top pb-safe-bottom"
            data-phase={state.combatPhase}
            data-ftue-step={state.ftueStep ?? "off"}
            data-guarded={state.guard > 0 ? "true" : "false"}
        >
            <div className="ui-sparkles" aria-hidden="true">
                {SPARKLE_IDS.map((id) => (
                    <i key={id} />
                ))}
            </div>
            <header className="combat-topbar">
                <button
                    className="round-button"
                    type="button"
                    aria-label="Leave run"
                    onClick={() => setLeaveOpen(true)}
                >
                    ×
                </button>
                <div className="enemy-nameplate">
                    <small>
                        COURSE {state.encounter + 1}/6 · {enemy.title}
                    </small>
                    <strong>{enemy.name}</strong>
                    <Meter value={state.enemyHp} max={state.enemyMaxHp} enemy />
                    <span>
                        {state.enemyHp} / {state.enemyMaxHp}
                        {state.enemyGuard > 0 && <b className="enemy-armor"> ⛉ {state.enemyGuard}</b>}
                    </span>
                </div>
                <div className="intent" data-guarded={state.guard > 0 ? "true" : "false"}>
                    <small>BOSS HIT</small>
                    <b>{incoming}</b>
                    {/* What Guard actually buys, before the hit lands — otherwise
                        the player has to do the subtraction across two corners
                        of the screen. */}
                    {state.guard > 0 && <i>◇ {Math.max(0, incoming - state.guard)} LANDS</i>}
                </div>
            </header>

            <RecipeSequence />
            <div className="battle-banner" key={state.banner} role="status">
                <span>{state.banner}</span>
                <button
                    type="button"
                    className="rules-button"
                    aria-label="How to play"
                    onClick={() => setRulesOpen(true)}
                >
                    ?
                </button>
            </div>

            <TutorialCoach />

            <section className="chef-status">
                <div>
                    <b>CHEF BEA</b>
                    <Meter value={state.playerHp} max={state.playerMaxHp} />
                    <span>
                        {state.playerHp}/{state.playerMaxHp}
                        {/* Always rendered, even at 0 Guard, so an incoming ◇ has a
                            stable target to fly at before the chip exists. */}
                        <span className="guard-slot" ref={guardAnchor}>
                            {state.guard > 0 && (
                                <b className="guard-chip" key={state.guard}>
                                    ◇ {state.guard} GUARD
                                </b>
                            )}
                        </span>
                    </span>
                </div>
                <div className="energy" role="status" aria-label={`${state.energy} heat remaining`}>
                    {["heat-one", "heat-two", "heat-three"].map((id, index) => (
                        <i className={index < state.energy ? "lit" : ""} key={id}>
                            ◆
                        </i>
                    ))}
                    <small>HEAT</small>
                </div>
            </section>

            <section className="hand" data-count={state.hand.length} aria-label="Ingredient cards">
                {state.hand.map((card, index) => {
                    const preview = previewPlay(card, state);
                    // Prep techniques never break the recipe, so they count as on-sequence.
                    const matchesStep = preview.matched || preview.isPrep;
                    const tutorialForced = tutorialFlavor !== null && card.flavor === tutorialFlavor;
                    const recommended =
                        !locked &&
                        card.cost <= state.energy &&
                        (tutorialForced || (state.ftueStep === null && matchesStep && card.flavor !== "prep"));
                    const offSequence = !locked && card.cost <= state.energy && state.ftueStep === null && !matchesStep;
                    return (
                        <HandCard
                            card={card}
                            preview={preview}
                            disabled={
                                locked ||
                                card.cost > state.energy ||
                                tutorialLocksCards ||
                                (tutorialFlavor !== null && card.flavor !== tutorialFlavor)
                            }
                            index={index}
                            recommended={recommended}
                            offSequence={offSequence}
                            dealing={!settledCardIds.current.has(card.id)}
                            onGuardGain={launchGuard}
                            key={card.id}
                        />
                    );
                })}
            </section>
            <footer className="turn-controls">
                <span>
                    {state.drawPile.length} DRAW · {state.discardPile.length} DISCARD
                </span>
                <div className="serve-slot">
                    {/* Step 4 is the first moment Serve is tappable, and the coach
                        bar that explains it is docked all the way up by the chef
                        status — so the button gets its own pointer down here. */}
                    {state.ftueStep === 4 && (
                        <span className="serve-pointer" aria-hidden="true">
                            TAP TO SERVE
                        </span>
                    )}
                    <button
                        type="button"
                        disabled={endTurnLocked}
                        onClick={() => {
                            audioManager.play("start");
                            void runtimeServices.haptic("light");
                            combat.endTurn();
                        }}
                    >
                        SERVE TURN →
                    </button>
                </div>
            </footer>
            {rulesOpen && (
                <div className="rules-curtain">
                    <section className="rules-card">
                        <button type="button" className="rules-close" onClick={() => setRulesOpen(false)}>
                            ×
                        </button>
                        <small>HOW TO COOK</small>
                        <h2>Build the recipe. Brace for the reply.</h2>
                        <ol>
                            <li>
                                <b>1</b>
                                <span>
                                    <strong>Match the glowing flavor</strong>Play the highlighted cards in left-to-right
                                    order for +{MATCH_BONUS} Taste. A wrong flavor deals half and sends the pattern back
                                    to the start. WILD matches anything.
                                </span>
                            </li>
                            <li>
                                <b>2</b>
                                <span>
                                    <strong>Chain Perfect Plates</strong>Each finished pattern pays more Taste — a wrong
                                    flavor breaks the chain.
                                </span>
                            </li>
                            <li>
                                <b>3</b>
                                <span>
                                    <strong>Spend 3 Heat, then Serve</strong>Guard blocks the boss hit shown at
                                    top-right.
                                </span>
                            </li>
                        </ol>
                        <div className="rules-legend">
                            <span>
                                <i className="verdict-chip match">▲</i>on flavour
                            </span>
                            <span>
                                <i className="verdict-chip plate">★</i>finishes it
                            </span>
                            <span>
                                <i className="verdict-chip halved">▼</i>half Taste
                            </span>
                        </div>
                        <button type="button" className="primary-cta" onClick={() => setRulesOpen(false)}>
                            <span>GOT IT</span>
                            <b>✓</b>
                        </button>
                    </section>
                </div>
            )}
            {leaveOpen && (
                <div className="rules-curtain">
                    <section className="rules-card">
                        <button type="button" className="rules-close" onClick={() => setLeaveOpen(false)}>
                            ×
                        </button>
                        <small>LEAVE THE KITCHEN?</small>
                        <h2>The service will wait for you.</h2>
                        <p className="leave-copy">
                            Your run is saved right here — pick it up later with RESUME SERVICE from the menu.
                        </p>
                        <button type="button" className="primary-cta" onClick={() => setLeaveOpen(false)}>
                            <span>KEEP COOKING</span>
                            <b>→</b>
                        </button>
                        <button
                            type="button"
                            className="quiet-button"
                            onClick={() => {
                                setLeaveOpen(false);
                                runtimeServices.track("run_left", { encounter: state.encounter, turn: state.turn });
                                combat.leaveRun();
                            }}
                        >
                            SAVE & LEAVE
                        </button>
                    </section>
                </div>
            )}
            {/* ◇+N lifting off the card and dropping into the Guard total. */}
            {guardFlights.map((flight) => (
                <span
                    className="guard-flight"
                    key={flight.id}
                    aria-hidden="true"
                    style={
                        {
                            left: `${flight.fromX}px`,
                            top: `${flight.fromY}px`,
                            "--fly-x": `${flight.dx}px`,
                            "--fly-y": `${flight.dy}px`,
                        } as React.CSSProperties
                    }
                >
                    ◇+{flight.amount}
                </span>
            ))}
            <TutorialOverlay />
            {state.paused && (
                <button
                    type="button"
                    className="pause-curtain"
                    onClick={() => {
                        store.patch({ paused: false });
                        audioManager.setPaused(false);
                        runtimeServices.resume();
                    }}
                >
                    <strong>PAUSED</strong>
                    <span>TAP TO RESUME</span>
                </button>
            )}
        </div>
    );
}
