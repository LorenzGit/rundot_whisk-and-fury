# Whisk & Fury day-zero monetization brief

- Game/version: Whisk & Fury: Recipe Rumble 0.1.0; broad family-friendly adult casual/strategy audience.
- Model: hybrid-capable foundation, completely disabled at launch until retention and value are demonstrated.
- Non-payer promise: every recipe, chef boss, card, route, Cookbook unlock, and restaurant progression path remains playable without paying or watching an ad.
- Value moment/unlock: no surface before one complete run and Cookbook level 3. First value is completing a flavor sequence and transforming a monster into a plated dish.
- Money may personalize: durable chef outfits, kitchen skins, card backs, plating effects, and restaurant trophy-wall themes. It may never sell stronger exclusive cards, guaranteed boss wins, hidden odds, or relief from deliberately inflated difficulty.
- Rewarded hypothesis: `whisk_fury_daily_special_bonus`, an opt-in extra Cookbook Star after a completed daily special; one per day/session; normal reward remains on failure/unavailable/cancel.
- Product hypothesis: `whisk_fury_copper_kitchen_style` with entitlement `whisk_fury_style_copper`; cosmetic only; inactive until real catalog value is reviewed.
- Architecture: RUN Shop + Entitlements, stable persisted purchase intent, order-history reconciliation, authoritative ownership/refund/revocation. Live price only.
- LiveOps: global, rewarded, shop, placement, and product switches all absent/malformed = disabled. No interstitial placement in the initial plan.
- Primary outcomes: first-run completion, D1/D7 retention, and only after enablement rewarded completion. Guardrails: non-payer completion, post-offer abandonment, errors, ad share of Stars, support complaints, and refund/revocation.
- Verification: local gate/state tests; Playground ad/Shop/order/entitlement/refund testing requires a real game, approved test identity, and explicit purchase budget. None exists yet.
