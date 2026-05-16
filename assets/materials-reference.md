# Materials reference — PBR values

*Canonical source for the metalness/roughness workflow used by every cube and progression sprite. PBR values flow from this file into Blender, never the reverse.*

The values below were iterated to portfolio quality on `gold_good_delivery_single_final.py` (renamed `final` because they were locked after a v1→v3 iteration). They supersede any earlier table in `docs/SPEC.md` — that earlier table held design-time guesses (e.g. roughness 0.12 for gold) which did not survive iteration against real reference. SPEC.md is being updated to match this file.

## Gold — 24k

```
Base colour       (0.920, 0.550, 0.080) linear sRGB    # deep saturated honey
Metallic          1.0
Roughness         0.12  (base, varied procedurally 0.08–0.22)
Specular          0.5
Normal            fine bump (0.025) + macro bump (0.07) stacked
```

**Procedural roughness:** Noise (scale 6.0, detail 4.0) → MapRange(0–1 → 0.08–0.22) → Roughness. Widened 2026-05-16 from the 0.05–0.12 mirror-polish band — too uniform read as chrome plating; the wider band gives patches of polish + patches of slightly duller cast that read as proper bullion under the high-contrast lighting.

**Procedural normal:** Two bumps stacked. Fine grain: noise (scale 120, detail 12, roughness 0.6) → bump (strength 0.025, distance 0.0002). Macro: noise (scale 14, detail 6, roughness 0.55) → bump (strength 0.07, distance 0.0008) → fine bump's Normal output as input. Added 2026-05-16 — fine grain alone made the cube read as a chrome mirror; the macro bump introduces the subtle wave/flow of poured-cast metal without losing the cube's shape.

**Tex Coord input:** Object (not UV) on every noise node — keeps the noise stable as the geometry scales.

**2026-05-16 re-tune log:** Base colour pushed from (1.0, 0.77, 0.34) → (0.95, 0.62, 0.18) → (0.92, 0.55, 0.08) over two iterations. The earlier values rendered as pale champagne/brass even under Filmic; the deeper saturation was needed once the HDRI was dropped to 0.3 strength (which removed the bright neutral wash that was flattening the base colour).

## Silver

```
Base colour       (0.780, 0.780, 0.760) linear sRGB    # neutral, slightly warm grey
Metallic          1.0
Roughness         0.12  (base, varied procedurally 0.08–0.22)
Specular          0.5
Normal            fine bump (0.025) + macro bump (0.07) stacked
```

Inherits the gold procedural rig wholesale (same noise scales, same macro bump). Only the base colour and lighting are silver-specific.

**2026-05-16 re-tune log:** Knocked the base colour from (0.972, 0.960, 0.915) → (0.86, 0.85, 0.82) → (0.78, 0.78, 0.76) — the earlier near-white base rendered as chrome plating because real silver looks bright because of what it reflects, not because it's intrinsically white. The darker base lets the strong directional key produce the white-hot highlights against deep shadow that read as silver bullion.

## Platinum, copper — locked when authored

| Material | Base colour (linear sRGB) | Metallic | Roughness | Notes |
|---|---|---|---|---|
| Platinum | (0.673, 0.637, 0.585) | 1.0 | 0.15 | Cooler grey than silver, less reflective |
| Copper | (0.722, 0.451, 0.200) | 1.0 | 0.22 | Patina variant: (0.654, 0.455, 0.337), roughness 0.45 |

Platinum/copper variants will inherit the gold + silver procedural noise + bump rig with material-specific scale tweaks when authored. Add their procedural details to this file at that point.

## Plutonium-238

```
Base colour       (0.74, 0.72, 0.67) linear sRGB    # tarnished silver, faint warm cast
Metallic          0.95
Roughness         0.18  (base, varied procedurally)
Specular          0.5
Normal            procedural noise → bump
Bump strength     0.025                             # noble-metal standard
Bump distance     0.0002
```

**Calibration reference:** DOE Milliwatt RTG fuel-pellet sample (lab-clean condition, bottom / side / top views). Real Pu-238 metal at this finish reads as tarnished bullion silver with a faint warm cast and visible specular response — distinctly metallic, not chalky. The dramatic dark grey-brown patina in some archival photos is decades-aged storage material, not what we want for a panel hero. An earlier round at metalness 0.88 / roughness 0.30 / oxide-mix 0.35 produced a white-plaster look; tightened on 2026-05-09 against the lab-sample reference.

**Why metalness 0.95 (not 1.0):** Pu's 5f electron structure makes it a marginally poorer optical metal than the noble metals; in practice the difference at sprite scale is subtle, but the value sits 0.05 below silver/gold's 1.0 to encode the physics. Going below 0.90 reintroduces the chalky look at this roughness.

