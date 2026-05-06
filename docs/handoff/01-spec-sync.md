# Stage 1 — Spec sync

*Read `00-OVERVIEW.md` first if you haven't already this session.*

This stage has two parts: comprehension verification, then documentation sync. **No component code is written in this stage.** Spec is updated first so it is the source of truth before implementation begins.

---

## Part 1 — Read first, summarise, then wait

Open the following in this order:

1. `docs/SPEC.md` (full)
2. `docs/DECISIONS.md` (full)
3. `docs/PROJECT-STATUS.md` (full)
4. `src/lib/commodities.ts` (current schema)
5. `src/lib/illustrative-prices.json` (existing pattern for the uranium fuel pellet)
6. `src/lib/scale-references.json` (the cycling library you'll be removing in Stage 2)

Then summarise back, in your own words:

- The MVP commodity set as the spec stands today (i.e. before any of the changes in this session)
- The cube-mode rendering for gold (volume → cube edge → CSS-mm sizing — what's the formula and where does it live?)
- The Shiba scale-reference scheme as currently specced (true 40 cm height, viewport-scaling camera — does the existing code reflect this or is it still on an older scheme?)
- The illustrative-pricing pattern for the uranium fuel pellet (file location, schema, how it's loaded)
- The `renderStyle` field and what values it currently accepts
- What's in `src/lib/scale-references.json` that you'll be removing
- How render-mode coverage will look post-pivot: **three cube-mode commodities** (gold, silver, Pu-238) with universal Shiba presence, **one still-mode commodity** (cocaine) without the dog

**Stop. Wait for confirmation before doing anything else.** This is the most important step in the session — if your understanding is off here, the rest goes sideways.

---

## Part 2 — Documentation sync

Once the human has confirmed your comprehension is on point, update the three documentation files. Edit in place; don't rewrite from scratch.

### `docs/DECISIONS.md` — append four entries

Place under the appropriate sections (most-recent-first within each):

```
- **2026-05-04:** Launch commodity set reduced from 6+ to four: gold, silver, cocaine, Pu-238. Other commodities remain documented but flag inactive for MVP via new `mvpLaunch: false` field on Commodity interface. Uranium fuel pellet deferred post-launch; Pu-238 takes its philosophical nuclear-fuel slot. Reasoning: tighter launch scope means each commodity can be authored to portfolio quality rather than spreading effort thin across a fuller set; remaining commodities re-enter post-launch as the rendering and asset pipelines stabilise.

- **2026-05-04:** Cycling scale-reference library deleted. Single Shiba Inu (true 40 cm height, viewport-scaling camera) is the universal cube-mode scale reference, present on every cube-mode panel (gold, silver, Pu-238). Cocaine is the single exception — its forensic-still register is set entirely by the image. Reasoning: the cycling library was a meaningful asset-production cost and a source of register clashes between Kenney-style references and Blender-rendered cubes; the dog as universal cube-mode anchor is the cleaner solve, and concentrating the editorial-still treatment on cocaine alone keeps that exception meaningful rather than diluted.

- **2026-05-04:** Cocaine treatment reverts from five-stage progression to single forensic-still + dynamic readout. The progression was the most editorially fragile commodity treatment specced; the pile stage in particular carried Scarface/glamour risk the brand voice ("honest, precise, slightly dry") couldn't absorb. A fixed forensic-evidence-room still + bold readout showing weight purchasable at the slider's BTC amount is more honest about what this commodity actually is on the site (an editorial provocation, not a like-for-like fungible commodity comparison) and consistent with the existing principle that at extremes the readout carries the truth.

- **2026-05-04:** Pu-238 added as fourth launch commodity, displacing the uranium fuel pellet at MVP. Cube-mode rendering like gold and silver, using **pure Pu-238 metal at 19.8 g/cm³** (denser than gold's 19.30; cube edges marginally smaller than gold for equivalent mass). The visualisation has the luxury of nothing spontaneously disassembling — pure plutonium metal at multi-kilogram mass would self-destruct from its own decay heat in reality, but the cube on screen is what the dial says it is. **Two additional layers scale with mass independently:** (1) a radiant glow keyed to blackbody emission temperature, with separate intensity and colour-temperature channels — intensity climbs faster than colour temperature, matching real incandescence physics; (2) an **opt-in Geiger crackle** synthesising real Poisson-distributed click events at a rate proportional to specific activity (~17 Ci/g for pure Pu-238, so click rate scales linearly with mass). Default off, persisted via `?audio=on` URL state. One-line brand-voice clarification mandatory and persistent: "Plutonium-238 — the radioisotope that powers spacecraft. Non-fissile, not weapons material." Pricing illustrative at ~$5,000/gram material cost (composite from DOE / NASA Planetary Science / Cassini OIG 1997 escalated to 2024). Fully-loaded program cost ~$100,000/gram cited separately on methodology page as contextual comparison.

- **2026-05-04:** Page render order at MVP locked: gold → silver → Pu-238 → cocaine. Metals frame the tour, Pu-238 is the philosophical apex, cocaine is the editorial close that sends the reader away thinking.
```

### `docs/PROJECT-STATUS.md` — update phase markers

- Mark the Phase 1 skeleton + cube-mode-for-gold milestone as established pattern.
- Add a Phase 2c entry covering this session's scope: "Mixed-mode renderer integration — three cube-mode panels with universal Shiba (gold, silver, Pu-238) plus one editorial-still panel (cocaine), illustrative-pricing pattern extended to cocaine and Pu-238, quantity-anchor proximity card system introduced."
- Update "Open threads" to reflect the four-commodity launch and the deferred set. Move uranium fuel pellet, copper, oil, natgas, platinum, coffee, wheat to a new "Deferred from MVP" subsection of the open threads list.
- Update infrastructure table only if anything's changed (probably not in this stage).

### `docs/SPEC.md` — substantial rewrite of three sections

Don't try to do this from memory of prior versions — view the file and edit in place.

1. **MVP commodity catalogue.** Replace the 8-row table with a 4-row table for the four launch commodities, **listed in the locked page render order: gold → silver → Pu-238 → cocaine**. Move displaced commodities to a "Deferred from MVP" subsection that preserves their schema but flags them inactive.

2. **Physical representation engine.** Rewrite the scale-reference subsection to describe the universal Shiba-on-cube-mode scheme. Delete the cycling library description. Document cocaine still-with-readout as the single editorial exception (no dog, no Y-axis, no quantity anchors). Document the Pu-238 cube glow overlay as a property of the cube renderer (triggered by `commodity.glowScales === true`), **not** as a separate render mode. Document the Pu-238 Geiger crackle as an opt-in audio layer (default off, `?audio=on` URL state), again as a property of the cube renderer for Pu-238 specifically rather than a global feature.

3. **Per-commodity entries.** Add full entries for cocaine and Pu-238. Pricing methodology, sources, units, render mode, brand-voice clarification (Pu-238 only). Use the data shapes from Stage 2's `illustrative-prices.json` updates as the single source of truth — link to those rather than duplicating.

---

## Done when

- Comprehension summary delivered and confirmed by human
- DECISIONS.md, PROJECT-STATUS.md, SPEC.md all reflect the four pivots
- Commits are small, one-logical-unit each, conventional messages

**Stop. Confirm spec sync looks right before proceeding to Stage 2.**
