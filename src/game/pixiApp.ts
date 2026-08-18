/**
 * Pixi v8 Application factory. One place owns renderer options so the rest of
 * the game never touches them.
 */
import { Application } from "pixi.js";

type RendererPreference = "webgpu" | "webgl";

/** Sticky once WebGPU has failed this session (init or proven unusable). */
let webGpuProvenBroken = false;

function rendererBackend(app: Application): RendererPreference {
    // Never detect via constructor.name: minification renames the class, so
    // prod builds misread WebGPU as WebGL. Pixi's renderer.name is the literal
    // backend string on both backends and survives minification.
    return app.renderer.name.toLowerCase().includes("webgpu") ? "webgpu" : "webgl";
}

function isViewDeckPreview(): boolean {
    const root = document.documentElement;
    return Boolean(root.dataset.viewdeckEngine || root.dataset.viewdeckDevice || root.dataset.viewdeckSafeArea);
}

async function initializeRenderer(host: HTMLElement, preference: RendererPreference): Promise<Application> {
    const app = new Application();
    try {
        await app.init({
            preference,
            resizeTo: host,
            resolution: Math.min(window.devicePixelRatio || 1, 2),
            autoDensity: true,
            backgroundAlpha: 0,
            antialias: true,
        });
        const initializedBackend = rendererBackend(app);
        if (initializedBackend !== preference) {
            throw new Error(`Pixi initialized ${initializedBackend} while strict ${preference} was requested`);
        }
        // `init` resolving is not proof the backend draws. Force one frame so a
        // silent WebGPU failure fails here, while we can still fall back.
        app.renderer.render(app.stage);
        return app;
    } catch (error) {
        try {
            app.destroy({ removeView: true }, { children: true });
        } catch {
            // Initialization may fail before Pixi creates a renderer to destroy.
        }
        throw error;
    }
}

/**
 * Create and mount a Pixi app inside a host element. The canvas auto-resizes
 * to the host (the device-frame div), so the game is sized by CSS — the same
 * `--game-w` column that sizes the DOM UI.
 *
 * @param host element the canvas fills (position: relative/absolute)
 */
export async function createPixiApp(host: HTMLElement): Promise<Application> {
    const rendererQuery = new URLSearchParams(window.location.search).get("renderer");
    let app: Application;
    if (rendererQuery === "webgl" || rendererQuery === "webgpu") {
        // Forced modes are strict so QA can prove each backend independently.
        app = await initializeRenderer(host, rendererQuery);
    } else if (webGpuProvenBroken || isViewDeckPreview()) {
        // ViewDeck WKWebView's WebGPU path throws mid-frame on several Pixi 8
        // features used by combat VFX (stroked text, dynamic Graphics). Prefer
        // WebGL there so thrown cards actually animate. Same sticky fallback
        // after a prior WebGPU failure this session.
        if (isViewDeckPreview()) {
            console.info("[renderer] ViewDeck preview detected; using WebGL for stable combat VFX");
        }
        app = await initializeRenderer(host, "webgl");
    } else {
        try {
            // Pixi feature detection can pass even when adapter/device creation
            // later fails in a WebView. That failure is not auto-retried.
            app = await initializeRenderer(host, "webgpu");
        } catch (webGpuError) {
            webGpuProvenBroken = true;
            console.warn("[renderer] WebGPU initialization failed; retrying with WebGL", webGpuError);
            app = await initializeRenderer(host, "webgl");
        }
    }
    const rendererName = rendererBackend(app);
    document.documentElement.dataset.renderer = rendererName;
    app.canvas.dataset.renderer = rendererName;
    app.canvas.setAttribute("aria-label", "Animated kitchen battle");
    host.appendChild(app.canvas);
    return app;
}
