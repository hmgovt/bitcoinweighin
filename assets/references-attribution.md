# Reference Library Attribution

This document records the source, license, and canonical sizing for every entry in the scale reference library used by Bitcoin Weigh-In's cube-mode rendering. Each animal listed below is rendered through the standard Blender pipeline (see `scripts/blender/` and `assets/materials-reference.md`) and stored at `assets/blender/references/{id}/`.

Where a reference uses a CC-BY licensed model, the required attribution string is recorded under "Required attribution" and must be reproduced on the methodology page or footer of the published site.

Sizing values are sourced from authoritative references (Wikipedia, breed standards, biological literature). Where breed or species variation is significant, the chosen value is noted alongside its rationale.

---

## Sourced

### Shiba Inu

- **id:** `shiba_inu`
- **realSizeMetres:** 0.4
- **measurementAxis:** height
- **Sizing source:** Japanese Shiba Inu breed standard, shoulder height 38–41 cm. 0.4 m chosen as canonical mid-range value.
- **Model source:** [Animated Dog, Shiba Inu](https://sketchfab.com/3d-models/animated-dog-shiba-inu-9abfce885a834399b2c3ccaed51cd474) by [quander](https://sketchfab.com/quander) on Sketchfab
- **License:** CC BY 4.0
- **Required attribution:** This work is based on "Animated Dog, Shiba Inu" (https://sketchfab.com/3d-models/animated-dog-shiba-inu-9abfce885a834399b2c3ccaed51cd474) by quander (https://sketchfab.com/quander) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
- **Local path:** `assets/blender/references/shiba_inu/`
- **Format:** glTF (animated)
- **Notes:** Animated source; static sprite rendered from a specific frame chosen for the alert sitting pose. Same `.gltf` is also served at `static/models/references/shiba_inu/scene.gltf` for the easter egg playback (hover, sustained tap, or `?easter=doge` URL parameter).
- **Downloaded:** 2026-04-26

---

## To be sourced

The following 11 animals complete the reference library. Each one needs to be located on Sketchfab (or Quaternius / BlenderKit / Poly Haven where available), downloaded as glTF or glb, placed at `assets/blender/references/{id}/`, and recorded with a complete entry in this file before the asset session can render it.

Look for: pose neutrality (side or three-quarter, no action poses), naturalistic colouration, PBR materials, triangle count between 5k and 200k, and CC-BY 4.0 or CC0 licensing only. Skip CC-BY-NC and CC-BY-SA — these aren't compatible with the project's commercial deployment.

### Blue whale

- **id:** `blue_whale`
- **realSizeMetres:** 27
- **measurementAxis:** length
- **Sizing source:** Wikipedia: average adult length 24–30 m; 27 m chosen as mid-range.
- **Slider position:** beyond cube's current reach; reserved as futureproofing for BTC's eventual purchasing-power growth against gold.
- **Pose preference:** graceful side-profile, mouth closed, no breaching or action shots.
- **Local path:** `assets/blender/references/blue_whale/` (TBC)

### Sperm whale

- **id:** `sperm_whale`
- **realSizeMetres:** 16
- **measurementAxis:** length
- **Sizing source:** Average adult male sperm whale length ~16 m.
- **Slider position:** beyond cube's current reach; futureproofing.
- **Pose preference:** side-profile, distinctive square head silhouette must be readable.

### Humpback whale

- **id:** `humpback_whale`
- **realSizeMetres:** 14
- **measurementAxis:** length
- **Sizing source:** Adult humpback whale average length ~14 m.
- **Slider position:** beyond cube's current reach; futureproofing.
- **Pose preference:** side-profile with characteristic long pectoral fins visible.

### African elephant

- **id:** `elephant`
- **realSizeMetres:** 6
- **measurementAxis:** length
- **Sizing source:** Adult male African bush elephant body length ~6 m (head to tail base, excluding trunk and tail).
- **Slider position:** ~10M BTC and up; the largest reference reachable at current BTC purchasing power.
- **Pose preference:** standing, side-profile, trunk down or in neutral position.

### Horse

- **id:** `horse`
- **realSizeMetres:** 1.6
- **measurementAxis:** height
- **Sizing source:** Average riding-horse withers height ~1.6 m. Chosen over draft horse (1.8 m+) as the more familiar reference.
- **Slider position:** ~500k–10M BTC.
- **Pose preference:** standing, side-profile, neutral stance.

### Large dog (Akita-like)

- **id:** `large_dog`
- **realSizeMetres:** 0.7
- **measurementAxis:** height
- **Sizing source:** Akita Inu shoulder height ~67 cm rounded to 0.7 m. Could equally be a wolf or generic large breed.
- **Slider position:** ~30k–500k BTC. Sits one tier above the Shiba; deliberately breed-ambiguous to avoid duplicating the Doge meme.
- **Pose preference:** standing, side or three-quarter view, alert posture.

### Cat

- **id:** `cat`
- **realSizeMetres:** 0.25
- **measurementAxis:** height
- **Sizing source:** Domestic cat shoulder height ~25 cm.
- **Slider position:** ~1k–5k BTC.
- **Pose preference:** sitting or standing, side or three-quarter view. Avoid sleeping or curled poses (height becomes ambiguous).

### Mouse

- **id:** `mouse`
- **realSizeMetres:** 0.08
- **measurementAxis:** length
- **Sizing source:** House mouse body length excluding tail ~8 cm.
- **Slider position:** ~10–100 BTC.
- **Pose preference:** standing on all fours, side-profile, tail visible but not extended dramatically.

### Bee

- **id:** `bee`
- **realSizeMetres:** 0.015
- **measurementAxis:** length
- **Sizing source:** Honeybee body length ~15 mm.
- **Slider position:** ~0.1–10 BTC.
- **Pose preference:** in flight or perched, wings visible, side-profile.

### Ant

- **id:** `ant`
- **realSizeMetres:** 0.005
- **measurementAxis:** length
- **Sizing source:** Common worker ant body length ~5 mm.
- **Slider position:** ~0.001–0.1 BTC.
- **Pose preference:** standing, side-profile, antennae and legs distinguishable.

### Flea

- **id:** `flea`
- **realSizeMetres:** 0.002
- **measurementAxis:** length
- **Sizing source:** Cat flea body length ~2 mm.
- **Slider position:** ~0.00001–0.001 BTC. The library's bottom anchor.
- **Pose preference:** side-profile (the iconic flea silhouette), legs extended.
- **Sourcing note:** May be hard to find a well-modelled flea. If no acceptable Sketchfab option exists under CC-BY or CC0, author one in Blender as a stylised primitive — a 2 mm reference is essentially a pictogram at the cube's display sizes.

---

## Licensing summary

All sourced models must be CC0 or CC BY 4.0. Other licenses (CC-BY-NC, CC-BY-SA, proprietary) are not compatible with this project's commercial deployment and must not be used.

CC0 sources require no attribution but provenance is still recorded above for completeness.
CC-BY 4.0 sources require attribution in the form recorded above. The methodology page or site footer must reproduce these strings.

## Render pattern

All animal references are rendered through the canonical pipeline established in `scripts/blender/gold_cube.py`. Per DECISIONS.md 2026-04-26:

- Render target: 0.5 m longest dimension in Blender (for lighting-rig consistency).
- Real-world size tagged via `realSizeMetres` in `src/lib/scale-references.json`.
- Runtime renderer applies the cube's relative scale based on `realSizeMetres`.
- Intrinsic transparent margin baked into the sprite at render time (cube/animal occupies ~70% of canvas; same intrinsic-margin rule established for the gold cube).
- Camera rig: three-quarter, 25° elevation, 30° azimuth, perspective ~50 mm focal length.
- HDRI: Poly Haven `studio_small_09`.
- Output: WebP at 1600×1600 @ 2× density, transparent background, separate greyscale contact-shadow PNG.