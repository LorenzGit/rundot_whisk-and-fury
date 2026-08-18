import { store } from "../state/store.ts";

export type SfxCue =
    | "tap"
    | "start"
    /** An ingredient landing on the monster. */
    | "bounce"
    /** Perfect Plate / reward pickup. */
    | "reward"
    /** Bea takes damage. */
    | "error"
    /** A card adds Guard. */
    | "guard"
    /** Guard soaked the boss hit entirely. */
    | "block";

/** One voice inside a cue. Cues are layered so impacts have a body, not a beep. */
interface SfxLayer {
    /** "noise" uses the shared white-noise buffer; anything else is an oscillator. */
    type: OscillatorType | "noise";
    frequency: number;
    endFrequency?: number;
    duration: number;
    peak: number;
    /** Seconds after the cue starts. Staggering layers is what makes a thwack. */
    delay?: number;
    attack?: number;
    filter?: { type: BiquadFilterType; frequency: number; endFrequency?: number; q?: number };
}

/**
 * Levels are set against a -14.3 LUFS music bed (see MUSIC_TRIM). The old cues
 * peaked at 0.028-0.065, which was audible under procedural chimes and
 * completely buried under a mastered track.
 */
const SFX_CUES: Record<SfxCue, SfxLayer[]> = {
    tap: [
        {
            type: "noise",
            frequency: 2600,
            duration: 0.03,
            peak: 0.1,
            filter: { type: "bandpass", frequency: 2600, q: 1.1 },
        },
        { type: "sine", frequency: 660, endFrequency: 880, duration: 0.05, peak: 0.12 },
    ],
    start: [
        { type: "triangle", frequency: 293.66, endFrequency: 587.33, duration: 0.22, peak: 0.16 },
        { type: "sine", frequency: 587.33, endFrequency: 880, duration: 0.26, peak: 0.08, delay: 0.05 },
    ],
    // Ingredient hits the monster: noise splat, then a rounded low thump.
    bounce: [
        {
            type: "noise",
            frequency: 1500,
            duration: 0.055,
            peak: 0.26,
            filter: { type: "lowpass", frequency: 2200, endFrequency: 600, q: 0.7 },
        },
        { type: "sine", frequency: 190, endFrequency: 96, duration: 0.16, peak: 0.32, attack: 0.004 },
        { type: "triangle", frequency: 420, endFrequency: 300, duration: 0.075, peak: 0.1 },
    ],
    // Perfect Plate: a bright rising third over a soft bell.
    reward: [
        { type: "triangle", frequency: 523.25, endFrequency: 1046.5, duration: 0.3, peak: 0.2 },
        { type: "sine", frequency: 784, endFrequency: 1568, duration: 0.36, peak: 0.13, delay: 0.06 },
        { type: "sine", frequency: 1318.5, duration: 0.44, peak: 0.07, delay: 0.12 },
    ],
    // Bea takes the hit: a real thud with a short noise slap on the front.
    error: [
        {
            type: "noise",
            frequency: 800,
            duration: 0.07,
            peak: 0.22,
            filter: { type: "lowpass", frequency: 1400, endFrequency: 320, q: 0.8 },
        },
        { type: "sine", frequency: 150, endFrequency: 62, duration: 0.28, peak: 0.36, attack: 0.003 },
        { type: "triangle", frequency: 233, endFrequency: 155, duration: 0.2, peak: 0.11, delay: 0.02 },
    ],
    // Guard goes up: a glassy upward shimmer, no impact.
    guard: [
        { type: "sine", frequency: 622.25, endFrequency: 1244.5, duration: 0.26, peak: 0.15, attack: 0.02 },
        { type: "triangle", frequency: 933, endFrequency: 1661, duration: 0.3, peak: 0.075, delay: 0.05, attack: 0.03 },
    ],
    // Nothing got through: a bright metallic clink.
    block: [
        {
            type: "noise",
            frequency: 4200,
            duration: 0.045,
            peak: 0.16,
            filter: { type: "bandpass", frequency: 4200, q: 2.2 },
        },
        { type: "triangle", frequency: 1244.5, endFrequency: 1046.5, duration: 0.22, peak: 0.17 },
        { type: "sine", frequency: 1864.7, duration: 0.16, peak: 0.09, delay: 0.02 },
    ],
};

const SFX_COOLDOWNS: Record<SfxCue, number> = {
    tap: 55,
    start: 180,
    bounce: 60,
    reward: 260,
    error: 200,
    guard: 90,
    block: 200,
};

