# Materials reference — PBR values

*Canonical source for the metalness/roughness workflow used by every cube and progression sprite. PBR values flow from this file into Blender, never the reverse.*

The values below were iterated to portfolio quality on `gold_good_delivery_single_final.py` (renamed `final` because they were locked after a v1→v3 iteration). They supersede any earlier table in `docs/SPEC.md` — that earlier table held design-time guesses (e.g. roughness 0.12 for gold) which did not survive iteration against real reference. SPEC.md is being updated to match this file.

## Gold — 24k

```
Base colour       (1.000, 0.770, 0.340) linear sRGB    # warm yellow
Metallic          1.0
Roughness         0.20  (base, varied procedurally)
Specular          0.5
Normal            procedural noise → bump
Bump strength     0.025
Bump distance     0.0002
```

**Procedural roughness:** Noise (scale 6.0, detail 4.0) → MapRange(0–1 → 0.15–0.28) → Roughness. Gives subtle macro variation across the surface; reads as cast gold rather than mirror-polished.

**Procedural normal:** Noise (scale 120.0, detail 12.0, roughness 0.6) → Bump (strength 0.025, distance 0.0002) → Normal. Fine-grain micro-texture; only visible at close render distance, prevents the "perfectly smooth plastic" look at thumbnail sizes.

**Tex Coord input:** Object (not UV) on both noise nodes — keeps the noise stable as the geometry scales.

## Silver, platinum, copper — locked when authored

| Material | Base colour (linear sRGB) | Metallic | Roughness | Notes |
|---|---|---|---|---|
| Silver | (0.972, 0.960, 0.915) | 1.0 | 0.08 | Mirror-polished feel; slightly cooler than white |
| Platinum | (0.673, 0.637, 0.585) | 1.0 | 0.15 | Cooler grey than silver, less reflective |
| Copper | (0.722, 0.451, 0.200) | 1.0 | 0.22 | Patina variant: (0.654, 0.455, 0.337), roughness 0.45 |

Silver/platinum/copper variants will inherit the gold procedural noise + bump rig with material-specific scale tweaks when authored. Add their procedural details to this file at that point.

## Steel — drums, tankers, vessel sprites

| Material | Base colour | Metallic | Roughness | Notes |
|---|---|---|---|---|
| Steel | (0.290, 0.336, 0.408) | 0.9 | 0.35 | With per-asset paint and rust passes layered on top |

## Render settings (locked)

| Setting | Value |
|---|---|
| Engine | Cycles |
| Device | CPU (Intel Mac compatibility) |
| Samples | 512 |
| Denoising | On |
| Resolution | 1600 × 1600 |
| Film transparent | True |
| View transform | Standard |
| File format | PNG, RGBA |

## HDRI environments

| HDRI | Source | Strength | Use case |
|---|---|---|---|
| `studio_small_09_4k.exr` | Poly Haven (CC0) | 0.6 | Three-quarter rig template (`rig_three_quarter.py`) |
| `brown_photostudio_02_4k.exr` | Poly Haven (CC0) | 1.0 | Production gold renders (warmer fall-off) |

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
| Key | Area | 120 | 2.0 | (1.0, 0.92, 0.78) ~5500 K warm | (1.2, −1.5, 2.5) |
| Fill | Area | 60 | 3.0 | (1.0, 0.95, 0.85) | (1.5, 0.5, 0.8) |
| Rim | Area | 40 | 1.5 | (1.0, 0.88, 0.7) | (−1.0, 1.2, 1.5) |

All three lights aim at the object centre. Energy values assume the object's longest dimension is normalised to 0.5 m in Blender units.
