/**
 * Screen router. One phase visible at a time; the 'playing' phase stacks the
 * React HUD above the Pixi canvas.
 *
 * #app-frame (styled in styles/app.css) is the device frame: a centered
 * portrait column that fills phones edge-to-edge and sits over a full-bleed
 * desktop backdrop. Everything interactive — canvas and DOM UI — lives inside
 * the frame, so safe areas and input never leak into decorative side art.
 */
import { useEffect } from "react";
import { store, useStore } from "../state/store.ts";
import LoadingScreen from "./LoadingScreen.tsx";
import MainMenu from "./MainMenu.tsx";
import Hud from "./Hud.tsx";
import GameCanvas from "../game/GameCanvas.tsx";
import SettingsScreen from "./SettingsScreen.tsx";
import RewardScreen from "./RewardScreen.tsx";
import CourseScreen from "./CourseScreen.tsx";
import ResultScreen from "./ResultScreen.tsx";
import BestiaryScreen from "./BestiaryScreen.tsx";
import PantryScreen from "./PantryScreen.tsx";
import { applyRunSafeArea } from "../sdk/runSdk.ts";
import { analytics } from "../systems/analytics/analyticsConfig.ts";

function MenuRoute() {
    const screen = useStore((state) => state.menuScreen);
    if (screen === "settings") return <SettingsScreen />;
    if (screen === "bestiary") return <BestiaryScreen />;
    if (screen === "pantry") return <PantryScreen />;
    return <MainMenu />;
}

function useOrientationSafeArea(): void {
    useEffect(() => {
        const refresh = () => applyRunSafeArea();
        let pending = 0;
        const onResize = () => {
            window.cancelAnimationFrame(pending);
            pending = window.requestAnimationFrame(refresh);
        };
        refresh();
        window.addEventListener("orientationchange", refresh);
        window.addEventListener("resize", onResize, { passive: true });
        return () => {
            window.removeEventListener("orientationchange", refresh);
            window.removeEventListener("resize", onResize);
            window.cancelAnimationFrame(pending);
        };
    }, []);
}

export default function App() {
    useOrientationSafeArea();
    const phase = useStore((s) => s.phase);

    // RUN's core-loop query expects screen_viewed; this router is the only
    // place every screen change passes through.
    useEffect(() => {
        analytics.event("screen_viewed", { screen: phase });
    }, [phase]);
    const patron = useStore((s) => s.chefsTableOwned);
    return (
        <div id="app-frame" className="bg-surface text-white" data-patron={patron ? "true" : "false"}>
            {phase === "loading" && <LoadingScreen />}
            {phase === "menu" && <MenuRoute />}
            {phase === "playing" && (
                <div className="absolute inset-0">
                    <GameCanvas />
                    <Hud />
                </div>
            )}
            {phase === "reward" && <RewardScreen />}
            {phase === "course" && <CourseScreen />}
            {phase === "result" && <ResultScreen />}
            <Toast />
        </div>
    );
}

function Toast() {
    const toast = useStore((state) => state.toast);
    const seq = useStore((state) => state.toastSeq);

    useEffect(() => {
        if (!toast) return;
        const timeout = window.setTimeout(() => {
            // Do not let an older toast's timer dismiss a newer message. The
            // seq comparison (not the text) keeps a repeated identical toast
            // alive for its own full duration.
            if (store.get().toastSeq === seq) store.patch({ toast: null });
        }, 3000);
        return () => window.clearTimeout(timeout);
    }, [toast, seq]);

    if (!toast) return null;
    return (
        <button type="button" className="toast" onClick={() => store.patch({ toast: null })}>
            {toast}
        </button>
    );
}
