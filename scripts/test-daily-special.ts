/**
 * Contract test for the daily special streak.
 *
 * The streak is the whole reason the reminder is honest ("your kitchen has
 * restocked"), and every way it can go wrong is silent: a month boundary that
 * breaks a real streak reads to the player as the game forgetting them, and a
 * lapsed player who can never restart reads as the track being closed.
 *
 * Run: node --experimental-strip-types scripts/test-daily-special.ts
 */
import { nextStreakFor, SPECIAL_HP } from "../src/systems/dailySpecialModel.ts";

const failures: string[] = [];
function expect(condition: boolean, message: string): void {
    if (!condition) failures.push(message);
}

// --- a first-ever claim starts the track ----------------------------------
expect(nextStreakFor(null, "2026-08-16", 0) === 1, "a player who has never claimed starts at day 1");

// --- yesterday continues, today is idempotent -----------------------------
expect(nextStreakFor("2026-08-15", "2026-08-16", 3) === 4, "claiming the day after continues the streak");
expect(nextStreakFor("2026-08-16", "2026-08-16", 4) === 4, "re-reading the same day must not advance the streak");

// --- a gap is forgiving, never a lockout ----------------------------------
expect(nextStreakFor("2026-08-13", "2026-08-16", 6) === 1, "a missed day restarts at 1 rather than locking out");
expect(nextStreakFor("2025-01-01", "2026-08-16", 7) === 1, "a long-lapsed player can always re-enter the track");

// --- calendar edges -------------------------------------------------------
expect(nextStreakFor("2026-07-31", "2026-08-01", 2) === 3, "a month boundary must not break a real streak");
expect(nextStreakFor("2025-12-31", "2026-01-01", 5) === 6, "a year boundary must not break a real streak");
expect(nextStreakFor("2028-02-28", "2028-02-29", 1) === 2, "a leap day must not break a real streak");
expect(nextStreakFor("2028-02-29", "2028-03-01", 2) === 3, "the day after a leap day must not break a real streak");

// --- a save from the future cannot mint a streak --------------------------
expect(nextStreakFor("2026-09-01", "2026-08-16", 9) === 1, "a future last-claim day restarts rather than continuing");

// --- the ladder is bounded and monotonic ----------------------------------
expect(SPECIAL_HP.length === 5, `the ladder should be five days, got ${SPECIAL_HP.length}`);
expect(
    SPECIAL_HP.every((value, index) => index === 0 || value > (SPECIAL_HP[index - 1] ?? 0)),
    "each day of the special must be worth more than the last, or the streak buys nothing",
);

if (failures.length > 0) {
    console.error(`Daily special checks failed (${failures.length}):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
} else {
    console.log("Daily special checks passed: streak continuation, forgiveness, calendar edges, ladder shape.");
}
