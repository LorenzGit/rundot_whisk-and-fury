import packageJson from "../../package.json";
import { isConfiguredPlatformId, PLATFORM_IDS } from "../config/platform.ts";
import {
    fetchLiveOps,
    getRunCapabilities,
    getVerifiedShopPrice,
    type HapticStyle,
    hasVerifiedEntitlement,
    purchaseVerifiedShopItem,
    rearmLocalNotification,
    recordAnalytics,
    recordFunnelStep,
    showVerifiedRewardedAd,
    triggerHaptic,
    type VerifiedActionResult,
} from "../sdk/runSdk.ts";
import { store } from "../state/store.ts";
import { t } from "./localization.ts";
import { refreshServerTime } from "./serverTime.ts";

export interface RuntimeConfig {
    notificationDelaySeconds: number;
    adsEnabled: boolean;
    shopEnabled: boolean;
}

const idsReady =
    isConfiguredPlatformId(PLATFORM_IDS.chefsTableItem) &&
    isConfiguredPlatformId(PLATFORM_IDS.chefsTableEntitlement) &&
    isConfiguredPlatformId(PLATFORM_IDS.secretMenuItem) &&
    isConfiguredPlatformId(PLATFORM_IDS.secretMenuEntitlement);

const DEFAULTS: Readonly<RuntimeConfig> = Object.freeze({
    notificationDelaySeconds: 86_400,
    adsEnabled: false,
    // IDs are authored and the Pantry is already player-facing, so the shop
    // stays on unless LiveOps explicitly turns it off. Ads remain opt-in.
    shopEnabled: idsReady,
});

let config: RuntimeConfig = { ...DEFAULTS };
let nextRefreshTimer = 0;

function clearScheduledRefresh(): void {
    if (!nextRefreshTimer) return;
    window.clearTimeout(nextRefreshTimer);
    nextRefreshTimer = 0;
}

function normalize(values: Record<string, unknown>): RuntimeConfig {
    const root =
        values.runtime && typeof values.runtime === "object" ? (values.runtime as Record<string, unknown>) : values;
    const monetization =
        root.monetization && typeof root.monetization === "object"
            ? (root.monetization as Record<string, unknown>)
            : {};
    const delay = Number(root.notificationDelaySeconds);
    return {
        notificationDelaySeconds: Number.isFinite(delay) ? Math.max(3_600, Math.min(delay, 604_800)) : 86_400,
        adsEnabled: monetization.adsEnabled === true && isConfiguredPlatformId(PLATFORM_IDS.rewardedResultsBonus),
        shopEnabled: monetization.shopEnabled !== false && idsReady,
    };
}

async function refreshLiveOps(): Promise<void> {
    clearScheduledRefresh();
    const snapshot = await fetchLiveOps();
    if (!snapshot) {
        // KEEP the live config on a failed fetch: resetting to DEFAULTS here
        // yanked an enabled shop/ads surface for the rest of the session on a
        // single resume-time network blip. Retry only where a host could
        // actually answer — without the capability this null is permanent.
        store.patch({ runtimeReady: true });
        if (getRunCapabilities().liveops) {
            nextRefreshTimer = window.setTimeout(() => startRefreshCycle(), 60_000);
        }
        return;
    }
    config = normalize(snapshot.values);
    store.patch({ runtimeReady: true, runtimeConfigVersion: snapshot.configVersion });
    if (snapshot.nextChangeAt) {
        const delay = Math.max(1_000, Math.min(snapshot.nextChangeAt - Date.now() + 500, 2_147_000_000));
        nextRefreshTimer = window.setTimeout(() => startRefreshCycle(), delay);
    }
}

async function refreshTime(): Promise<void> {
    store.patch({ trustedTimeReady: await refreshServerTime() });
}

