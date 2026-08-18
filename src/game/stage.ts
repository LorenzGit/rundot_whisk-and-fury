/**
 * Design-resolution stage: scene code works in fixed DESIGN UNITS, and this
 * module maps them to real pixels — so anything sized at 1/4 of the design
 * width takes up 1/4 of the screen width on EVERY device and aspect ratio.
 *
 * How it works (width-fit, the pattern a shipped RUN game uses for all of
 * its gameplay layout):
 *   - The stage root container is scaled by screenWidth / DESIGN_WIDTH.
 *   - Horizontal space is therefore always exactly DESIGN_WIDTH units wide.
 *   - Vertical space varies with the device: designHeight() reports how many
 *     units tall the screen currently is (taller phones simply see more).
 *     Anchor vertical layout to top / bottom / center via designHeight() —
 *     never hardcode a bottom edge.
 *
 * With the 9:16 device-frame clamp in styles/app.css, designHeight() for a
 * DESIGN_WIDTH of 720 ranges from 1280 (9:16 exactly) to ~1560 (tall 19.5:9
 * phones). Design your layout to work across that range: keep must-see
 * content within the top 1280 units or bottom-anchor it.
 */
import { Container, type Application } from "pixi.js";

/**
 * ADAPT: the game's design width, in units. 720 is a good default for
 * portrait (art assets sized against a 720-wide layout look right at 2x DPR
 * on modern phones). For a LANDSCAPE game, invert the pattern: fix a design
 * HEIGHT instead and scale by screenHeight / DESIGN_HEIGHT, letting width
 * vary — see layout() below.
 */
export const DESIGN_WIDTH = 720;

/** What createStage returns — the surface scenes build against. */
export interface Stage {
    /** Add all scene content here (NOT app.stage), positioned in design units. */
    root: Container;
    /** Constant: the design-space width (= DESIGN_WIDTH). */
    width: number;
    /** Current screen height in design units — re-read after resizes. */
    designHeight(): number;
    /** Current design-unit → pixel factor (rarely needed directly). */
    scale(): number;
    /** Subscribe to resizes (re-anchor bottom/center content). Returns unsubscribe. */
    onResize(cb: () => void): () => void;
    destroy(): void;
}

/**
 * Create the stage on a Pixi app. Add all scene content to `stage.root`
 * (NOT app.stage) and position/size it in design units.
 */
export function createStage(app: Application): Stage {
    const root = new Container();
    app.stage.addChild(root);

    const resizeCbs = new Set<() => void>();
    let _designHeight = (DESIGN_WIDTH * 16) / 9;

    const layout = () => {
        if (app.screen.width <= 0 || app.screen.height <= 0) return;
        const s = app.screen.width / DESIGN_WIDTH;
        root.scale.set(s);
        _designHeight = app.screen.height / s;
        for (const cb of resizeCbs) cb();
    };

    // app.screen is in CSS pixels regardless of resolution/autoDensity, so
    // the design mapping is unaffected by devicePixelRatio.
    app.renderer.on("resize", layout);

    /**
     * Watch the host element, not just the window.
     *
     * Pixi's `resizeTo` option reads the host's clientWidth/clientHeight at
     * init and then ONLY re-reads it on a `window` resize — it installs no
     * ResizeObserver. React mounts this canvas when the phase flips to
     * 'playing', so the host div frequently has no layout yet when the async
     * `app.init()` resolves. The renderer is then sized 0x0, `layout()` bails
     * on the zero guard, and because the window never resizes nothing ever
     * re-triggers it: a permanently blank canvas with no error anywhere.
     *
     * Observing the host closes that race for good, and also handles the host
     * changing size without the window doing so (orientation-driven CSS,
     * safe-area changes, the RUN host resizing its frame).
     */
    const host = app.canvas.parentElement;
    let observer: ResizeObserver | null = null;
    /** True once the host has been observed with no layout at all. */
    let wasCollapsed = app.screen.width <= 0 || app.screen.height <= 0;

    if (host && typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(() => {
            const { clientWidth, clientHeight } = host;
            if (clientWidth <= 0 || clientHeight <= 0) {
                wasCollapsed = true;
                return;
            }

            if (wasCollapsed) {
                wasCollapsed = false;
                // Coming back from zero size, the host is usually the SAME size
                // it was before. Pixi's `resize()` early-returns when the
                // dimensions match, so it would never reconfigure — and a
                // WebGPU canvas that was collapsed has had its swap chain torn
                // down, so it renders nothing forever with no error. Nudge the
                // height by a pixel to force a genuine reconfigure.
                app.renderer.resize(clientWidth, Math.max(1, clientHeight - 1));
            }

            // Re-sizing emits 'resize', which runs layout(); call it anyway in
            // case the dimensions already matched and only the stage mapping
            // was missed.
            app.renderer.resize(clientWidth, clientHeight);
            layout();
        });
        observer.observe(host);
    }

    layout();

    return {
        root,
        width: DESIGN_WIDTH,
        designHeight: () => _designHeight,
        scale: () => root.scale.x,
        onResize(cb) {
            resizeCbs.add(cb);
            return () => resizeCbs.delete(cb);
        },
        destroy() {
            observer?.disconnect();
            observer = null;
            app.renderer.off("resize", layout);
            resizeCbs.clear();
            root.destroy({ children: true });
        },
    };
}
