/**
 * Typed RUN boundary. SDK 5.24 initializes on import; this facade waits only
 * for a bounded host handshake and keeps platform calls out of game/UI code.
 *
 * Posture (applies to ALL SDK usage): every RundotGameAPI call can reject,
 * and an unhandled rejection crashes the game — so everything here is
 * try/catch'd, and outside the RUN host (plain `vite dev` in a browser) the
 * app must boot and run anyway.
 */

import type { IdentityChangedEvent, Subscription } from "@series-inc/rundot-game-sdk";
// Type-only import from the package root (the /api entry doesn't re-export it);
// erased at build time, so no extra runtime code is pulled in.
import { HapticFeedbackStyle } from "@series-inc/rundot-game-sdk";
import RundotGameAPI from "@series-inc/rundot-game-sdk/api";
import { audioManager } from "../audio/audioManager.ts";
import { safeAreaOffsetsForFrame } from "./safeArea.ts";

let _ready = false;

export interface RunCapabilities {
    host: boolean;
    mock: boolean;
    storage: boolean;
    analytics: boolean;
    liveops: boolean;
    notifications: boolean;
    haptics: boolean;
    ads: boolean;
    purchases: boolean;
    subscriptions: boolean;
}

const OFFLINE_CAPABILITIES: RunCapabilities = {
    host: false,
    mock: false,
    storage: false,
    analytics: false,
    liveops: false,
    notifications: false,
    haptics: false,
    ads: false,
    purchases: false,
    subscriptions: false,
};

let capabilities: RunCapabilities = OFFLINE_CAPABILITIES;

function sdkNamespace(name: string): boolean {
    return typeof (RundotGameAPI as unknown as Record<string, unknown>)[name] === "object";
}

/**
 * PITFALL: there is NO runtime RundotGameAPI.haptics namespace (the HapticsApi
 * interface in the .d.ts is types-only). Support comes from DeviceInfo, and the
 * trigger lives on the API root. Read LIVE at every call site that acts on it:
 * `enabled` reflects the player's system setting, which can change mid-session,
 * and a cached false at boot must never gate a later action.
 */
function hapticsAvailableNow(): boolean {
    if (!_ready) return false;
    try {
        const device = RundotGameAPI.system.getDevice();
        return device?.haptics?.supported === true && device?.haptics?.enabled === true;
    } catch {
        return false;
    }
}

function environmentFlag(name: "ads" | "purchases" | "subscriptions"): boolean | undefined {
    try {
        const value = RundotGameAPI.system.getEnvironment()?.capabilities?.[name];
        if (typeof value === "boolean") return value;
    } catch {
        // fall through to the import-time cache
    }
    const cached = RundotGameAPI._environmentData?.capabilities?.[name];
    return typeof cached === "boolean" ? cached : undefined;
}

function snapshotCapabilities(): RunCapabilities {
    if (!_ready) return OFFLINE_CAPABILITIES;
    return {
        host: true,
        mock: RundotGameAPI.isMock(),
        storage: sdkNamespace("appStorage"),
        analytics: sdkNamespace("analytics"),
        liveops: sdkNamespace("liveops"),
        notifications: sdkNamespace("notifications"),
        haptics: hapticsAvailableNow(),
        ads: environmentFlag("ads") === true,
        // Shop spending is available whenever the shop namespace is present.
        // Some web hosts omit `capabilities.purchases` even though RB checkout
        // works; treat an explicit false as the only hard no.
        purchases: environmentFlag("purchases") !== false && sdkNamespace("shop"),
        subscriptions: environmentFlag("subscriptions") === true,
    };
}

function shopReady(): boolean {
    return _ready && sdkNamespace("shop");
}

/**
 * Re-read host capabilities. Wired to onAwake (the SDK's "refresh stale data"
 * hook) so a session that started before a grant or attach does not stay
 * frozen on its boot snapshot.
 */
export function refreshRunCapabilities(): Readonly<RunCapabilities> {
    capabilities = snapshotCapabilities();
    return capabilities;
}

export function getRunCapabilities(): Readonly<RunCapabilities> {
    return capabilities;
}

