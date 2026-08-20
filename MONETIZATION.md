# Whisk & Fury monetization brief

## Launch model

- **Secret Menu** — one-time 200 RB pack of six exclusive off-menu cards (Black Garlic, Inferno Peach, Yuzu Crash, Gold Leaf, Morel Wild, Off-Menu Shot). They shuffle into every non-tutorial service. Stronger than house 1-costs; they never appear as free reward picks. Non-payers keep the full house library and every route.
- **Chef's Table Pass** — one-time copper-and-gold kitchen theme. It gilds every ingredient card, rings plated cookbook dishes and victory plates, adds a Chef's Table plaque on the menu, and a patron chip on Bea's nameplate. It never grants cards, ingredients, damage, health, monsters, or progression. The Pantry shows those four treatments as pictures, not a bullet list.
- **Encore Star** — one optional rewarded ad after a run for exactly one bonus cookbook star. One claim per run; rewards are applied only after the RUN ad API reports verified completion.
- **No forced ads at launch.** There are no interstitials, energy timers, paid continues, loot boxes, or paid gameplay gates.

## Price and activation

Chef's Table Pass is **400 RB** in `rundot/shop.config.json`. The Pantry never displays that authored number as a fake checkout price: it reads the active regional/sale-resolved price from the RUN catalog and labels it **RB**. LiveOps keeps `shopEnabled: true` and `adsEnabled: false` — Encore Star stays optional and off until ads are turned on separately.

## Source-of-truth and safety

- Product: `whisk_fury_chefs_table_pass` / entitlement `whisk_fury_chefs_table_pass_entitlement`
- Product: `whisk_fury_secret_menu` / entitlement `whisk_fury_secret_menu_entitlement`
- Rewarded placement: `whisk_fury_results_encore`
- Ownership is reconciled from RUN entitlements at boot and after verified purchase.
- Plain local development shows the surfaces but cannot grant purchases or ad rewards.
- Purchase and ad failures are neutral; no entitlement or star is awarded.

## Events and initial decisions

Track `shop_purchase_started`, `shop_purchase_result`, and `rewarded_encore_result`. Review purchase conversion, rewarded offer-to-completion, retention, payer/non-payer progression, and support/refund signals before changing price or adding inventory. Do not introduce forced ads unless a later experiment demonstrates neutral retention and the Chef's Table Pass is explicitly expanded to remove them.
