# Stage 4 — Wire up gold and silver

*Read `00-OVERVIEW.md` first. Stages 1, 2, and 3 must be confirmed complete.*

Two cube-mode commodities, mechanically identical except for density value, sprite path, and `quantityAnchorsKey`. **No special-casing.** If the implementation diverges between the two, that's a smell — the cube renderer should be commodity-agnostic and read everything it needs from the `Commodity` schema entry.

---

## What to build

### Gold panel

1. Render the existing gold cube sprite at the correct CSS-mm size derived from `cbrt(volumeCm3) * 10`, where `volumeCm3 = massKg * 1000 / densityGramsPerCm3` and `densityGramsPerCm3 = 19.30`
2. Place the Shiba sprite at true 40 cm height alongside, in the viewport-scaled coordinate system (per `computeViewportMetres()` from prior session work)
3. Render `<YAxis />` to the left of the cube, supplied with `cubeEdgeMetres`
4. Render the readout strip below the cube:
   - **Mass** (oz primary, kg secondary) — large bold
   - **Volume** (in³ primary, cm³ secondary) — secondary line
   - **Cube edge** (in primary, cm secondary) — secondary line
   - **Dollar value** at current BTC price — secondary line
5. Render `<QuantityAnchorCard commodityId="gold" currentMassKg={...} />` keyed to current mass, beside the readout
6. Verify behaviour at slider extremes: 1 sat, 1 BTC, 21 BTC, 1M BTC, 21M BTC

### Silver panel

Identical to gold, with three differences:
- `densityGramsPerCm3 = 10.49` (less dense → larger cube for same mass)
- Sprite path → silver cube asset
- `<QuantityAnchorCard commodityId="silver" />`

---

## Visual regression spot checks

The formula is the invariant:

```
Cube edge = ∛(massGrams / density)
```

Density-driven: gold (19.30 g/cm³) produces a smaller cube than silver (10.49 g/cm³) for the same mass. At equal mass, silver's edge is `cbrt(19.30 / 10.49) ≈ 1.22×` gold's.

Dated examples — at session-date prices (BTC $81k × gold $4,560/oz, 5 May 2026):

| Slider position | Gold cube edge |
|---|---|
| 1 BTC | ≈ 3.06 cm (≈ 552 g, ~28.6 cm³) |
| 1000 BTC | ≈ 30.6 cm |
| 21M BTC | ≈ 8.44 m |

These numbers are illustrative anchors for eyeballing the dev page — they'll drift as BTC and gold prices move. Treat the formula as the regression target, not the cm/m figures.

The Shiba (40 cm) dwarfs the gold cube at sub-1000-BTC positions; at multi-thousand-BTC positions the cube approaches the dog's height; at market-cap scale the cube dominates and the dog is a recognisable speck at its foot. The viewport-scaling logic should keep both cube and Shiba in frame at every slider position.

---

## Asset gaps

If the gold cube sprite, silver cube sprite, or Shiba sprite is absent from the repo, render labelled grey placeholders at the correct dimensions and continue. Do not attempt to author Blender assets yourself. Surface absent assets in the stage report.

---

## Quantity-anchor proximity

When a slider position lands within ±10% of a quantity-anchor mass, the `<QuantityAnchorCard />` surfaces beside the readout. Verify these fire correctly at canonical positions:

- Gold at ~12.44 kg → "≈ one Good Delivery bar" (priority 1)
- Gold at ~110 kg → "≈ Tutankhamun's innermost coffin" (priority 1)
- Gold at ~3,200 tonnes → "≈ one year of global gold production" (priority 1)
- Silver at ~40 tonnes → "≈ the Atocha shipwreck recovery" (priority 1)
- Silver at ~3,110 tonnes → "≈ the Hunt Brothers' 1980 corner" (priority 1)

When two anchors are within range and equal priority, the lower-mass one wins (per Stage 3 selector logic). At positions with no nearby anchor, no card surfaces — the readout strip alone is sufficient.

---

## Done when

- Gold and silver panels render cleanly at all five canonical slider positions
- Cube + Shiba + Y-axis + readout + anchor card all coexist without layout breakage
- Gold and silver implementations differ only in density value, sprite path, and quantity-anchors key — no special-casing in the renderer
- Visual regression baseline screenshots committed (10 baselines: 2 commodities × 5 slider positions)
- No console errors at any slider position
- Conventional commits, e.g. `feat: wire gold panel with cube + Shiba + anchors`, `feat: wire silver panel`, `chore: commit visual regression baselines`

**Stop. Confirm gold and silver render cleanly at all five canonical slider positions before proceeding to Stage 5.**
