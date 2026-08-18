# Whisk & Fury monetization brief

## Launch model

- **Chef's Table Pass** — one-time, non-consumable cosmetic supporter purchase. It grants a gilded cookbook treatment and patron menu badge. It never grants cards, ingredients, damage, health, monsters, or progression.
- **Encore Star** — one optional rewarded ad after a run for exactly one bonus cookbook star. One claim per run; rewards are applied only after the RUN ad API reports verified completion.
- **No forced ads at launch.** There are no interstitials, energy timers, paid continues, loot boxes, or paid gameplay gates.

## Price and activation

The inactive authoring hypothesis is **400 RUN Bucks**. The client never displays that authored number directly: it reads the active regional/sale-resolved price from the RUN catalog. Both `adsEnabled` and `shopEnabled` remain `false` in LiveOps until host/playground QA is complete. No config has been uploaded.

## Source-of-truth and safety

- Product: `whisk_fury_chefs_table_pass`
- Entitlement: `whisk_fury_chefs_table_pass_entitlement`
- Rewarded placement: `whisk_fury_results_encore`
- Ownership is reconciled from RUN entitlements at boot and after verified purchase.
- Plain local development shows the surfaces but cannot grant purchases or ad rewards.
- Purchase and ad failures are neutral; no entitlement or star is awarded.

## Events and initial decisions

Track `shop_purchase_started`, `shop_purchase_result`, and `rewarded_encore_result`. Review purchase conversion, rewarded offer-to-completion, retention, payer/non-payer progression, and support/refund signals before changing price or adding inventory. Do not introduce forced ads unless a later experiment demonstrates neutral retention and the Chef's Table Pass is explicitly expanded to remove them.
