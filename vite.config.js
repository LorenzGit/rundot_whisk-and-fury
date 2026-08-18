import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {
    rundotGameLibrariesPlugin,
    rundotGamePlaygroundPlugin,
    rundotMultiplayerPlugin,
} from "@series-inc/rundot-game-sdk/vite";
import { rundotSyncplayPlugin } from "@series-inc/rundot-game-sdk/syncplay/tools";

const playgroundEnabled = process.env.RUNDOT_PLAYGROUND === "1";
const multiplayerEnabled = process.env.RUNDOT_MULTIPLAYER === "1";
const syncplayEnabled = process.env.RUNDOT_SYNCPLAY === "1";

const plugins = [rundotGameLibrariesPlugin(), react(), tailwindcss()];

// Playground talks to real RUN services and requires sign-in, so it must never
// ambush ordinary local development. Purchases made there are real/persistent.
if (playgroundEnabled) plugins.push(rundotGamePlaygroundPlugin());

// The room server owns a port and emits a server bundle. Keep it opt-in for
// games that deliberately adopt the multiplayer reference under additional_features/.
if (multiplayerEnabled) {
    plugins.push(
        rundotMultiplayerPlugin({
            // SDK 5.24's server validator resolves the canonical RUN path even
            // when the plugin receives a custom path, so keep one reviewed config.
            configPath: "rundot/realtime.config.json",
            devPort: 9001,
        }),
    );
}

if (syncplayEnabled) {
    plugins.push(
        rundotSyncplayPlugin({
            mode: "strict",
            simulationEntries: ["additional_features/multiplayer/syncplay.ts"],
        }),
    );
}

export default defineConfig({
    // REQUIRED for RUN: deployed builds are served from a subdirectory, so all
    // asset URLs must be relative. Do not change this.
    base: "./",
    plugins,
    server: {
        allowedHosts: true,
        port: 5183,
    },
    build: {
        // Top-level await in the RUN SDK needs a modern target.
        target: "es2022",
        // Pixi is intentionally isolated as one renderer chunk. Keep the
        // warning budget explicit and enforce the same ceiling after builds.
        chunkSizeWarningLimit: 600,
        rollupOptions: {
            // React is split out too: in the bundled build (SDK inlined rather
            // than host-provided) the app chunk crossed the 600 kB ceiling, and
            // the framework is the part that never changes between releases, so
            // it is both the correct thing to cut and the best thing to cache.
            output: {
                manualChunks: {
                    pixi: ["pixi.js"],
                    react: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
                },
            },
        },
    },
    esbuild: { target: "es2022" },
    optimizeDeps: {
        esbuildOptions: {
            target: "es2022",
        },
    },
});