async function rearmNotifications(): Promise<void> {
    const state = store.get();
    if (!state.notificationsEnabled || state.notificationsConsent !== "granted") return;
    await rearmLocalNotification({
        id: "whisk-and-fury-return-reminder",
        title: t("NotificationTitle"),
        body: t("NotificationReEngagementBody"),
        delaySeconds: config.notificationDelaySeconds,
    });
}

async function refreshRuntime(): Promise<void> {
    await Promise.allSettled([refreshTime(), refreshLiveOps()]);
    await syncMonetization();
    await rearmNotifications();
}

async function syncMonetization(): Promise<void> {
    if (!getRunCapabilities().host) {
        store.patch({
            chefsTableOwned: false,
            secretMenuOwned: false,
            shopPriceLabel: null,
            secretMenuPriceLabel: null,
            monetizationLoading: false,
        });
        return;
    }
    store.patch({ monetizationLoading: true });
    const [owned, price, secretOwned, secretPrice] = await Promise.all([
        hasVerifiedEntitlement(PLATFORM_IDS.chefsTableEntitlement),
        getVerifiedShopPrice(PLATFORM_IDS.chefsTableItem),
        hasVerifiedEntitlement(PLATFORM_IDS.secretMenuEntitlement),
        getVerifiedShopPrice(PLATFORM_IDS.secretMenuItem),
    ]);
    store.patch({
        chefsTableOwned: owned,
        secretMenuOwned: secretOwned,
        shopPriceLabel: price,
        secretMenuPriceLabel: secretPrice,
        monetizationLoading: false,
    });
}

function startRefreshCycle(): void {
    void refreshRuntime().catch((error) => {
        console.warn("[runtime] background refresh failed", error);
    });
}

export const runtimeServices = {
    get config(): Readonly<RuntimeConfig> {
        return config;
    },
    bootstrap(): void {
        startRefreshCycle();
        this.track("game_boot", { version: packageJson.version, host: getRunCapabilities().host });
        // Canonical boot beat. game_boot is this game's own name and only
        // game_opened reaches RUN's core-loop query.
        this.track("game_opened", { version: packageJson.version, host: getRunCapabilities().host });
    },
    resume(): void {
        startRefreshCycle();
    },
    rearmNotifications(): void {
        void rearmNotifications().catch((error) => {
            console.warn("[runtime] notification refresh failed", error);
        });
    },
    track(eventName: string, payload: Record<string, unknown> = {}): void {
        void recordAnalytics(eventName, { ...payload, build_version: packageJson.version });
    },
    funnel(step: number, name: string, funnel: string, funnelOrder = 0): void {
        void recordFunnelStep(step, name, funnel, funnelOrder);
    },
    async haptic(style: HapticStyle): Promise<boolean> {
        return store.get().hapticsEnabled ? triggerHaptic(style) : false;
    },
    async watchResultsAd(): Promise<VerifiedActionResult> {
        if (store.get().totalPlays < 1) return "unavailable";
        if (!config.adsEnabled || !isConfiguredPlatformId(PLATFORM_IDS.rewardedResultsBonus)) return "unavailable";
        return showVerifiedRewardedAd(PLATFORM_IDS.rewardedResultsBonus, "Results Bonus");
    },
    async purchaseChefsTable(idempotencyKey: string): Promise<VerifiedActionResult> {
        if (!config.shopEnabled || !isConfiguredPlatformId(PLATFORM_IDS.chefsTableItem)) return "unavailable";
        const result = await purchaseVerifiedShopItem(PLATFORM_IDS.chefsTableItem, idempotencyKey);
        if (result === "verified") await syncMonetization();
        return result;
    },
    async purchaseSecretMenu(idempotencyKey: string): Promise<VerifiedActionResult> {
        if (!config.shopEnabled || !isConfiguredPlatformId(PLATFORM_IDS.secretMenuItem)) return "unavailable";
        const result = await purchaseVerifiedShopItem(PLATFORM_IDS.secretMenuItem, idempotencyKey);
        if (result === "verified") await syncMonetization();
        return result;
    },
    syncMonetization,
};
