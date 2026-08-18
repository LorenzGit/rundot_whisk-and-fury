/**
 * Asset manifest — the single place that lists what gets loaded and when.
 * Files live in public/ and use page-relative URLs so deployed subdirectories
 * work without special handling.
 *
 * Two tiers (pattern from a shipped RUN game):
 *   - 'critical'  — awaited during the loading screen. Everything the first
 *                   interactive screen needs: menu art, UI chrome, the sprites
 *                   visible in the first seconds of play.
 *   - 'deferred'  — fire-and-forget background load after boot. Sub-screen
 *                   art, late-game content, anything the player can't see yet.
 *
 * Keep 'critical' small: every asset here delays first interaction.
 */
import type { AssetsManifest, UnresolvedAsset } from "pixi.js";

/**
 * A narrowing of Pixi's AssetsManifest: Pixi also allows `assets` to be a
 * record, but this template keeps it an array so the tier filters below can
 * check `assets.length`. Still assignable to AssetsManifest (Assets.init).
 */
export interface Manifest extends AssetsManifest {
    bundles: { name: string; assets: UnresolvedAsset[] }[];
}

export const MANIFEST: Manifest = {
    bundles: [
        {
            name: "critical",
            assets: [
                { alias: "key-art", src: "/assets/art/key-art-anime.jpg" },
                { alias: "key-art-portrait", src: "/assets/art/key-art-anime-portrait.jpg" },
                { alias: "arena", src: "/assets/art/sunlit-kitchen-arena.jpg" },
                { alias: "ingredient-icons", src: "/assets/art/ingredient-icons-anime.png" },
                { alias: "chef-bea", src: "/assets/art/chef-bea-anime.png" },
                { alias: "spaghetti-kraken", src: "/assets/art/spaghetti-kraken-anime.png" },
            ],
        },
        {
            name: "deferred",
            assets: [
                { alias: "souffle-brute", src: "/assets/art/souffle-brute-anime.png" },
                { alias: "citrus-basilisk", src: "/assets/art/citrus-basilisk-anime.png" },
                { alias: "macaron-mimic", src: "/assets/art/macaron-mimic-anime.png" },
                { alias: "paella-phoenix", src: "/assets/art/paella-phoenix-anime.png" },
                { alias: "tiramisu-phantom", src: "/assets/art/tiramisu-phantom-anime.png" },
                { alias: "chef-vesper", src: "/assets/art/chef-vesper-anime.png" },
                { alias: "ramen-tempest", src: "/assets/art/ramen-tempest-anime.png" },
                { alias: "ratatouille-golem", src: "/assets/art/ratatouille-golem-anime.png" },
                { alias: "croquembouche-queen", src: "/assets/art/croquembouche-queen-anime.png" },
                { alias: "ingredient-icons-expansion", src: "/assets/art/ingredient-icons-expansion-anime.png" },
                {
                    alias: "ingredient-icons-expansion2",
                    src: "/assets/art/ingredient-icons-expansion2-anime.png",
                },
                {
                    alias: "ingredient-icons-expansion3",
                    src: "/assets/art/ingredient-icons-expansion3-anime.png",
                },
                { alias: "gnocchi-gremlin", src: "/assets/art/gnocchi-gremlin-anime.png" },
                { alias: "waffle-wyrm", src: "/assets/art/waffle-wyrm-anime.png" },
                { alias: "dumpling-drake", src: "/assets/art/dumpling-drake-anime.png" },
                { alias: "conservatory-arena", src: "/assets/art/conservatory-kitchen-arena.jpg" },
                { alias: "rooftop-arena", src: "/assets/art/rooftop-patisserie-arena.jpg" },
                { alias: "seaside-arena", src: "/assets/art/seaside-festival-arena.jpg" },
            ],
        },
    ],
};

// Empty bundles are skipped so an unused tier never errors.
export const CRITICAL_BUNDLES: string[] = MANIFEST.bundles
    .filter((b) => b.name !== "deferred" && b.assets.length > 0)
    .map((b) => b.name);

export const DEFERRED_BUNDLES: string[] = MANIFEST.bundles
    .filter((b) => b.name === "deferred" && b.assets.length > 0)
    .map((b) => b.name);
