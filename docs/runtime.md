# Runtime services contract

`src/systems/runtimeServices.ts` is the game-facing coordinator. `src/sdk/runSdk.ts` is the only platform transport boundary.

## Boot and resume

- Boot does not await runtime services. The menu remains available when RUN APIs are absent or slow.
- Boot/resume refresh trusted time and LiveOps in parallel, then re-arm a return notification only after confirmed consent.
- LiveOps refreshes once at `nextChangeAt`; it does not poll per frame.
- Sleep/quit only flush save and pause audio. They do not start fresh notification/network work.
- Pause and sleep both freeze gameplay; resume and awake both recover it. Browser
  visibility independently stops the Pixi ticker without clearing a host-owned pause.
- Android back closes gameplay or the current submenu first, then calls
  `requestPopOrQuit()` when the template navigation stack is empty.
- Identity changes trigger a clean reload when the profile ID changes. The game never flushes one player's in-memory state under another identity.
- RUN safe-area values are applied to CSS custom properties after the bounded host handshake.
- SDK 5.24 safe-area values are static after initialization, so the template
  reads them once instead of adding resize polling that cannot change the result.

## Renderer and persistence

- Default renderer selection tries WebGPU initialization, not just feature
  detection, and retries with a fresh WebGL application if adapter/device setup
  fails. Forced `?renderer=` modes never fall back so QA failures stay visible.
- Parsed saves are treated as untrusted input: booleans, enums, counters, day
  keys, claim lists, and quest values are normalized before entering state.
- Save writes are serialized and rapid updates are coalesced. A slow older RUN
  storage RPC cannot finish after a newer write and overwrite it.
- A global unhandled-rejection listener is only a last-resort host-crash guard;
  every known SDK boundary still handles its own error.

## RUN browser capabilities

The RUN runtime also permits camera, microphone, clipboard read/write, and
autoplay. These are browser features, not additional SDK namespaces.

- Clipboard write is a visible, tap-driven Feature Lab example.
- Camera/microphone and clipboard adoption patterns live in
  `additional_features/client/runtime.ts`; media tracks must be stopped after use.
- Clip capture can optionally request reaction-camera and microphone access in
  `additional_features/client/content.ts`, using the SDK consent flow.
- The template still unlocks audio from a player gesture so the same build works
  in ordinary browsers whose autoplay policy is stricter than the RUN host.

## Authority

- RUN host daily claims require a successful server-time sample.
- Local fallback enables development and is visibly non-authoritative.
- Analytics never controls ownership, eligibility, or rewards.
- Notification success is not assumed from a request; the host preference is read back and messages use the current `submitMessageAsync` API.
- Haptics are optional feedback and never the only feedback.
- Haptics use root `triggerHapticAsync()` plus
  `system.getDevice().haptics`; there is no runtime `haptics` namespace in SDK
  5.24. A guarded web-vibration fallback may report unavailable.
- Ads return `verified | unavailable | cancelled | failed`; Shop returns the
  same recoverable result union. Only `verified` may proceed to
  placement-specific reconciliation or grant logic.

## LiveOps keys

Only the following bounded client-visible values are consumed:

- `runtime.dailyRewardsEnabled` boolean
- `runtime.dailyQuestsEnabled` boolean
- `runtime.notificationDelaySeconds` number clamped to 1 hour through 7 days
- `runtime.monetization.adsEnabled` boolean, additionally blocked by host capability; ad placement IDs are self-authored and must be renamed per derived game
- `runtime.monetization.shopEnabled` boolean, additionally blocked by item/entitlement placeholders and capability

Never place secrets, entitlement ownership, trusted rewards, or anti-cheat decisions in client LiveOps.
