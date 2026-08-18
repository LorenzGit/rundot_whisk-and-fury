# Whisk & Fury audio brief

## Direction

- Music is a single licensed track, "Pasta Dash", looping under the whole game.
- SFX stay procedural: rounded sine/triangle cues, short envelopes, low levels.
- Explicit exclusions for SFX: beating drones, constant bass pressure, buzzy
  square waves, sharp highs, and dense repetition.
- Designed first for phone speakers, then headphones, in portrait play.

## Music

- Source: `public/assets/audio/pasta-dash.mp3` — 119.7 s, 128 kbps, 44.1 kHz
  stereo, 1.9 MB (compressed from a 3.1 MB 209 kbps master with the
  `compress-mp3-audio` skill's `music` preset; duration unchanged).
- Streamed through an `HTMLAudioElement` into a `MediaElementAudioSourceNode`
  on the existing music bus — NOT decoded to an `AudioBuffer`, which would hold
  ~42 MB of PCM for a two-minute stereo track.
- Routing it through the bus is what makes the Music toggle, the Music Volume
  slider, and every lifecycle suspend apply to it without extra code.
- Loops seamlessly (`loop = true`); one track for menu and gameplay alike, so
  there is no transition to get wrong.
- Default Music Volume is 45%, applied on top of a fixed `MUSIC_TRIM` of 0.34.
  The trim exists because the track is mastered for streaming (-14.3 LUFS,
  -0.8 dB peak, LRA 1.3 LU) — a constant wall next to 40 ms SFX transients.
  Trimming in the graph rather than lowering the default keeps the slider's
  full range usable.
- `migrate()` re-defaults a save whose Music Volume is still one of this game's
  superseded defaults (0.42 procedural-era, 0.2 the pre-trim first pass), since
  those were never chosen by the player. Any other value is a deliberate choice
  and survives untouched.
- Pause/sleep/background: pause the element and suspend the shared context.
- Resume: playback continues from where it stopped.

## Feedback map

| Moment | Cue | Sound | Haptic | Required visual feedback |
| --- | --- | --- | --- | --- |
| UI tap / card picked | `tap` | filtered noise click + short sine | light | pressed state, card leaves hand |
| Run start, victory title | `start` | rising triangle pair | light | phase transition |
| Serve Turn tapped | `start` | rising triangle pair | light | turn resolves |
| Ingredient lands on the monster | `bounce` | noise splat + low thump + mid body | light | impact burst, damage number |
| Perfect Plate | `reward` | rising third over a soft bell | success | plate banner, chain pill |
| Card adds Guard | `guard` | glassy upward shimmer, no impact | light | ◇+N flying into the Guard chip |
| Bea takes damage | `error` | noise slap + deep thud | warning | hit pose, shake, -N |
| Boss hit fully blocked | `block` | bright metallic clink | medium | BLOCKED!, Guard chip spends |
| Run lost | `error` (delayed 460 ms) | second, heavier thud | heavy | hurt pose, grey burst, shake |

Cues are layered (noise transient + tuned body) rather than single oscillators:
a lone sine reads as a beep, not a hit. Each has a cooldown, every node
disconnects on `ended`, and the master bus has conservative dynamics
compression.

Measured at the destination with an analyser, music bed vs cue peak:

| | level | over bed |
| --- | --- | --- |
| Music bed (45% × 0.34 trim) | RMS 0.0175 (-35.1 dBFS), peak 0.099 | — |
| `tap` | peak 0.097 | +14.9 dB |
| `bounce` | peak 0.241 | +22.8 dB |
| `reward` | peak 0.195 | +20.9 dB |
| `error` | peak 0.243 | +22.8 dB |
| `guard` | peak 0.128 | +17.2 dB |
| `block` | peak 0.151 | +18.7 dB |

Re-measure with an analyser spliced onto the destination after any level change;
the margin above is the thing to preserve. Below roughly +12 dB the cues start
disappearing into the bed, and the bed itself becomes inaudible under about
-45 dBFS RMS.

Before this pass the old `tap` peaked at 0.018 against an untrimmed bed RMS of
0.023 — the cue was quieter than the music, which is why the game read as
having no SFX at all.

## Settings and accessibility

- Separate persisted Music and SFX toggles/volumes; defaults are 45% and 70%.
- Haptics have a separate persisted toggle and are never the only signal. The
  capability check runs at trigger time, never from a cached boot probe, and
  falls back to `navigator.vibrate` off-host (a no-op on iOS Safari).
- Defeat's beat is scheduled 460 ms after the killing blow. Fired together, the
  hit and the loss stacked into one indistinguishable buzz.
- There is no voice or standalone ambience bus in this content-neutral starter.
- Audio unlock is recoverable after a player gesture; reduced motion does not
  remove audio controls or non-motion outcome feedback.

## QA

- The development `?qa=1` contract reports context state, whether the track is
  running, its playhead and readyState, active SFX voices, and suppressed cues.
  The playhead is the one that matters: `musicRunning` alone cannot tell a
  playing track from a stalled one.
- Verify first unlock, Music/SFX off independently, repeated bounce limits,
  pause/resume, background/foreground, reload persistence, and phone/headphone
  mix in every derived game.
