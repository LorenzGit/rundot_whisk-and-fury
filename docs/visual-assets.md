# Whisk & Fury 0.2.1 visual asset brief

## Art direction

- **Name:** Sunlit Shōjo Kitchen Adventure.
- **Palette:** whipped-cream white, peach, apricot, lemon, mint, sky blue, raspberry and warm caramel. No black-dominant surfaces.
- **Lighting:** bright late-morning daylight with airy bounce light and small warm highlights.
- **Shape language:** expressive anime characters with readable silhouettes, elegant adult proportions, lively eyes and comic food-monster shapes.
- **Rendering:** polished 2D anime game illustration: clean colored linework, cel shading plus soft painted highlights. No photorealism, heavy oil-paint texture or murky brown grading.
- **UI:** ivory recipe cards, coral primary actions, mint/sky status colors, navy text, rounded enamel-and-paper materials. Fixed card dimensions at every hand count.
- **Motion:** ground-locked mesh skeletons with heel, hip, chest and head influence; quiet upper-body breathing; eased entrances, anticipation, arcing throws, squash/recoil, layered food particles and restrained camera impact. Whole-character floating is forbidden.
- **Character separation:** monsters use a close dark-navy blurred silhouette glow that follows the deformed mesh. Detached ground ovals are forbidden.
- **Permitted sources:** newly generated original assets only. Existing project art may be retained in `art-source/classic/` for history but is not a style reference.

## Deliverables

| Asset | Purpose | Dimensions | Alpha | Final path |
| --- | --- | ---: | --- | --- |
| Sunlit kitchen arena | Core battle background | 1024×1536 | No | `public/assets/art/sunlit-kitchen-arena.jpg` |
| Chef Bea poses | Idle / throw / follow-through / hit | 2×2 square sheet | Yes | `public/assets/art/chef-bea-anime.png` |
| Four boss sheets | Idle / attack / hit / plated | 2×2 square sheets | Yes | `public/assets/art/*-anime.png` |
| Three additional recipe sheets | Idle / attack / hit / plated | 2×2 square sheets | Yes | `public/assets/art/*-anime.png` |
| Conservatory kitchen | Citrus and garden battles | 1024×1536 | No | `public/assets/art/conservatory-kitchen-arena.jpg` |
| Rooftop patisserie | Macaron and dessert battles | 1024×1536 | No | `public/assets/art/rooftop-patisserie-arena.jpg` |
| Seaside festival kitchen | Paella battle | 1024×1536 | No | `public/assets/art/seaside-festival-arena.jpg` |
| Key art | Menu, splash, desktop backdrop | 1536×1024 | No | `public/assets/art/key-art-anime.jpg` |
| Thumbnail | RUN catalog | 512×512 JPG | No | `public/thumbnail.jpg` |

## Production

- Generated with the ChatGPT-app Codex image workflow using the owner’s standing ChatGPT-quota approval.
- Character sheets use a flat `#FF00FF` field followed by local chroma removal with no recovered shadows.
- New recipe monsters: Citrus Basilisk, Macaron Mimic and Paella Phoenix. Each must read as food first, monster second, with a stable flat base suitable for the ground-locked rig.
- Every generated file is inspected before integration; generated text, borders, embedded UI and ground shadows are rejected.

## Acceptance

- Characters remain clear at approximately 240–330 design pixels tall.
- Idle feet, pots, plates and serving vessels remain on their shadow plane. Only vertices above the lower-body lock zone may breathe or sway.
- Recipe labels, flavor pips, battle copy and HUD shapes occupy separate layout boxes at the narrowest supported viewport; text may not sit on borders or collide with neighboring pills.
- Arena preserves quiet staging space and remains bright behind both silhouettes.
- Gameplay at 390×844 and 430×932 keeps the enemy, player, recipe sequence, fixed-size hand and end-turn action visible without overlap.
- A three-card hand must use the same card width and height as a five-card hand; extra width becomes centering or overlap, never card growth.
- Thumbnail must remain legible at 96×96 and measure exactly 512×512 JPG.
