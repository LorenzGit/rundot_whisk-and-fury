/**
 * The daily special ladder and streak math, with no game imports.
 *
 * Kept pure and dependency-free so the parts that are easy to get wrong and
 * silent when wrong — calendar edges, what counts as consecutive, how
 * forgiving a lapse is — can be tested without a clock, a store, or the asset
 * graph. See scripts/test-daily-special.ts.
 */

/**
 * Bonus max HP for the first service of the day, by streak day; it holds at
 * the last entry. WHISK & FURY has no currency to hand out, so the reward is
 * the thing a roguelike run actually wants: a kitchen that starts stocked.
 *
 * Five days rather than seven because a run is long — a ladder the player
 * cannot see the top of from day one is a ladder they do not start climbing.
 */
export const SPECIAL_HP = [6, 10, 14, 18, 24] as const;

/** Starting guard rides along from day two, once the ladder is worth chasing. */
export const GUARD_FROM_STREAK = 2;
export const SPECIAL_GUARD = 4;

export function hpForStreak(streak: number): number {
    const index = Math.min(Math.max(streak, 1), SPECIAL_HP.length) - 1;
    return SPECIAL_HP[index] ?? SPECIAL_HP[0];
}

export function guardForStreak(streak: number): number {
    return streak >= GUARD_FROM_STREAK ? SPECIAL_GUARD : 0;
}

/** Yesterday's key for `day`, in the same shape `localDayKey` produces. */
export function previousDayKey(day: string): string {
    const [year, month, date] = day.split("-").map(Number);
    // Date normalizes an out-of-range day, so month, year and leap-day
    // boundaries all fall out of this without special cases.
    const previous = new Date(year ?? 1970, (month ?? 1) - 1, (date ?? 1) - 1);
    const y = previous.getFullYear();
    const m = String(previous.getMonth() + 1).padStart(2, "0");
    const d = String(previous.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/**
 * The streak a claim on `today` would set.
 *
 * Forgiving: a missed day drops back to 1, it never locks the special away. A
 * `lastDay` in the future (a wound-forward device clock, a save restored from
 * another device) also restarts rather than continuing.
 */
export function nextStreakFor(lastDay: string | null, today: string, currentStreak: number): number {
    if (lastDay === today) return Math.max(currentStreak, 1);
    if (lastDay === previousDayKey(today)) return Math.max(currentStreak, 0) + 1;
    return 1;
}
