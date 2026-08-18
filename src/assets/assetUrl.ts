/**
 * Resolve a `public/` asset against the deployed base URL.
 *
 * Vite rewrites `url()` in CSS and any asset it bundles to respect `base`, but
 * it NEVER rewrites string literals in JavaScript. A root-absolute
 * "/assets/art/x.png" therefore always requests the ORIGIN ROOT, which is only
 * correct when the game is served from "/". RUN serves each build from a
 * versioned subdirectory, so every runtime asset 404s there.
 *
 * The symptom is misleading: the menu still renders (React and the bundled CSS
 * are fine), but the first `Assets.load` inside createBattleScene rejects, and
 * GameCanvas reports that as "RENDERER UNAVAILABLE — TRY A DIFFERENT DEVICE".
 * The renderer is healthy; the textures are missing.
 *
 * Wrap at the DEFINITION of every asset path, not at each use site, so a new
 * consumer cannot reintroduce the bug by reading a raw literal.
 *
 * Pass paths WITHOUT a leading slash ("assets/art/x.png"). check-build.mjs
 * fails the build on any "/assets/..." literal surviving in the emitted JS, and
 * that guard only works if a correct call site does not contain one.
 */
export function assetUrl(path: string): string {
    // BASE_URL is "/" in dev and "./" for the deployed build (vite base).
    return new URL(`${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`, document.baseURI).href;
}
