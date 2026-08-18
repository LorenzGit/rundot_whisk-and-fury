import { audioManager } from "../audio/audioManager.ts";
import { combat, enemyById, FLAVOR_META } from "../game/combat.ts";
import { useStore } from "../state/store.ts";

/** Post-reward branch: pick which recipe monster to face next. */
export default function CourseScreen() {
    const choices = useStore((state) => state.courseChoices);
    const encounter = useStore((state) => state.encounter);
    const defeated = useStore((state) => state.defeatedEnemies);
    return (
        <main className="course-screen pt-safe-top pb-safe-bottom">
            <p className="title-kicker">COURSE {encounter + 2} OF 6</p>
            <h2>Choose the next course.</h2>
            <p>Two dishes are fighting back. Bea only has time for one — pick the recipe you'd rather cook.</p>
            <div className="course-options">
                {choices.map((enemyId) => {
                    const enemy = enemyById(enemyId);
                    const known = defeated.includes(enemyId);
                    return (
                        <button
                            type="button"
                            key={enemyId}
                            onClick={() => {
                                audioManager.play("start");
                                combat.chooseCourse(enemyId);
                            }}
                        >
                            <span
                                className="course-portrait"
                                style={
                                    {
                                        backgroundImage: `url(${enemy.art})`,
                                        "--frame-aspect": enemy.frameAspect,
                                    } as React.CSSProperties
                                }
                            />
                            <small>{enemy.title}</small>
                            <strong>{enemy.name}</strong>
                            <span className="course-stats">{enemy.maxHp} HP</span>
                            {/* The recipe is the whole reason to prefer one course
                                over the other, so it carries the same letters as
                                the combat ribbon — bare colour dots read as
                                decoration and can't be matched to a hand. */}
                            <span className="course-recipe">
                                <small>ITS RECIPE</small>
                                <span
                                    className="mini-sequence"
                                    role="img"
                                    aria-label={`Recipe: ${enemy.sequence.map((flavor) => FLAVOR_META[flavor].label).join(", then ")}`}
                                >
                                    {enemy.sequence.map((flavor, index) => (
                                        // biome-ignore lint/suspicious/noArrayIndexKey: positional pips; flavors may repeat
                                        <i style={{ background: FLAVOR_META[flavor].color }} key={index}>
                                            {FLAVOR_META[flavor].label.slice(0, 1)}
                                        </i>
                                    ))}
                                </span>
                            </span>
                            {enemy.trait && <em>{enemy.trait}</em>}
                            {known && <b className="course-known">✓ PLATED BEFORE</b>}
                        </button>
                    );
                })}
            </div>
        </main>
    );
}
