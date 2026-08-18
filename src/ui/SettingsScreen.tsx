import { useState } from "react";
import { audioManager } from "../audio/audioManager.ts";
import { setNotificationPreference } from "../sdk/runSdk.ts";
import { LOCALES, selectLocale, t } from "../systems/localization.ts";
import { saveSystem } from "../systems/save.ts";
import { returnReminders } from "../systems/retention/retentionConfig.ts";
import { runtimeServices } from "../systems/runtimeServices.ts";
import { store, useStore, type AppState } from "../state/store.ts";
import MenuScreenLayout from "./MenuScreenLayout.tsx";

function persist(patch: Partial<AppState>, cue = true): void {
    store.patch(patch);
    if (cue) audioManager.play("tap");
    void saveSystem.flush();
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange(value: boolean): void }) {
    return (
        <label className="setting-row">
            <span>{label}</span>
            <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        </label>
    );
}

export default function SettingsScreen() {
    const state = useStore((value) => value);
    const [notificationBusy, setNotificationBusy] = useState(false);

    const notificationToggle = async (enabled: boolean) => {
        await audioManager.unlock();
        setNotificationBusy(true);
        if (!enabled) {
            // Opt out of THIS game only. The host preference belongs to the RUN
            // app and every game shares it, so revoking it here would silence
            // reminders in all of them.
            persist({ notificationsOptOut: true, notificationsEnabled: false });
            await returnReminders.cancelAll();
            setNotificationBusy(false);
            return;
        }
        const result = await setNotificationPreference(enabled);
        setNotificationBusy(false);
        if (result === "enabled") {
            persist({ notificationsEnabled: true, notificationsConsent: "granted" });
            runtimeServices.rearmNotifications();
        } else if (result === "disabled") persist({ notificationsEnabled: false, notificationsConsent: "denied" });
        else {
            audioManager.play("error");
            store.patch({ toast: result === "unavailable" ? t("SettingsUnavailable") : "NOTIFICATION REQUEST FAILED" });
        }
    };

    const setLocale = (locale: string) => {
        audioManager.play("tap");
        selectLocale(locale);
    };

    const testHaptic = async () => {
        await audioManager.unlock();
        audioManager.play("reward");
        const sent = await runtimeServices.haptic("success");
        store.patch({ toast: sent ? "HAPTIC SENT" : "HAPTICS NEED A SUPPORTED DEVICE" });
    };

    return (
        <MenuScreenLayout title={t("MenuSettings")} kicker="COMFORT + ACCESS">
            <div className="settings-list">
                <Toggle
                    label={t("SettingsMusic")}
                    checked={state.musicEnabled}
                    onChange={(value) => persist({ musicEnabled: value })}
                />
                <label className="setting-slider">
                    <span>{t("SettingsMusicVolume")}</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={state.musicVolume}
                        onChange={(event) => persist({ musicVolume: Number(event.target.value) }, false)}
                    />
                </label>
                <Toggle
                    label={t("SettingsSfx")}
                    checked={state.sfxEnabled}
                    onChange={(value) => persist({ sfxEnabled: value })}
                />
                <label className="setting-slider">
                    <span>{t("SettingsSfxVolume")}</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={state.sfxVolume}
                        onChange={(event) => persist({ sfxVolume: Number(event.target.value) }, false)}
                    />
                </label>
                <div className="setting-row">
                    <span>{t("SettingsHaptics")}</span>
                    <div className="setting-actions">
                        <input
                            aria-label={t("SettingsHaptics")}
                            type="checkbox"
                            checked={state.hapticsEnabled}
                            onChange={(event) => persist({ hapticsEnabled: event.target.checked })}
                        />
                        <button type="button" disabled={!state.hapticsEnabled} onClick={() => void testHaptic()}>
                            TEST
                        </button>
                    </div>
                </div>
                <Toggle
                    label={t("SettingsReducedMotion")}
                    checked={state.reducedMotion}
                    onChange={(value) => {
                        document.documentElement.dataset.reducedMotion = String(value);
                        persist({ reducedMotion: value });
                    }}
                />
                <label className="setting-row">
                    <span>{t("SettingsNotifications")}</span>
                    <button
                        type="button"
                        disabled={notificationBusy}
                        onClick={() => void notificationToggle(!state.notificationsEnabled)}
                    >
                        {notificationBusy
                            ? "..."
                            : state.notificationsEnabled
                              ? "ON"
                              : state.notificationsConsent === "denied"
                                ? "OFF"
                                : "ASK"}
                    </button>
                </label>
                <label className="setting-row">
                    <span>{t("SettingsLanguage")}</span>
                    <select value={state.locale} onChange={(event) => setLocale(event.target.value)}>
                        {LOCALES.map((locale) => (
                            <option key={locale.id} value={locale.id}>
                                {locale.label}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="setting-row">
                    <span>{t("SettingsQuality")}</span>
                    <div className="segmented">
                        <button
                            type="button"
                            className={state.quality === "low" ? "active" : ""}
                            onClick={() => persist({ quality: "low" })}
                        >
                            {t("SettingsLow")}
                        </button>
                        <button
                            type="button"
                            className={state.quality === "high" ? "active" : ""}
                            onClick={() => persist({ quality: "high" })}
                        >
                            {t("SettingsHigh")}
                        </button>
                    </div>
                </div>
            </div>
            <p className="safety-note">
                Notification consent changes only after the RUN host confirms the requested state.
            </p>
        </MenuScreenLayout>
    );
}