export interface RunSafeArea {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

const ZERO_SAFE_AREA: Readonly<RunSafeArea> = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });

function normalizeSafeArea(area: Partial<RunSafeArea>): RunSafeArea {
    return {
        top: Math.max(0, Number(area.top) || 0),
        right: Math.max(0, Number(area.right) || 0),
        bottom: Math.max(0, Number(area.bottom) || 0),
        left: Math.max(0, Number(area.left) || 0),
    };
}

function readViewDeckSafeArea(): RunSafeArea | null {
    const serialized = document.documentElement.dataset.viewdeckSafeArea;
    if (!serialized) return null;
    try {
        return normalizeSafeArea(JSON.parse(serialized) as Partial<RunSafeArea>);
    } catch {
        return null;
    }
}

export function getRunSafeArea(): Readonly<RunSafeArea> {
    // ViewDeck's device profile wins while a handset is being simulated.
    const viewDeckArea = readViewDeckSafeArea();
    if (viewDeckArea) return viewDeckArea;
    if (!_ready) return ZERO_SAFE_AREA;
    try {
        return normalizeSafeArea(RundotGameAPI.system.getSafeArea());
    } catch {
        return ZERO_SAFE_AREA;
    }
}

/**
 * Publish host insets as CSS variables without coupling UI code to the SDK.
 * ViewDeck drives --viewdeck-safe-area-inset-* (and CSS env()); do not stamp
 * zero host/mock values that would erase those. Outside RUN, leave the
 * stylesheet fallback chain intact.
 */
export function applyRunSafeArea(): Readonly<RunSafeArea> {
    const viewDeckArea = readViewDeckSafeArea();
    const root = document.documentElement;
    if (viewDeckArea) {
        for (const edge of ["top", "right", "bottom", "left"] as const) {
            root.style.removeProperty(`--safe-${edge}`);
        }
        return viewDeckArea;
    }
    const area = getRunSafeArea();
    if (!_ready) return area;
    const frame = document.getElementById("app-frame");
    const local = frame
        ? safeAreaOffsetsForFrame(area, frame.getBoundingClientRect(), {
              width: window.innerWidth,
              height: window.innerHeight,
          })
        : area;
    root.style.setProperty("--safe-top", `${Math.max(0, local.top)}px`);
    root.style.setProperty("--safe-right", `${Math.max(0, local.right)}px`);
    root.style.setProperty("--safe-bottom", `${Math.max(0, local.bottom)}px`);
    root.style.setProperty("--safe-left", `${Math.max(0, local.left)}px`);
    return area;
}

export async function withTimeout<T>(operation: Promise<T>, timeoutMs = 2_000, label = "RUN operation"): Promise<T> {
    let timeoutId = 0;
    const timeout = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    });
    try {
        return await Promise.race([operation, timeout]);
    } finally {
        window.clearTimeout(timeoutId);
    }
}

/** True once the import-initialized SDK reports an attached host/mock. */
export function sdkReady(): boolean {
    return _ready;
}

/**
 * SDK 5.24 initializes on import. In a RUN iframe, allow a short bounded
 * handshake; in ordinary local development return immediately.
 */
export async function initSdk(): Promise<boolean> {
    const embedded = window.parent !== window;
    const deadline = performance.now() + (embedded ? 1_500 : 0);
    do {
        try {
            if (RundotGameAPI.isAvailable() || RundotGameAPI.isMock()) {
                _ready = true;
                break;
            }
        } catch {
            break;
        }
        await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
    } while (performance.now() < deadline);

    capabilities = snapshotCapabilities();
    if (!_ready) {
        console.info("[runSdk] RUN host unavailable; using local non-authoritative fallbacks");
        // Inside an iframe the host is expected — a cold WebView can simply be
        // slower than the bounded handshake. Keep watching so a late attach
        // upgrades this session instead of stranding it offline until relaunch.
        if (embedded) watchForLateHostAttach();
    }
    return _ready;
}

