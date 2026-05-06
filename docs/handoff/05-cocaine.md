# Stage 5 — Wire up cocaine

*Read `00-OVERVIEW.md` first. Stages 1–4 must be confirmed complete.*

Cocaine is the single editorial-still exception in the launch set. No Shiba, no Y-axis, no quantity anchors. The forensic still does the visual mood; the readout does the comparative work.

---

## What to build

### Cocaine panel structure

1. **Still image at top.** Render `<StillPanel />` with `imagePath: "/static/sprites/cocaine/forensic_lab.webp"`. The asset is supplied separately by the user. If the file isn't present in the repo, render a placeholder grey panel labelled "still pending — forensic lab composition" and continue. Do not attempt to author the asset yourself.

2. **Readout strip below the still**, in this order, top to bottom:

   **a. Primary mass readout (large bold).** lb primary, kg secondary. Driven by the **wholesale tier midpoint ($30,000/kg)** — that's the canonical equivalence.

   **b. `<CocaineDenominationRow currentMassKg={...} />`** — the slider-position-keyed denomination line (lines / bags / bricks / pallets / years of production).

   **c. `<TieredPricingTable currentBtc={...} priceData={...} />`** — three rows (producer / wholesale / retail-pure-equivalent), wholesale highlighted as primary.

   **d. Markup fact line (small).** *"Producer-to-retail markup: ~30–50×. The bulk of cocaine's market value is in trafficking and distribution, not production."*

   **e. Purity footnote (small).** *"Street retail figures reflect 30–50% purity; wholesale and retail-pure-equivalent prices use standardised purity for cross-tier comparison."*

   **f. Source attribution row (small persistent).** *"Wholesale: UNODC 2024 · Retail: DEA 2024 · Producer: UNODC 2024 · Illustrative pricing — see methodology."*

3. **No Shiba. No Y-axis. No quantity anchors.** The cocaine panel is set entirely by the still + readout.

---

## Behaviour at slider extremes

The readout must read coherently at every slider position. The denomination row carries the absurdity — at 1 sat the equivalence is sub-milligram and the table will land near-zero, which is fine; the brand voice is honest first.

Worked at canonical positions, all using wholesale midpoint $30,000/kg, 1 BTC = $80,000:

| Slider | BTC value | Mass at wholesale | Denomination |
|---|---|---|---|
| 1 sat | $0.0008 | ~27 ng | "≈ 0 lines" — display gracefully |
| 0.001 BTC | $80 | ~2.7 g | "≈ 89 lines (30 mg each)" |
| 1 BTC | $80,000 | ~2.67 kg | "≈ 3 1-kg bricks" |
| 100 BTC | $8M | ~267 kg | "≈ 267 1-kg bricks" |
| 21M BTC | $1.68T | ~56,000 tonnes | "≈ 25 years of global production" |

The "0 lines" output at 1 sat is a UX call worth resolving before this stage ships. Two options:

- **Honest zero.** The readout shows "0 lines" or "<1 mg" and the brand voice rides through. Consistent with the existing principle that the readout carries the truth.
- **Floor display.** Below 30 mg, suppress the lines denomination and show mass only ("23 ng"). Keeps the panel from looking broken at the extreme low end.

Default to honest zero. If it reads badly in regression, switch to floor display.

---

## Tiered pricing table at extreme positions

The three-tier table renders the same equivalence at every tier, scaling linearly with BTC. At 21M BTC the retail row would imply impossible quantities (~12 million tonnes purity-adjusted) — that's fine, the table is a comparative device, not a market simulation. The brand voice doesn't claim anyone could actually buy this much.

The wholesale row is highlighted as primary (subtle border, slightly heavier weight, or background tint). The other two rows display alongside as comparison context, visually subordinate.

---

## Asset gap

The forensic-lab still is the single asset for this panel. If absent, the placeholder grey panel renders and the readout strip below works fully — the panel is functionally complete with placeholder visual. Surface the absent asset in the stage report so the user can prioritise its production.

---

## Done when

- Cocaine panel reads coherently at slider positions: 1 sat, 0.001 BTC, 1 BTC, 100 BTC, 21M BTC
- Still image (or placeholder) renders at fixed dimensions without aspect-ratio breakage
- Tiered pricing table displays three rows with wholesale visually primary
- Source attribution row is always present
- No Shiba, Y-axis, or quantity anchors on this panel (verify by inspection)
- Visual regression baseline screenshots committed (5 baselines at the canonical slider positions)
- No console errors at any slider position
- Conventional commits: `feat: wire cocaine panel`, `chore: commit cocaine visual regression baselines`

**Stop. Confirm cocaine panel reads coherently at the five canonical slider positions before proceeding to Stage 6.**