**Procedural roughness:** Noise (scale 6.0, detail 4.0) → MapRange(0–1 → 0.14–0.26) → Roughness. Sits between silver's 0.05–0.12 mirror polish and gold's pre-retune cast satin (0.15–0.28). Tight enough to keep specular response, loose enough to render visible non-uniformity across the faces. If the surface reads as flat plaster, the lower bound is too high; if it reads as rolled bullion, the lower bound is too low.

**Procedural normal:** Noise (scale 120.0, detail 12.0, roughness 0.6) → Bump (strength 0.025, distance 0.0002) → Normal. Same fine-grain micro-texture as the noble metals; the lab-sample surface is smooth metal at this scale, not industrial casting.

**Subtle base-colour variation:** Low-frequency noise (scale 3.0, detail 2.0) mixes a faint warmer patina tint (0.66, 0.62, 0.55) into up to ~18 % of patches via MapRange + MixRGB. Keeps the surface from reading as flat painted grey while staying well short of the dark oxide of aged samples.

**Tex Coord input:** Object on all noise nodes — same convention as the noble metals.

**Note on emission:** No emissive shader baked in. The cube's incandescent appearance at higher masses is composed in CSS via `<CubeGlowOverlay>` (radial halo) + `filter: drop-shadow()` + `filter: brightness()` on the sprite. A single bare-metal sprite covers the full slider range. If a future revisit wants pre-baked emissive variants for gallery thumbnails, render with `bsdf.inputs["Emission Strength"].default_value` set above 0 and varying the emission colour along the blackbody ladder — but the production pipeline does not need them.

## Steel — drums, tankers, vessel sprites

| Material | Base colour | Metallic | Roughness | Notes |
|---|---|---|---|---|
| Steel | (0.290, 0.336, 0.408) | 0.9 | 0.35 | With per-asset paint and rust passes layered on top |

## Render settings (locked)

| Setting | Value |
|---|---|
| Engine | Cycles |
| Device | CPU (Intel Mac compatibility) |
| Samples | 512 (main) / 128 (shadow pass) |
| Max bounces | 4 (diffuse 2, glossy 4) |
| Denoising | On |
| Resolution | 1600 × 1600 |
| Film transparent | True |
| View transform | Filmic |
| File format | PNG, RGBA |

**Bounce cap (2026-05-16):** Default 12 bounces made the shadow catcher pass run 60+ min for gold/silver because the wider roughness band + macro bump exploded the indirect-light cost. 4 max bounces is plenty for hero-quality metallic cubes and cuts shadow time by ~4×.

**Shadow pass samples (2026-05-16):** Dropped from 512 to 128 — denoiser handles low-frequency contact shadows well and the cube itself uses 512.

**View transform (2026-05-16):** Switched from `Standard` to `Filmic`. Standard clipped the top-face highlight to flat white; Filmic preserves the warm gold tint even in the brightest specular hot spot.

## HDRI environments

| HDRI | Source | Strength | Use case |
|---|---|---|---|
| `studio_small_09_4k.exr` | Poly Haven (CC0) | 0.6 | Three-quarter rig template (`rig_three_quarter.py`) |
| `brown_photostudio_02_4k.exr` | Poly Haven (CC0) | 0.3 | Production gold / silver cubes (lets directional area lights set the look) |

**HDRI strength (2026-05-16):** Dropped from 1.0 to 0.3 for the cube renders. At 1.0 the environment was washing every face with bright neutral tones, flattening saturation (gold) and dynamic range (silver). At 0.3 the area lights dominate and the cube picks up the reference's chiaroscuro.

HDRIs are not committed (large binary inputs). Pull from `polyhaven.com` to project root before rendering — paths are absolute in the Python pipeline.

## Camera rig — three-quarter

```
Elevation   25°
Azimuth     30°
Distance    1.0 m (production); 2.5 m (rig template default)
Lens        50 mm perspective
Focus       Object centre at (0, 0, dims.z / 2)
```

Source: `scripts/blender/rig_three_quarter.py`. The `assets/blender/_rigs/three_quarter.blend` is regenerated from this script — do not edit the .blend by hand without porting changes back.

## Lighting (locked for gold; tune per material later)

| Light | Type | Energy | Size | Colour | Position |
|---|---|---|---|---|---|
| Key | Area | 220 | 2.0 | (1.0, 0.92, 0.78) ~5500 K warm | (1.2, −1.5, 2.5) |
| Fill | Area | 30 | 3.0 | (1.0, 0.95, 0.85) | (1.5, 0.5, 0.8) |
| Rim | Area | 40 | 1.5 | (1.0, 0.88, 0.7) | (−1.0, 1.2, 1.5) |

All three lights aim at the object centre. Energy values assume the object's longest dimension is normalised to 0.5 m in Blender units.

**2026-05-16 re-tune:** Key boosted 120 → 220 and Fill halved 60 → 30 alongside the HDRI drop to 0.3. The boost compensates for less ambient contribution; the fill cut keeps shadows reference-deep instead of washing them with secondary fill.
