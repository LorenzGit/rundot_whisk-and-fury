import {
    Assets,
    BlurFilter,
    Container,
    Graphics,
    Rectangle,
    Sprite,
    Text,
    TextStyle,
    Texture,
    type Application,
    type Ticker,
} from "pixi.js";
import { audioManager } from "../audio/audioManager.ts";
import { runtimeServices } from "../systems/runtimeServices.ts";
import { store } from "../state/store.ts";
import { combat, enemyById, FLAVOR_META, type CombatEvent } from "./combat.ts";
import { createBoneRig } from "./boneRig.ts";
import type { Stage } from "./stage.ts";
import { assetUrl } from "../assets/assetUrl.ts";

export interface Scene {
    destroy(): void;
}

const ARENA_BACKGROUNDS = {
    sunlit: assetUrl("assets/art/sunlit-kitchen-arena.jpg"),
    conservatory: assetUrl("assets/art/conservatory-kitchen-arena.jpg"),
    rooftop: assetUrl("assets/art/rooftop-patisserie-arena.jpg"),
    seaside: assetUrl("assets/art/seaside-festival-arena.jpg"),
} as const;

/** Cell coordinates of each ingredient across the icon atlases. */
type IngredientAtlas = "base" | "expansion" | "expansion2" | "expansion3";

const INGREDIENT_CELLS: Record<string, { atlas: IngredientAtlas; col: number; row: number }> = {
    tomato: { atlas: "base", col: 0, row: 0 },
    basil: { atlas: "base", col: 1, row: 0 },
    lemon: { atlas: "base", col: 2, row: 0 },
    chili: { atlas: "base", col: 3, row: 0 },
    flame: { atlas: "base", col: 0, row: 1 },
    pepper: { atlas: "base", col: 1, row: 1 },
    butter: { atlas: "base", col: 2, row: 1 },
    cream: { atlas: "base", col: 3, row: 1 },
    cheese: { atlas: "base", col: 0, row: 2 },
    mushroom: { atlas: "base", col: 1, row: 2 },
    garlic: { atlas: "base", col: 2, row: 2 },
    cocoa: { atlas: "base", col: 3, row: 2 },
    berry: { atlas: "base", col: 0, row: 3 },
    knife: { atlas: "base", col: 1, row: 3 },
    pan: { atlas: "base", col: 2, row: 3 },
    whisk: { atlas: "base", col: 3, row: 3 },
    rosemary: { atlas: "expansion", col: 0, row: 0 },
    honey: { atlas: "expansion", col: 1, row: 0 },
    shrimp: { atlas: "expansion", col: 0, row: 1 },
    vanilla: { atlas: "expansion", col: 1, row: 1 },
    mint: { atlas: "expansion2", col: 0, row: 0 },
    ginger: { atlas: "expansion2", col: 1, row: 0 },
    olive: { atlas: "expansion2", col: 0, row: 1 },
    peach: { atlas: "expansion2", col: 1, row: 1 },
    avocado: { atlas: "expansion3", col: 0, row: 0 },
    onion: { atlas: "expansion3", col: 1, row: 0 },
    caramel: { atlas: "expansion3", col: 0, row: 1 },
    espresso: { atlas: "expansion3", col: 1, row: 1 },
};

interface Spark {
    view: Graphics;
    vx: number;
    vy: number;
    life: number;
    gravity: number;
    drag: number;
    spin: number;
    /**
     * Confetti: hold full size for the whole fall and fade only at the end,
     * swaying by `flutter`. Plain sparks instead shrink and fade with `life`,
     * which reads as a spark but as litter for something that falls for 2s.
     */
    maxLife?: number;
    flutter?: number;
}

interface SceneTween {
    elapsed: number;
    duration: number;
    update(progress: number): void;
    complete?: () => void;
}

const easeOutBack = (value: number) => {
    const amount = 1.16;
    return 1 + (amount + 1) * (value - 1) ** 3 + amount * (value - 1) ** 2;
};

const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;