export interface AudioDebugSnapshot {
    contextState: AudioContextState | "locked";
    musicRunning: boolean;
    musicTrack: string;
    /** Playhead in seconds — proves the track is actually advancing, not just unpaused. */
    musicTime: number;
    musicReadyState: number;
    activeSfxVoices: number;
    suppressedSfx: number;
}

/**
 * Looping background track. Streamed through an HTMLAudioElement rather than
 * decoded into an AudioBuffer: two minutes of 44.1 kHz stereo is ~42 MB of
 * PCM once decoded, which is not worth holding on a phone for a music bed.
 */
const MUSIC_TRACK = "/assets/audio/pasta-dash.mp3";

/**
 * Fixed trim on the music bed, applied under the player's Music Volume.
 *
 * The track is mastered for streaming at -14.3 LUFS with a -0.8 dB peak and
 * almost no dynamic range (LRA 1.3 LU) — it is a constant wall next to 40 ms
 * SFX transients. Without this, "Music 20%" still buried every cue. Trimming
 * here rather than lowering the default keeps the slider's full range useful.
 */
const MUSIC_TRIM = 0.34;

class AudioManager {
    private context: AudioContext | null = null;
    private master: GainNode | null = null;
    private musicBus: GainNode | null = null;
    private sfxBus: GainNode | null = null;
    private musicElement: HTMLAudioElement | null = null;
    private musicSource: MediaElementAudioSourceNode | null = null;
    private sfxVoices = new Set<AudioScheduledSourceNode>();
    private noiseBuffer: AudioBuffer | null = null;
    private lastCueAt = new Map<SfxCue, number>();
    private suppressedSfx = 0;
    private paused = false;
    private hostPaused = false;
    private hostOverlayVisible = false;
    private pageHidden = document.visibilityState !== "visible";
    private bound = false;

    bind(): void {
        if (this.bound) return;
        this.bound = true;
        store.subscribe(() => this.sync());
        document.addEventListener("visibilitychange", () => {
            this.pageHidden = document.visibilityState !== "visible";
            this.applyPauseState();
        });
    }

    async unlock(): Promise<boolean> {
        try {
            this.ensureGraph();
            if (!this.context) return false;
            if (this.paused) return false;
            if (this.context.state === "suspended") {
                // WebKit leaves resume() pending FOREVER when the call is not
                // backed by recognized user activation. Never let that hang a
                // caller — UI actions may await unlock before proceeding.
                await Promise.race([
                    this.context.resume(),
                    new Promise<void>((resolve) => window.setTimeout(resolve, 300)),
                ]);
            }
            this.sync();
            return this.context.state === "running";
        } catch (error) {
            console.warn("[audio] WebAudio unavailable", error);
            return false;
        }
    }

    setPaused(paused: boolean): void {
        this.hostPaused = paused;
        this.applyPauseState();
    }

    /** Host-owned ads and checkout sheets are independent of lifecycle pause. */
    setHostOverlayVisible(visible: boolean): void {
        this.hostOverlayVisible = visible;
        this.applyPauseState();
    }

    private applyPauseState(): void {
        this.paused = this.hostPaused || this.pageHidden || this.hostOverlayVisible;
        if (!this.context) return;
        if (this.paused) {
            this.stopMusic();
            void this.context.suspend().catch(() => undefined);
        } else {
            void this.context
                .resume()
                .then(() => this.sync())
                .catch(() => undefined);
        }
    }

    play(cue: SfxCue): void {
        const state = store.get();
        if (!this.context || !this.sfxBus || this.paused || !state.sfxEnabled || state.sfxVolume <= 0) return;

        const realNow = performance.now();
        if (realNow - (this.lastCueAt.get(cue) ?? -Infinity) < SFX_COOLDOWNS[cue]) {
            this.suppressedSfx += 1;
            return;
        }
        this.lastCueAt.set(cue, realNow);

        const now = this.context.currentTime;
        for (const layer of SFX_CUES[cue]) this.playLayer(layer, now);
    }

    private playLayer(layer: SfxLayer, cueStart: number): void {
        if (!this.context || !this.sfxBus) return;
        const start = cueStart + (layer.delay ?? 0);
        const attack = layer.attack ?? 0.006;
        const envelope = this.context.createGain();
        envelope.gain.setValueAtTime(0.0001, start);
        envelope.gain.exponentialRampToValueAtTime(layer.peak, start + attack);
        envelope.gain.exponentialRampToValueAtTime(0.0001, start + layer.duration);

        let filter: BiquadFilterNode | undefined;
        if (layer.filter) {
            filter = this.context.createBiquadFilter();
            filter.type = layer.filter.type;
            filter.frequency.setValueAtTime(layer.filter.frequency, start);
            if (layer.filter.endFrequency !== undefined) {
                filter.frequency.exponentialRampToValueAtTime(layer.filter.endFrequency, start + layer.duration);
            }
            filter.Q.value = layer.filter.q ?? 0.7;
        }

        const source = layer.type === "noise" ? this.createNoiseSource() : this.createToneSource(layer, start);
        if (!source) return;
        const tail = filter ? source.connect(filter).connect(envelope) : source.connect(envelope);
        void tail;
        envelope.connect(this.sfxBus);

        this.sfxVoices.add(source);
        source.addEventListener(
            "ended",
            () => {
                this.sfxVoices.delete(source);
                source.disconnect();
                filter?.disconnect();
                envelope.disconnect();
            },
            { once: true },
        );
        source.start(start);
        source.stop(start + layer.duration + 0.02);
    }