function watchForLateHostAttach(): void {
    const deadline = performance.now() + 30_000;
    const watcher = window.setInterval(() => {
        try {
            if (RundotGameAPI.isAvailable() || RundotGameAPI.isMock()) {
                window.clearInterval(watcher);
                _ready = true;
                capabilities = snapshotCapabilities();
                applyRunSafeArea();
                console.info("[runSdk] RUN host attached after the boot handshake; capabilities refreshed");
                return;
            }
        } catch {
            window.clearInterval(watcher);
            return;
        }
        if (performance.now() >= deadline) window.clearInterval(watcher);
    }, 500);
}

export async function readAppStorage(key: string): Promise<{ ok: boolean; value: string | null }> {
    if (!capabilities.storage) return { ok: false, value: null };
    try {
        const value = await withTimeout(RundotGameAPI.appStorage.getItem(key), 2_000, "appStorage.getItem");
        return { ok: true, value };
    } catch (error) {
        console.warn("[runSdk] appStorage read failed", error);
        return { ok: false, value: null };
    }
}

export async function writeAppStorage(key: string, value: string): Promise<boolean> {
    if (!capabilities.storage) return false;
    try {
        await withTimeout(RundotGameAPI.appStorage.setItem(key, value), 2_000, "appStorage.setItem");
        return true;
    } catch (error) {
        console.warn("[runSdk] appStorage write failed", error);
        return false;
    }
}

export async function requestServerEpochMs(): Promise<number | null> {
    if (!_ready) return null;
    try {
        const result = await withTimeout(RundotGameAPI.requestTimeAsync(), 2_000, "requestTimeAsync");
        return typeof result.serverTime === "number" ? result.serverTime : null;
    } catch (error) {
        console.warn("[runSdk] trusted time unavailable", error);
        return null;
    }
}

export type NotificationPreferenceResult = "enabled" | "disabled" | "unavailable" | "failed";

export async function setNotificationPreference(enabled: boolean): Promise<NotificationPreferenceResult> {
    if (!capabilities.notifications) return "unavailable";
    try {
        await withTimeout(
            RundotGameAPI.notifications.setLocalNotificationsEnabled(enabled),
            4_000,
            "notifications.setLocalNotificationsEnabled",
        );
        const actual = await withTimeout(
            RundotGameAPI.notifications.isLocalNotificationsEnabled(),
            2_000,
            "notifications.isLocalNotificationsEnabled",
        );
        if (actual !== enabled) return "failed";
        return enabled ? "enabled" : "disabled";
    } catch (error) {
        console.warn("[runSdk] notification preference failed", error);
        return "failed";
    }
}

export type HapticStyle = "light" | "medium" | "heavy" | "success" | "warning" | "error";

export async function triggerHaptic(style: HapticStyle): Promise<boolean> {
    if (hapticsAvailableNow()) {
        try {
            const map: Record<HapticStyle, HapticFeedbackStyle> = {
                light: HapticFeedbackStyle.Light,
                medium: HapticFeedbackStyle.Medium,
                heavy: HapticFeedbackStyle.Heavy,
                success: HapticFeedbackStyle.Success,
                warning: HapticFeedbackStyle.Warning,
                error: HapticFeedbackStyle.Error,
            };
            await withTimeout(RundotGameAPI.triggerHapticAsync(map[style]), 1_000, "triggerHapticAsync");
            return true;
        } catch {
            // fall through to the web-vibration fallback
        }
    }
    // Outside a haptics-capable host: navigator.vibrate covers Android web;
    // iOS Safari has no vibration API, so this is a silent no-op there.
    try {
        const nav = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
        if (typeof nav.vibrate === "function") {
            const patterns: Record<HapticStyle, number | number[]> = {
                light: 10,
                medium: 20,
                heavy: 40,
                success: [15, 40, 15],
                warning: [25, 40, 25],
                error: [35, 50, 35],
            };
            return nav.vibrate(patterns[style]);
        }
    } catch {
        // no vibration surface — fine
    }
    return false;
}

export interface RunLiveOpsSnapshot {
    values: Record<string, unknown>;
    configVersion: string;
    nextChangeAt: number | null;
    activeOverrideIds: string[];
}