function framesFromSheet(sheet: Texture): Texture[] {
    const width = sheet.source.width / 2;
    const height = sheet.source.height / 2;
    return [
        new Texture({ source: sheet.source, frame: new Rectangle(0, 0, width, height) }),
        new Texture({ source: sheet.source, frame: new Rectangle(width, 0, width, height) }),
        new Texture({ source: sheet.source, frame: new Rectangle(0, height, width, height) }),
        new Texture({ source: sheet.source, frame: new Rectangle(width, height, width, height) }),
    ];
}

export async function createBattleScene(app: Application, stage: Stage): Promise<Scene> {
    const state = store.get();
    const enemy = enemyById(state.enemyId);
    const [backgroundTexture, heroSheet, enemySheet, baseIcons, expansionIcons, expansion2Icons, expansion3Icons] =
        await Promise.all([
            Assets.load<Texture>(ARENA_BACKGROUNDS[enemy.arena]),
            Assets.load<Texture>(assetUrl("assets/art/chef-bea-anime.png")),
            Assets.load<Texture>(enemy.art),
            Assets.load<Texture>(assetUrl("assets/art/ingredient-icons-anime.png")),
            Assets.load<Texture>(assetUrl("assets/art/ingredient-icons-expansion-anime.png")),
            Assets.load<Texture>(assetUrl("assets/art/ingredient-icons-expansion2-anime.png")),
            Assets.load<Texture>(assetUrl("assets/art/ingredient-icons-expansion3-anime.png")),
        ]);
    const root = new Container();
    /** Behind the characters — victory rays must not wash over the plated dish. */
    const backEffects = new Container();
    const effects = new Container();
    const overlay = new Container();
    const background = new Sprite(backgroundTexture);
    const heroFrames = framesFromSheet(heroSheet);
    const enemyFrames = framesFromSheet(enemySheet);
    const heroRig = createBoneRig(heroFrames[0]!, 0.2);
    const foeRig = createBoneRig(enemyFrames[0]!, 1.7);
    const foeGlowRig = createBoneRig(enemyFrames[0]!, 1.7);
    const hero = heroRig.view;
    const foe = foeRig.view;
    const foeGlow = foeGlowRig.view;
    const heroShadow = new Graphics().ellipse(0, 0, 92, 17).fill({ color: 0x39516a, alpha: 0.16 });
    // Covers the widest design layout (720×~1560 plus shake margin).
    const flash = new Graphics().rect(-90, -90, 900, 1840).fill(0xfff6e8);
    const sparks: Spark[] = [];
    const tweens: SceneTween[] = [];
    const ingredientTextures = new Map<string, Texture>();
    let clock = 0;
    let shake = 0;
    let freeze = 0;
    let heroPoseUntil = 0;
    let foePoseUntil = 0;
    let heroBaseY = 0;
    let foeBaseY = 0;
    let heroX = 178;
    let foeX = 525;
    let heroScale = 0.61;
    let foeScale = enemy.id === "vesper" ? 0.5 : 0.59;
    let foePop = 1;
    let heroOffsetX = store.get().reducedMotion ? 0 : -72;
    let foeOffsetX = store.get().reducedMotion ? 0 : 86;
    let reveal = store.get().reducedMotion ? 1 : 0;
    let destroyed = false;

    background.anchor.set(0.5);
    root.addChild(background);
    foeGlow.tint = 0x263755;
    // Pixi 8's WebGPU filter path currently throws bind-group layout errors
    // (program.layout[groupIndex] null) and can spam the console every frame.
    // Prefer a soft scaled tint for the silhouette on WebGPU; keep BlurFilter
    // on WebGL where it is reliable. Detect via renderer.name, never
    // constructor.name — minification renames the class and would route
    // WebGPU builds onto the broken BlurFilter path in prod.
    const rendererName = app.renderer.name.toLowerCase();
    const useBlurGlow = !rendererName.includes("webgpu");
    const glowScale = useBlurGlow ? 1.025 : 1.06;
    const glowAlpha = useBlurGlow ? 0.2 : 0.3;
    const glowBlur = useBlurGlow ? new BlurFilter({ strength: 12, quality: 2, kernelSize: 7 }) : null;
    if (glowBlur) foeGlow.filters = [glowBlur];
    foeGlow.alpha = glowAlpha;
    flash.alpha = 0;
    root.addChild(backEffects, heroShadow, foeGlow, foe, hero, effects, overlay, flash);
    stage.root.addChild(root);

    const ingredientTexture = (ingredient: string): Texture | null => {
        const cached = ingredientTextures.get(ingredient);
        if (cached) return cached;
        const cell = INGREDIENT_CELLS[ingredient];
        if (!cell) return null;
        const sheetByAtlas = {
            base: baseIcons,
            expansion: expansionIcons,
            expansion2: expansion2Icons,
            expansion3: expansion3Icons,
        } as const;
        const sheet = sheetByAtlas[cell.atlas];
        const columns = cell.atlas === "base" ? 4 : 2;
        const size = sheet.source.width / columns;
        const texture = new Texture({
            source: sheet.source,
            frame: new Rectangle(cell.col * size, cell.row * size, size, size),
        });
        ingredientTextures.set(ingredient, texture);
        return texture;
    };

    const setFoeTexture = (texture: Texture) => {
        foeRig.setTexture(texture);
        foeGlowRig.setTexture(texture);
    };

    const addTween = (duration: number, update: (progress: number) => void, complete?: () => void) => {
        const tween: SceneTween = complete
            ? { elapsed: 0, duration, update, complete }
            : { elapsed: 0, duration, update };
        tweens.push(tween);
        update(0);
    };

    const applyCharacterTransforms = () => {
        hero.position.set(heroX + heroOffsetX, heroBaseY);
        hero.scale.set(heroScale);
        hero.alpha = reveal;
        heroShadow.position.set(hero.x, heroBaseY - 2);
        heroShadow.alpha = 0.16 * reveal;

        foe.position.set(foeX + foeOffsetX, foeBaseY);
        foe.scale.set(foeScale * foePop);
        foe.alpha = reveal;
        foeGlow.position.copyFrom(foe.position);
        foeGlow.scale.set(foe.scale.x * glowScale);
        foeGlow.alpha = glowAlpha * reveal;
    };

    const layout = () => {
        const height = stage.designHeight();
        background.x = stage.width / 2;
        background.y = height / 2;
        const cover = Math.max(stage.width / background.texture.width, height / background.texture.height);
        background.scale.set(cover);
        heroBaseY = Math.min(930, height * 0.69);
        foeBaseY = Math.min(750, height * 0.55);
        applyCharacterTransforms();
    };
    layout();
    const offResize = stage.onResize(layout);

    if (!store.get().reducedMotion) {
        addTween(0.72, (progress) => {
            const eased = easeOutBack(progress);
            heroOffsetX = -72 * (1 - eased);
            foeOffsetX = 86 * (1 - eased);
            reveal = Math.min(1, progress * 2.2);
        });
    }

    const burst = (x: number, y: number, color: number, amount = 24, force = 1) => {
        if (store.get().reducedMotion) amount = Math.min(amount, 5);
        for (let i = 0; i < amount; i += 1) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (90 + Math.random() * 260) * force;
            const radius = 3 + Math.random() * 8;
            const view = new Graphics();
            if (i % 3 === 0)
                view.poly([0, -radius, radius * 0.65, 0, 0, radius, -radius * 0.65, 0]).fill({ color, alpha: 0.9 });
            else if (i % 3 === 1) view.circle(0, 0, radius * 0.72).fill({ color, alpha: 0.9 });
            else
                view.roundRect(-radius * 0.55, -radius * 0.3, radius * 1.1, radius * 0.6, radius * 0.25).fill({
                    color,
                    alpha: 0.88,
                });
            view.x = x;
            view.y = y;
            effects.addChild(view);
            sparks.push({
                view,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 70,
                life: 0.4 + Math.random() * 0.45,
                gravity: 440,
                drag: 0.975,
                spin: (Math.random() - 0.5) * 14,
            });
        }
    };

    const impactRing = (x: number, y: number, color: number) => {
        if (store.get().reducedMotion) return;
        const ring = new Graphics().circle(0, 0, 34).stroke({ color, width: 5, alpha: 0.78 });
        ring.position.set(x, y);
        effects.addChild(ring);
        addTween(
            0.42,
            (progress) => {
                const eased = easeOutCubic(progress);
                ring.scale.set(0.35 + eased * 2.4);
                ring.alpha = 1 - progress;
            },
            () => ring.destroy(),
        );
    };

    /** Sauce splatter that clings to the impact point for a beat. */
    const splat = (x: number, y: number, color: number) => {
        if (store.get().reducedMotion) return;
        const blob = new Graphics();
        for (let i = 0; i < 5; i += 1) {
            blob.circle((Math.random() - 0.5) * 62, (Math.random() - 0.5) * 54, 9 + Math.random() * 17).fill({
                color,
                alpha: 0.34,
            });
        }
        blob.position.set(x, y);
        effects.addChild(blob);
        addTween(
            0.85,
            (progress) => {
                blob.alpha = 1 - easeOutCubic(progress);
                blob.scale.set(1 + progress * 0.3);
                blob.y = y + progress * 26;
            },
            () => blob.destroy(),
        );
    };

    const textStyle = (fontSize: number, fill: number) => {
        // Stroked bitmap text has tripped WebGPU bind-group errors on some
        // WebKit builds; keep the outline only on the mature WebGL path.
        const style: ConstructorParameters<typeof TextStyle>[0] = {
            fontFamily: "Avenir Next, Trebuchet MS, sans-serif",
            fontWeight: "800",
            fontSize,
            fill,
            align: "center",
            dropShadow: {
                color: 0x37284a,
                blur: useBlurGlow ? 0 : 2,
                distance: 2,
                angle: Math.PI / 2,
                alpha: 0.85,
            },
        };
        if (useBlurGlow) {
            style.stroke = { color: 0x37284a, width: Math.max(4, fontSize * 0.12) };
        }
        return new TextStyle(style);
    };

    /** Floating combat text (damage numbers, PERFECT PLATE, BLOCKED). */
    const floatText = (x: number, y: number, value: string, options: { size?: number; color?: number } = {}) => {
        const label = new Text({ text: value, style: textStyle(options.size ?? 46, options.color ?? 0xffffff) });
        label.anchor.set(0.5);
        label.position.set(x, y);
        label.rotation = (Math.random() - 0.5) * 0.14;
        overlay.addChild(label);
        const rise = store.get().reducedMotion ? 34 : 92;
        addTween(
            0.85,
            (progress) => {
                const eased = easeOutCubic(progress);
                label.y = y - rise * eased;
                label.scale.set(progress < 0.18 ? 0.6 + (progress / 0.18) * 0.55 : 1.15 - (progress - 0.18) * 0.18);
                label.alpha = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1;
            },
            () => label.destroy(),
        );
    };

    const CONFETTI_COLORS = [0xf6cf69, 0xed6548, 0x71c98b, 0x6fc3dc, 0xe98aa7, 0xf1bd58, 0xffffff];

    /** Paper confetti raining across the whole stage for the victory beat. */
    const confettiFall = (amount: number, delay = 0) => {
        if (store.get().reducedMotion) return;
        window.setTimeout(() => {
            if (destroyed) return;
            for (let i = 0; i < amount; i += 1) {
                const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]!;
                const width = 9 + Math.random() * 11;
                const view = new Graphics();
                if (i % 4 === 0) view.circle(0, 0, width * 0.34).fill({ color, alpha: 0.95 });
                else view.roundRect(-width / 2, -width * 0.3, width, width * 0.6, 2).fill({ color, alpha: 0.95 });
                view.x = Math.random() * stage.width;
                view.y = -40 - Math.random() * 260;
                view.rotation = Math.random() * Math.PI;
                view.scale.set(0.85 + Math.random() * 0.5);
                effects.addChild(view);
                sparks.push({
                    // Fast enough to sweep the full design height (~1560 units)
                    // inside the celebration window — slower and the confetti
                    // never reaches the lower third of the screen at all.
                    view,
                    vx: (Math.random() - 0.5) * 90,
                    vy: 330 + Math.random() * 260,
                    life: 2.1 + Math.random() * 1.1,
                    maxLife: 3.2,
                    flutter: Math.random() * Math.PI * 2,
                    gravity: 155,
                    drag: 0.995,
                    spin: (Math.random() - 0.5) * 7,
                });
            }
        }, delay);
    };

    /** Rotating sunburst behind the finished dish. */
    const victoryRays = (x: number, y: number) => {
        if (store.get().reducedMotion) return;
        const rays = new Graphics();
        for (let i = 0; i < 14; i += 1) {
            const angle = (i / 14) * Math.PI * 2;
            const spread = 0.14;
            rays.poly([
                0,
                0,
                Math.cos(angle - spread) * 520,
                Math.sin(angle - spread) * 520,
                Math.cos(angle + spread) * 520,
                Math.sin(angle + spread) * 520,
            ]).fill({ color: 0xffe4a8, alpha: 0.5 });
        }
        rays.position.set(x, y);
        backEffects.addChild(rays);
        addTween(
            2.4,
            (progress) => {
                rays.rotation = progress * 0.9;
                rays.scale.set(0.3 + easeOutCubic(Math.min(1, progress * 3)) * 0.85);
                // Bloom in fast, then ebb away so the dish stays the subject.
                rays.alpha = progress < 0.16 ? progress / 0.16 : Math.max(0, 1 - (progress - 0.16) / 0.84);
            },
            () => rays.destroy(),
        );
    };

    /** Twinkling stars that pop in around a point over a beat. */
    const twinkles = (x: number, y: number, amount: number) => {
        if (store.get().reducedMotion) return;
        for (let i = 0; i < amount; i += 1) {
            const delay = Math.random() * 1.1;
            const radius = 8 + Math.random() * 7;
            // Four-point sparkle: alternate long spikes and a tight waist.
            const points: number[] = [];
            for (let p = 0; p < 8; p += 1) {
                const angle = (p * Math.PI) / 4 - Math.PI / 2;
                const reach = p % 2 === 0 ? radius : radius * 0.3;
                points.push(Math.cos(angle) * reach, Math.sin(angle) * reach);
            }
            const star = new Graphics().poly(points).fill({ color: i % 3 === 0 ? 0xffffff : 0xf9d978, alpha: 0.95 });
            star.position.set(x + (Math.random() - 0.5) * 380, y + (Math.random() - 0.5) * 330);
            star.alpha = 0;
            effects.addChild(star);
            addTween(
                delay + 0.6,
                (progress) => {
                    const local = (progress * (delay + 0.6) - delay) / 0.6;
                    if (local <= 0) return;
                    star.alpha = Math.sin(Math.min(1, local) * Math.PI);
                    star.scale.set(0.4 + Math.sin(Math.min(1, local) * Math.PI) * 0.9);
                    star.rotation = local * 1.4;
                },
                () => star.destroy(),
            );
        }
    };

    /** The "DISH RESCUED!" card: overshoots in, holds, then lifts away. */
    const victoryTitle = (title: string, subtitle: string, y: number) => {
        const label = new Text({ text: title, style: textStyle(74, 0xfff3cf) });
        const sub = new Text({ text: subtitle, style: textStyle(30, 0xffffff) });
        label.anchor.set(0.5);
        sub.anchor.set(0.5);
        label.position.set(stage.width / 2, y);
        sub.position.set(stage.width / 2, y + 58);
        overlay.addChild(label, sub);
        const reduced = store.get().reducedMotion;
        addTween(
            reduced ? 1.4 : 2.15,
            (progress) => {
                // 0–12% overshoot in, hold, last 18% lift and fade.
                const entry = Math.min(1, progress / 0.12);
                const exit = progress > 0.82 ? (progress - 0.82) / 0.18 : 0;
                const scale = reduced ? 1 : easeOutBack(entry);
                label.scale.set(scale);
                sub.scale.set(Math.min(1, entry * 1.4));
                label.y = y - exit * 70;
                sub.y = y + 58 - exit * 70;
                label.alpha = 1 - exit;
                sub.alpha = (1 - exit) * 0.95;
            },
            () => {
                label.destroy();
                sub.destroy();
            },
        );
    };

    const squashFoe = (strength: number) => {
        if (store.get().reducedMotion) return;
        addTween(0.38, (progress) => {
            const wave = Math.sin(progress * Math.PI);
            foeOffsetX = wave * strength * 9;
        });
    };

    /** Ingredient flight time; the Guard cue is scheduled against it. */
    const projectileSeconds = () => (store.get().reducedMotion ? 0.15 : 0.42);

    const projectile = (event: Extract<CombatEvent, { type: "card" }>) => {
        heroRig.setTexture(heroFrames[1]!);
        heroPoseUntil = clock + 0.22;
        if (!store.get().reducedMotion) {
            addTween(0.3, (progress) => {
                const wave = Math.sin(progress * Math.PI);
                heroOffsetX = wave * 18;
            });
        }
        const meta = FLAVOR_META[event.card.flavor];
        const color = Number.parseInt(meta.color.slice(1), 16);
        const shot = new Container();
        const glow = new Graphics().circle(0, 0, 42).fill({ color, alpha: 0.22 });
        const texture = ingredientTexture(event.card.ingredient);
        if (texture) {
            const body = new Sprite(texture);
            body.anchor.set(0.5);
            body.scale.set(124 / texture.height);
            shot.addChild(glow, body);
        } else {
            const body = new Graphics().circle(0, 0, 13).fill(color).circle(-4, -4, 4).fill(0xffffff);
            shot.addChild(glow, body);
        }
        shot.x = hero.x + 74;
        shot.y = hero.y - 255;
        effects.addChild(shot);
        const startX = shot.x;
        const startY = shot.y;
        const duration = projectileSeconds();
        let elapsed = 0;
        let trailStep = -1;
        const fly = (ticker: Ticker) => {
            try {
                elapsed += ticker.deltaMS / 1000;
                const t = Math.min(1, elapsed / duration);
                const eased = easeOutCubic(t);
                shot.x = startX + (foe.x - startX) * eased;
                shot.y = startY + (foe.y - 230 - startY) * t - Math.sin(t * Math.PI) * 130;
                shot.rotation += ticker.deltaMS * 0.012;
                shot.scale.set(0.7 + t * 0.6);
                const nextTrailStep = Math.floor(t * 10);
                if (nextTrailStep !== trailStep && !store.get().reducedMotion) {
                    trailStep = nextTrailStep;
                    burst(shot.x, shot.y, color, 2, 0.2);
                }
                if (t < 1) return;
                app.ticker.remove(fly);
                shot.destroy({ children: true });
                setFoeTexture(enemyFrames[2]!);
                foePoseUntil = clock + (event.combo ? 0.8 : 0.35);
                shake = event.combo ? 18 : 8;
                burst(foe.x, foe.y - 230, color, event.combo ? 60 : 26, event.combo ? 1.5 : 1);
                impactRing(foe.x, foe.y - 230, color);
                splat(foe.x, foe.y - 210, color);
                squashFoe(event.combo ? 1.4 : 0.8);
                if (event.combo) {
                    if (!store.get().reducedMotion) {
                        freeze = 0.09;
                        flash.alpha = 0.5;
                    }
                    floatText(foe.x, foe.y - 250, `${event.damage}`, { size: 88, color: 0xf6cf69 });
                } else {
                    floatText(foe.x + (Math.random() - 0.5) * 60, foe.y - 270, `${event.damage}`, {
                        size: event.matched ? 52 : 44,
                        color: event.matched ? 0xffe9b0 : 0xffffff,
                    });
                }
                audioManager.play(event.combo ? "reward" : "bounce");
                void runtimeServices.haptic(event.combo ? "success" : "light");
                // The plated-dish frame (enemyFrames[3]) is reserved for real
                // victory — mid-fight Perfect Plates keep the living monster.
            } catch (error) {
                console.warn("[combat] projectile frame failed", error);
                app.ticker.remove(fly);
                if (!shot.destroyed) shot.destroy({ children: true });
            }
        };
        app.ticker.add(fly);
    };

    const onEvent = (event: CombatEvent) => {
        if (event.type === "card") {
            projectile(event);
            // Guard lands just after the ingredient does, so a defensive card
            // reads in causal order: throw, thwack, shield up.
            if (event.card.guard > 0) {
                window.setTimeout(
                    () => {
                        if (destroyed) return;
                        audioManager.play("guard");
                        void runtimeServices.haptic("light");
                    },
                    projectileSeconds() * 1000 + 140,
                );
            }
        }
        if (event.type === "enemy") {
            setFoeTexture(enemyFrames[1]!);
            foePoseUntil = clock + 0.45;
            if (!store.get().reducedMotion) {
                addTween(0.48, (progress) => {
                    foeOffsetX = -Math.sin(progress * Math.PI) * 48;
                });
            }
            window.setTimeout(() => {
                if (destroyed) return;
                heroRig.setTexture(heroFrames[3]!);
                heroPoseUntil = clock + 0.45;
                shake = 12;
                burst(hero.x, hero.y - 240, 0x4aa8ff, 28);
                if (event.damage > 0) {
                    floatText(hero.x, hero.y - 300, `-${event.damage}`, { size: 54, color: 0xff7d78 });
                } else {
                    floatText(hero.x, hero.y - 300, "BLOCKED!", { size: 44, color: 0x9fd7ff });
                }
                if (event.blocked > 0 && event.damage > 0) {
                    floatText(hero.x + 8, hero.y - 236, `◇ ${event.blocked} BLOCKED`, {
                        size: 26,
                        color: 0x9fd7ff,
                    });
                }
                // Fully blocked reads as a clink, not as taking a hit — and the
                // hand should feel the difference too: a sharp error buzz when
                // HP actually goes down, a duller thud when Guard ate it.
                audioManager.play(event.damage > 0 ? "error" : "block");
                void runtimeServices.haptic(event.damage > 0 ? "error" : "medium");
            }, 280);
        }
        if (event.type === "defeat") {
            // combat.ts has always emitted this; the scene never listened, so
            // losing a run was the one outcome with no sound and no feel.
            // Scheduled past the killing blow's own beat (280ms) and given a
            // heavy rather than an error pattern — fired together they stacked
            // into a single mushy buzz instead of "hit, then you lost".
            window.setTimeout(() => {
                if (destroyed) return;
                heroRig.setTexture(heroFrames[3]!);
                heroPoseUntil = clock + 1.6;
                shake = 14;
                burst(hero.x, hero.y - 250, 0x9aa6bd, 26, 0.8);
                audioManager.play("error");
                void runtimeServices.haptic("heavy");
            }, 460);
        }
        if (event.type === "surge") {
            window.setTimeout(() => {
                if (destroyed) return;
                if (!store.get().reducedMotion) flash.alpha = 0.32;
                shake = Math.max(shake, 12);
                burst(foe.x, foe.y - 240, event.color, 42, 1.25);
                impactRing(foe.x, foe.y - 240, event.color);
                floatText(foe.x, foe.y - 290, event.label, { size: 46, color: 0xffffff });
                audioManager.play("error");
                void runtimeServices.haptic("medium");
            }, 540);
        }
        if (event.type === "victory") {
            // Staged celebration. combat.winEncounter() holds the reward screen
            // back until this finishes — keep the two durations in step.
            const dishX = foe.x;
            const dishY = foe.y - 230;
            setFoeTexture(enemyFrames[3]!);
            flash.alpha = 0.55;
            shake = 15;
            burst(dishX, dishY, 0xf6cf69, 80, 1.7);
            burst(dishX, foe.y - 150, 0xffffff, 24, 0.7);
            impactRing(dishX, dishY, 0xf6cf69);
            victoryRays(dishX, dishY);
            audioManager.play("reward");
            void runtimeServices.haptic("success");

            if (!store.get().reducedMotion) {
                // The dish leaps up, overshoots, then settles onto the plate.
                addTween(1.15, (progress) => {
                    foePop =
                        progress < 0.45
                            ? 1 + easeOutBack(progress / 0.45) * 0.22
                            : 1.22 - easeOutCubic((progress - 0.45) / 0.55) * 0.22;
                });
            }

            // Bea returns to her planted idle for the celebration. Frame 2 is a
            // throw follow-through — mid-lunge with a leg up, which reads as
            // off-balance rather than triumphant when it's held for 2s.
            heroRig.setTexture(heroFrames[0]!);
            heroPoseUntil = clock + 2.3;

            window.setTimeout(() => {
                if (destroyed) return;
                impactRing(dishX, dishY, 0xffffff);
                twinkles(dishX, dishY, 12);
                twinkles(hero.x, hero.y - 260, 5);
            }, 240);

            confettiFall(34);
            confettiFall(26, 420);
            confettiFall(18, 900);

            window.setTimeout(() => {
                if (destroyed) return;
                audioManager.play("start");
                // Below the dish, in the floor space the hidden hand vacates —
                // over the dish it buries the thing being celebrated.
                const titleY = Math.min(dishY + 450, stage.designHeight() - 200);
                victoryTitle("DISH RESCUED!", `${enemy.name} is plated`, titleY);
            }, 430);
        }
    };
    const offCombat = combat.subscribe(onEvent);

    const tick = (ticker: Ticker) => {
        const dt = Math.min(0.04, ticker.deltaMS / 1000);
        // The combo flash decays even during hit-stop so the freeze reads as
        // impact, not a hang.
        if (flash.alpha > 0) flash.alpha = Math.max(0, flash.alpha - dt * 2.6);
        if (freeze > 0) {
            freeze -= dt;
            return;
        }
        clock += dt;
        if (clock > heroPoseUntil && hero.texture !== heroFrames[0]) heroRig.setTexture(heroFrames[0]!);
        if (clock > foePoseUntil && foe.texture !== enemyFrames[3]) setFoeTexture(enemyFrames[0]!);
        if (!store.get().reducedMotion) {
            heroRig.breathe(clock, 1);
            if (foe.texture === enemyFrames[3]) {
                foeRig.reset();
                foeGlowRig.reset();
            } else {
                const strength = enemy.id === "vesper" ? 0.85 : 1.15;
                foeRig.breathe(clock, strength);
                foeGlowRig.breathe(clock, strength);
            }
        } else {
            heroRig.reset();
            foeRig.reset();
            foeGlowRig.reset();
        }
        for (let i = tweens.length - 1; i >= 0; i -= 1) {
            const tween = tweens[i]!;
            tween.elapsed += dt;
            const progress = Math.min(1, tween.elapsed / tween.duration);
            tween.update(progress);
            if (progress >= 1) {
                tween.complete?.();
                tweens.splice(i, 1);
            }
        }
        applyCharacterTransforms();
        if (shake > 0.2) {
            root.x = (Math.random() - 0.5) * shake;
            root.y = (Math.random() - 0.5) * shake;
            shake *= 0.82;
        } else {
            root.position.set(0);
        }
        for (let i = sparks.length - 1; i >= 0; i -= 1) {
            const spark = sparks[i]!;
            spark.life -= dt;
            spark.vy += spark.gravity * dt;
            spark.vx *= spark.drag;
            spark.view.x += spark.vx * dt;
            spark.view.y += spark.vy * dt;
            spark.view.rotation += dt * spark.spin;
            if (spark.maxLife) {
                spark.view.x += Math.sin(clock * 4.5 + spark.flutter!) * 42 * dt;
                spark.view.alpha = Math.min(1, spark.life / (spark.maxLife * 0.3));
            } else {
                spark.view.alpha = Math.max(0, spark.life * 1.8);
                spark.view.scale.set(Math.max(0.1, spark.life + 0.15));
            }
            if (spark.life <= 0) {
                spark.view.destroy();
                sparks.splice(i, 1);
            }
        }
    };
    app.ticker.add(tick);

    return {
        destroy() {
            destroyed = true;
            app.ticker.remove(tick);
            offResize();
            offCombat();
            for (const frame of [...heroFrames, ...enemyFrames]) frame.destroy(false);
            for (const texture of ingredientTextures.values()) texture.destroy(false);
            root.destroy({ children: true });
            glowBlur?.destroy();
        },
    };
}
