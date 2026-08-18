/**
 * The daily special — the reason the return reminder is allowed to exist.
 *
 * The 24h reminder promises "your kitchen has restocked, fresh ingredients are
 * in". Until this module it promised nothing: there was no restock, so the
 * ping named a thing that did not exist, which is the fastest way to teach a
 * player to mute a game.
 *
 * WHISK & FURY has no soft currency — `cookbookStars` is a record of services
 * completed, and minting those would corrupt a progress stat and the deck
 * unlocks that read it. So the reward is the thing a roguelike run actually
 * wants: the first service of each day starts from a stocked kitchen.
 *
 * Rules that matter:
 *   1. TRUSTED CLOCK ONLY (`canUseTimeGates`), so a device clock the player
 *      can wind forward cannot mint a stronger run every minute.
 *   2. CLAIMED, THEN ARMED, THEN CONSUMED. The claim is a visible tap on the
 *      menu — where the notification deep-links — and it is spent by the next
 *      service rather than every service that day.
 *   3. FORGIVING. A missed day restarts the ladder, it never closes it.
 */
import { store } from "../state/store.ts";
import { saveSystem } from "./save.ts";
import { canUseTimeGates, localDayKey, serverNow } from "./serverTime.ts";
import { runtimeServices } from "./runtimeServices.ts";
import { guardForStreak, hpForStreak, nextStreakFor } from "./dailySpecialModel.ts";

export interface SpecialView {
    /** Null until the trusted clock has answered; the UI stays quiet. */
    day: string | null;
    claimable: boolean;
    /** The streak this claim WOULD set — what the UI should preview. */
    nextStreak: number;
    hp: number;
    guard: number;
    /** Claimed today and still waiting to be spent on a service. */
    armed: boolean;
}

/** What the special looks like right now. Safe to call on every render. */
export function specialView(): SpecialView {
    const state = store.get();
    if (!canUseTimeGates()) {
        return { day: null, claimable: false, nextStreak: 1, hp: hpForStreak(1), guard: 0, armed: false };
    }
    const day = localDayKey(serverNow());
    const claimed = state.specialDay === day;
    const nextStreak = nextStreakFor(state.specialDay, day, state.specialStreak);
    return {
        day,
        claimable: !claimed,
        nextStreak,
        hp: hpForStreak(nextStreak),
        guard: guardForStreak(nextStreak),
        armed: state.specialArmed,
    };
}

export interface SpecialClaim {
    ok: boolean;
    hp: number;
    guard: number;
    streak: number;
}

/** Claim today's special and arm it for the next service. */
export function claimSpecial(): SpecialClaim {
    const view = specialView();
    if (!view.day || !view.claimable) {
        return { ok: false, hp: 0, guard: 0, streak: store.get().specialStreak };
    }
    store.patch({ specialDay: view.day, specialStreak: view.nextStreak, specialArmed: true });
    void saveSystem.flush();
    runtimeServices.track("daily_special_claimed", {
        streak: view.nextStreak,
        hp: view.hp,
        guard: view.guard,
    });
    // The 24h reminder promised exactly this. Now that it is in hand, cancel it
    // rather than pinging the player about ingredients already on the bench.
    void cancelPrimaryReminder();
    return { ok: true, hp: view.hp, guard: view.guard, streak: view.nextStreak };
}

/**
 * Spend an armed special. Returns the bonus to fold into the opening state, and
 * `{0,0}` when nothing is armed — combat calls this unconditionally.
 */
export function consumeSpecial(): { hp: number; guard: number } {
    const state = store.get();
    if (!state.specialArmed) return { hp: 0, guard: 0 };
    const streak = Math.max(state.specialStreak, 1);
    store.patch({ specialArmed: false });
    runtimeServices.track("daily_special_spent", { streak });
    return { hp: hpForStreak(streak), guard: guardForStreak(streak) };
}

/**
 * Lazy import: retentionConfig reaches the store and analytics, and a static
 * cycle would drag the notification stack into the menu's first frame.
 */
async function cancelPrimaryReminder(): Promise<void> {
    const { returnReminders } = await import("./retention/retentionConfig.ts");
    await returnReminders.cancel("d1");
}
