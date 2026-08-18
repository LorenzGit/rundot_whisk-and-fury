# Additional features

Whisk & Fury keeps these optional RUN capability examples isolated from the production game bundle:
host discovery, profile/access state, system and gamepad facts, launch intent,
attribution, release notes, feature controls, trusted/future time, number formatting,
CDN resolution, platform UI, community UI, add-to-home, shop/order/entitlement/
currency/subscription/stat/collectible/leaderboard/UGC/clip-support/credit reads,
sharing, clipboard writes, ads, haptics, storage, custom/funnel analytics,
LiveOps, notifications, and lifecycle/back handling.

This directory contains the remaining patterns that should **not** be folded
into a generic demo without a product decision. They may navigate away, mutate
remote state, spend money or generation credits, upload player content, require
creator privileges, or need a server/multiplayer build.

Nothing here is imported by the default client bundle. It is typechecked by
`npm run typecheck` so SDK drift is caught early.

## Contents

- `client/navigation.ts` — cross-game/app navigation, host exit, and teardown.
- `client/storage.ts` — device/owner/shared storage and shared asset bundles.
- `client/runtime.ts` — RUN-host camera, microphone, clipboard, and autoplay
  browser capabilities; permission prompts remain explicitly player initiated.
- `client/assets.ts` — RUN-hosted asset loading and cache cleanup.
- `client/notifications.ts` — RCS consent and cross-channel messaging.
- `client/commerce.ts` — direct-purchase discovery, currency spending,
  subscription checkout, and entitlement consumption.
- `client/progression.ts` — leaderboard reads, stats/leaderboard writes, simulation recipes, and
  VIP collectible claims.
- `client/content.ts` — UGC, files, clips (including optional reaction camera/microphone), and native video.
- `client/generation.ts` — billed generation and 3D avatar mutation.
- `client/moderation.ts` — creator-only moderation operations.
- `multiplayer/` — realtime client/server and deterministic Syncplay patterns.
- `config/` — inert Shop, LiveOps, leaderboard, simulation, and Syncplay
  operator configuration samples.

Copy only the capability a derived game adopts, preserve its authority and
consent checks, and test host-dependent behavior in the opt-in RUN Playground.
