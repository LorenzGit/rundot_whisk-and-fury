/**
 * PLACEHOLDERS — but know where each id actually comes from:
 *
 * - gameId: written by `rundot init` (also in game.config.prod.json).
 * - Ad placement ids: SELF-AUTHORED plain strings passed as `adDisplayId` to
 *   showRewardedAdAsync/showInterstitialAd. There is NO platform-side
 *   "create a placement" step — invent a stable name and ship it.
 * - Shop item / entitlement ids: SELF-AUTHORED in rundot/shop.config.json,
 *   which registers the catalog at deploy. Use those exact strings here.
 *
 * Nothing here waits on a dashboard. Untouched REPLACE_WITH_ values fail
 * closed (surfaces hide), so fill them when the surfaces should go live —
 * and ship rundot/liveops.config.json with the enable flags, or default-off
 * LiveOps gating will keep everything dark even with real ids. Working
 * Keep this registry as the single source of truth so configured surfaces do
 * not drift away from their deployed server configuration.
 */
export const PLATFORM_IDS = Object.freeze({
    gameId: "REPLACE_WITH_WHISK_AND_FURY_GAME_ID",
    // Ad placement IDs are self-authored. Rename these in every derived game.
    rewardedResultsBonus: "whisk_fury_results_encore",
    chefsTableItem: "whisk_fury_chefs_table_pass",
    chefsTableEntitlement: "whisk_fury_chefs_table_pass_entitlement",
});

export function isConfiguredPlatformId(value: string): boolean {
    return value.length > 0 && !value.startsWith("REPLACE_WITH_");
}