export async function fetchLiveOps(): Promise<RunLiveOpsSnapshot | null> {
    if (!capabilities.liveops) return null;
    try {
        const result = await withTimeout(RundotGameAPI.liveops.getConfigAsync(), 3_000, "liveops.getConfigAsync");
        return {
            values: result.values,
            configVersion: result.configVersion,
            nextChangeAt: result.nextChangeAt,
            activeOverrideIds: result.activeOverrideIds,
        };
    } catch (error) {
        console.warn("[runSdk] LiveOps unavailable; defaults retained", error);
        return null;
    }
}

export async function recordAnalytics(eventName: string, payload: Record<string, unknown> = {}): Promise<boolean> {
    if (!capabilities.analytics) return false;
    try {
        await withTimeout(
            RundotGameAPI.analytics.recordCustomEvent(eventName, payload),
            1_500,
            "analytics.recordCustomEvent",
        );
        return true;
    } catch {
        return false;
    }
}

export async function recordFunnelStep(step: number, name: string, funnel: string, funnelOrder = 0): Promise<boolean> {
    if (!capabilities.analytics) return false;
    try {
        await withTimeout(
            RundotGameAPI.analytics.trackFunnelStep(step, name, funnel, funnelOrder),
            1_500,
            "analytics.trackFunnelStep",
        );
        return true;
    } catch {
        return false;
    }
}

export async function rearmLocalNotification(input: {
    id: string;
    title: string;
    body: string;
    delaySeconds: number;
}): Promise<boolean> {
    if (!capabilities.notifications) return false;
    try {
        await withTimeout(RundotGameAPI.notifications.cancelNotification(input.id), 1_500, "notifications.cancel");
        const result = await withTimeout(
            RundotGameAPI.notifications.submitMessageAsync({
                channels: ["local"],
                title: input.title,
                body: input.body,
                delaySeconds: Math.max(60, input.delaySeconds),
                notificationId: input.id,
                collapseKey: input.id,
            }),
            3_000,
            "notifications.submitMessage",
        );
        return result.results.some((channel) => channel.channel === "local" && channel.status === "scheduled");
    } catch (error) {
        console.warn("[runSdk] notification re-arm failed", error);
        return false;
    }
}

export type VerifiedActionResult = "verified" | "unavailable" | "cancelled" | "failed";

let hostOverlayCount = 0;

export function hostOverlayInFlight(): boolean {
    return hostOverlayCount > 0;
}

export async function withHostOverlay<T>(run: () => Promise<T>): Promise<T> {
    hostOverlayCount += 1;
    if (hostOverlayCount === 1) audioManager.setHostOverlayVisible(true);
    try {
        return await run();
    } finally {
        hostOverlayCount -= 1;
        if (hostOverlayCount === 0) audioManager.setHostOverlayVisible(false);
    }
}

/**
 * Budget for an ad-readiness probe.
 *
 * On web the host answers this from the ad SDK, which on a cold first call
 * waits out its consent manager (~5s) and then loads the ad script (~5s). The
 * old 2s budget expired during that first probe and reported "no ad available"
 * on a host that was merely still warming up — while every later probe, served
 * from the host's cache, returned instantly. That is what made rewarded ads
 * work only sometimes.
 */
const AD_READY_TIMEOUT_MS = 12_000;

export async function showVerifiedRewardedAd(id: string, name: string): Promise<VerifiedActionResult> {
    // Offered vs complete: one without the other cannot separate a weak reward
    // from missing inventory. Emitted here so every placement is covered once.
    void recordAnalytics("rewarded_ad_offered", { ad_display_id: id });
    if (!capabilities.ads) return "unavailable";
    try {
        const ready = await withTimeout(RundotGameAPI.ads.isRewardedAdReadyAsync(), AD_READY_TIMEOUT_MS, "ads.ready");
        if (!ready) return "unavailable";
        const completed = await withHostOverlay(() =>
            RundotGameAPI.ads.showRewardedAdAsync({ adDisplayId: id, adDisplayName: name }),
        );
        // Only a confirmed completion earned the reward — `cancelled` covers a
        // video the player closed early, which must not count as a watch.
        if (completed === true) void recordAnalytics("rewarded_ad_complete", { ad_display_id: id });
        return completed === true ? "verified" : "cancelled";
    } catch {
        return "failed";
    }
}

