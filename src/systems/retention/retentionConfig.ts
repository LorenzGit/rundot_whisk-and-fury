import { analytics } from "../analytics/analyticsConfig.ts";
import { cancelLocalNotification, rearmLocalNotification, resolveLaunchIntent } from "../../sdk/runSdk.ts";
import { store } from "../../state/store.ts";
import { RETURN_DELAYS_SECONDS, createReturnReminders } from "./returnReminders.ts";

/**
 * Return reminders for whisk-and-fury.
 *
 * The copy is the product: each body names a specific thing waiting for this
 * player, because "come back and play" is the wording that gets muted — and a
 * muted app is permanently unreachable. The cadence stops at 72h; a fourth ping
 * converts nobody and costs the permission the first three depend on.
 */
export const returnReminders = createReturnReminders({
    idPrefix: "whisk-and-fury",
    reminders: () => [
        {
            id: "d1",
            title: "Your kitchen has restocked",
            body: "Fresh ingredients are in — take another service.",
            delaySeconds: RETURN_DELAYS_SECONDS[0],
        },
        {
            id: "d2",
            title: "Your service is unfinished",
            body: "Your line is exactly where you left it.",
            delaySeconds: RETURN_DELAYS_SECONDS[1],
        },
        {
            id: "d3",
            title: "One more service",
            body: "Your best course is a run away.",
            delaySeconds: RETURN_DELAYS_SECONDS[2],
        },
    ],
    schedule: (input) => rearmLocalNotification(input),
    cancel: (id) => cancelLocalNotification(id),
    resolveLaunch: () => resolveLaunchIntent(),
    // Only an explicit player opt-out gates. The permission below belongs to
    // the RUN app and is shared by every game, so treating it as a gate made
    // "not read yet" indistinguishable from "the player said stop" — which is
    // what kept this cadence dormant.
    isOptedOut: () => store.get().notificationsOptOut,
    permissionHint: () => store.get().notificationsConsent === "granted",
    track: (event, payload) => analytics.event(event, payload),
});

/**
 * Resolve a notification-driven launch and record it. Call once at startup so a
 * return can be attributed to the reminder copy that earned it.
 */
export async function resolveReturnLaunch(): Promise<string | null> {
    const reminderId = await returnReminders.resolveLaunch();
    if (reminderId) analytics.event("retention_notification_return_play", { reminder_id: reminderId });
    return reminderId;
}