    private createToneSource(layer: SfxLayer, start: number): OscillatorNode | null {
        if (!this.context) return null;
        const oscillator = this.context.createOscillator();
        oscillator.type = layer.type as OscillatorType;
        oscillator.frequency.setValueAtTime(layer.frequency, start);
        if (layer.endFrequency !== undefined) {
            oscillator.frequency.exponentialRampToValueAtTime(layer.endFrequency, start + layer.duration);
        }
        return oscillator;
    }

    /** Impacts need broadband noise; a pure tone reads as a beep, not a hit. */
    private createNoiseSource(): AudioBufferSourceNode | null {
        if (!this.context || !this.noiseBuffer) return null;
        const source = this.context.createBufferSource();
        source.buffer = this.noiseBuffer;
        source.loop = true;
        return source;
    }

    debugSnapshot(): AudioDebugSnapshot {
        const element = this.musicElement;
        return {
            contextState: this.context?.state ?? "locked",
            musicRunning: element !== null && !element.paused && !element.ended,
            musicTrack: MUSIC_TRACK,
            musicTime: element ? Number(element.currentTime.toFixed(2)) : 0,
            musicReadyState: element?.readyState ?? 0,
            activeSfxVoices: this.sfxVoices.size,
            suppressedSfx: this.suppressedSfx,
        };
    }

    private ensureGraph(): void {
        if (this.context) return;
        const AudioContextCtor = window.AudioContext;
        if (!AudioContextCtor) return;
        this.context = new AudioContextCtor();
        this.master = this.context.createGain();
        this.musicBus = this.context.createGain();
        this.sfxBus = this.context.createGain();
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -20;
        limiter.knee.value = 18;
        limiter.ratio.value = 4;
        limiter.attack.value = 0.004;
        limiter.release.value = 0.24;
        this.musicBus.connect(this.master);
        this.sfxBus.connect(this.master);
        this.master.connect(limiter).connect(this.context.destination);

        // One second of white noise, shared and looped by every impact layer.
        const noiseFrames = Math.floor(this.context.sampleRate);
        this.noiseBuffer = this.context.createBuffer(1, noiseFrames, this.context.sampleRate);
        const noise = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseFrames; i += 1) noise[i] = Math.random() * 2 - 1;

        // Routing the element through the graph (rather than letting it play
        // straight to the device) is what makes the Music slider, the mute
        // toggle and every lifecycle suspend apply to the track for free.
        const element = new Audio(MUSIC_TRACK);
        element.loop = true;
        element.preload = "auto";
        element.crossOrigin = "anonymous";
        this.musicElement = element;
        this.musicSource = this.context.createMediaElementSource(element);
        this.musicSource.connect(this.musicBus);
    }

    private sync(): void {
        if (!this.context || !this.master || !this.musicBus || !this.sfxBus) return;
        const state = store.get();
        const now = this.context.currentTime;
        const musicLevel = state.musicEnabled ? state.musicVolume * MUSIC_TRIM : 0;
        this.musicBus.gain.setTargetAtTime(musicLevel, now, 0.12);
        this.sfxBus.gain.setTargetAtTime(state.sfxEnabled ? state.sfxVolume : 0, now, 0.03);
        this.master.gain.setTargetAtTime(this.paused ? 0 : 0.58, now, 0.08);
        if (state.musicEnabled && state.musicVolume > 0 && !this.paused && this.context.state === "running") {
            this.startMusic();
        } else {
            this.stopMusic();
        }
    }

    private startMusic(): void {
        const element = this.musicElement;
        if (!element || !element.paused) return;
        // Autoplay policy rejects until the context has real user activation;
        // sync() runs again on the next unlock/settings change, so a rejection
        // here is a retry, not a failure.
        void element.play().catch(() => undefined);
    }

    /** Pause, never reset: the track resumes where the player left it. */
    private stopMusic(): void {
        this.musicElement?.pause();
    }
}

export const audioManager = new AudioManager();