export async function showVerifiedInterstitialAd(id: string, name: string): Promise<VerifiedActionResult> {
    // Interstitial load is the number to weigh against D1 when tuning ads.
    void recordAnalytics("interstitial_shown", { ad_display_id: id });
    if (!capabilities.ads) return "unavailable";
    try {
        const ready = await withTimeout(
            RundotGameAPI.ads.isInterstitialAdReadyAsync(),
            AD_READY_TIMEOUT_MS,
            "ads.interstitial.ready",
        );
        if (!ready) return "unavailable";
        const displayed = await withHostOverlay(() =>
            RundotGameAPI.ads.showInterstitialAd({ adDisplayId: id, adDisplayName: name }),
        );
        return displayed === true ? "verified" : "unavailable";
    } catch {
        return "failed";
    }
}

const CANCELLED_SHOP_CODES = new Set(["USER_CANCELLED", "user_cancelled", "cancelled"]);
const MISSING_SHOP_CODES = new Set(["not-found", "config-not-found", "item-not-available", "collection-not-found"]);

function shopErrorCode(error: unknown): string {
    const code = (error as { code?: unknown } | null)?.code;
    return typeof code === "string" ? code : "";
}

export async function purchaseVerifiedShopItem(itemId: string, idempotencyKey: string): Promise<VerifiedActionResult> {
    if (!shopReady()) return "unavailable";
    try {
        // Store conversion needs the request AND the verdict: a checkout that is
        // started and never resolves is a broken pipeline, while one that resolves
        // unverified is a pricing or intent problem, and only the pair separates
        // them. Emitted through this module's own recorder — importing the
        // analytics config here would close a cycle.
        void recordAnalytics("checkout_started", { item_id: itemId });
        const result = await withHostOverlay(() => RundotGameAPI.shop.purchase(itemId, idempotencyKey));
        void recordAnalytics("checkout_result", { item_id: itemId, success: result?.success === true });
        // `success` only reports that the host accepted the request. Replaying
        // an idempotency key returns the ORIGINAL order verbatim, so an order
        // still in "pending_payment" also arrives as "success: true" — granting
        // on that would hand over an unpaid purchase.
        return result.success === true && result.order?.status === "fulfilled" ? "verified" : "failed";
    } catch (error) {
        const code = shopErrorCode(error);
        if (CANCELLED_SHOP_CODES.has(code)) return "cancelled";
        if (MISSING_SHOP_CODES.has(code)) return "unavailable";
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (message.includes("cancel")) return "cancelled";
        if (message.includes("not found") || message.includes("not available")) return "unavailable";
        return "failed";
    }
}

function formatShopPrice(price: { type?: string; value?: string } | undefined): string | null {
    if (!price || price.value == null || price.value === "") return null;
    if (price.type === "bucks" || price.type === "run_bits") return `${price.value} RB`;
    return `${price.value} ${String(price.type ?? "").toUpperCase()}`.trim();
}

export async function getVerifiedShopPrice(itemId: string): Promise<string | null> {
    if (!shopReady()) return null;
    try {
        const item = await withTimeout(RundotGameAPI.shop.getItemDetail(itemId), 4_000, "shop.getItemDetail");
        const resolved = item.resolvedPrice?.finalPrice ?? item.price;
        return formatShopPrice(resolved);
    } catch {
        try {
            const catalog = await withTimeout(RundotGameAPI.shop.getCatalog(), 4_000, "shop.getCatalog");
            const item = catalog.items.find((candidate) => candidate.itemId === itemId && candidate.active);
            return formatShopPrice(item?.resolvedPrice.finalPrice ?? item?.price);
        } catch {
            return null;
        }
    }
}

export async function hasVerifiedEntitlement(entitlementId: string): Promise<boolean> {
    if (!_ready || !sdkNamespace("entitlements")) return false;
    try {
        const quantity = await withTimeout(
            RundotGameAPI.entitlements.getQuantity(entitlementId),
            4_000,
            "entitlements.getQuantity",
        );
        return quantity > 0;
    } catch {
        return false;
    }
}

