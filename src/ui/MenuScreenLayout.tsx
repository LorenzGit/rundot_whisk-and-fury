import type { ReactNode } from "react";
import { audioManager } from "../audio/audioManager.ts";
import { store } from "../state/store.ts";
import { t } from "../systems/localization.ts";

export default function MenuScreenLayout({
    title,
    kicker,
    children,
}: {
    title: string;
    kicker: string;
    children: ReactNode;
}) {
    const back = async () => {
        store.patch({ menuScreen: "main" });
        void audioManager.unlock().then(() => audioManager.play("tap"));
    };
    return (
        <main className="subscreen pt-safe-top pb-safe-bottom">
            <header className="subscreen-header">
                <button type="button" className="back-button" onClick={() => void back()} aria-label={t("ButtonBack")}>
                    <span aria-hidden="true">‹</span>
                </button>
                <div>
                    <p className="eyebrow">{kicker}</p>
                    <h2>{title}</h2>
                </div>
            </header>
            <div className="subscreen-content">{children}</div>
        </main>
    );
}