/** Continue Android back navigation once the template's own stack is empty. */
export async function requestHostExit(reason = "template-root-back"): Promise<boolean> {
    if (!_ready) return false;
    try {
        return await withTimeout(RundotGameAPI.requestPopOrQuit({ reason }), 4_000, "requestPopOrQuit");
    } catch (error) {
        console.warn("[runSdk] host exit request failed", error);
        return false;
    }
}

/**
 * Lifecycle callbacks are `() => void` per the SDK types. Async handlers are
 * fine to pass: a Promise-returning function is assignable where a void
 * return is expected (the SDK just won't await it).
 */
export type LifecycleCallback = () => void;

/** All seven hooks are optional. See registerLifecycles for what each means. */
export interface LifecycleConfig {
    onPause?: LifecycleCallback;
    onResume?: LifecycleCallback;
    onSleep?: LifecycleCallback;
    onAwake?: LifecycleCallback;
    onQuit?: LifecycleCallback;
    onBackButton?: LifecycleCallback;
    onIdentityChanged?: (event: IdentityChangedEvent) => void;
}

/**
 * Register host lifecycle callbacks. All seven hooks are optional; each SDK
 * hook returns an { unsubscribe() } handle, collected so hot-reload / scene
 * swaps can detach cleanly.
 *
 * Hook meanings (SDK docs):
 *   onPause/onResume — host overlay or brief focus loss: pause/resume loops + audio
 *   onSleep/onAwake  — long background suspend: persist progress / refresh stale data
 *   onQuit           — host teardown: last-chance flush (may NOT fire on hard close)
 *   onBackButton     — Android back button (no-op elsewhere); without a handler the
 *                      host quits by default — call RundotGameAPI.requestPopOrQuit()
 *                      yourself when your in-game back navigation is exhausted
 */
export function registerLifecycles({
    onPause,
    onResume,
    onSleep,
    onAwake,
    onQuit,
    onBackButton,
    onIdentityChanged,
}: LifecycleConfig = {}): { unsubscribeAll(): void } {
    const subs: Subscription[] = [];
    const hook = (name: keyof LifecycleConfig, cb: LifecycleCallback | undefined) => {
        if (!cb) return;
        try {
            subs.push(RundotGameAPI.lifecycles[name](cb));
        } catch (err) {
            console.warn(`[runSdk] lifecycles.${name} registration failed`, err);
        }
    };
    hook("onPause", onPause);
    hook("onResume", onResume);
    hook("onSleep", onSleep);
    hook("onAwake", onAwake);
    hook("onQuit", onQuit);
    hook("onBackButton", onBackButton);
    if (onIdentityChanged) {
        try {
            subs.push(RundotGameAPI.lifecycles.onIdentityChanged(onIdentityChanged));
        } catch (error) {
            console.warn("[runSdk] lifecycles.onIdentityChanged registration failed", error);
        }
    }
    return {
        unsubscribeAll() {
            for (const s of subs) {
                try {
                    s?.unsubscribe?.();
                } catch {
                    /* already gone */
                }
            }
            subs.length = 0;
        },
    };
}

// ---------------------------------------------------------------------------
// Return-reminder support, kept beside the other notification calls so the
// retention module never talks to RundotGameAPI directly.
// ---------------------------------------------------------------------------

/** Cancel a scheduled reminder once the thing it promised has been done. */
export async function cancelLocalNotification(id: string): Promise<void> {
    if (!capabilities.notifications) return;
    try {
        await withTimeout(RundotGameAPI.notifications.cancelNotification(id), 1_500, "notifications.cancel");
    } catch {
        // a reminder that will not cancel must not break the beat that
        // completed the task it was promising
    }
}

/**
 * How this session was launched. `timed_out` counts as unknown rather than
 * organic, so notification attribution never over-counts cold starts.
 */
export async function resolveLaunchIntent(): Promise<{ kind: string; params: Record<string, string> } | null> {
    try {
        const intent = await withTimeout(
            RundotGameAPI.app.resolveLaunchIntent({ maxWaitMs: 800 }),
            1_500,
            "app.resolveLaunchIntent",
        );
        if (!intent || intent.kind === "timed_out") return null;
        return { kind: intent.kind, params: intent.params ?? {} };
    } catch {
        return null;
    }
}
