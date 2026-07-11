# Stage 14 — Cash: a dollar-bill-stack 5th commodity

*Read `00-OVERVIEW.md` first. Stages 1–13 (gold/silver/pu238/cocaine launch, delight pass) are assumed complete.*

Cash is a 5th hero tab: what does 1 BTC's USD value look like as literal $1 bills, stacked to their real thickness? Unlike every other commodity here, this one needs no market-price lookup — a note is worth exactly $1 by definition, so the whole feature is BTC price → note count → real geometry. It ships full parity with the other four launch commodities: hero tab, `/btc/cash` SEO page, homepage card, FAQ copy.

The centrepiece is a genuine WebGL 3D scene (not the flat-SVG idiom Cocaine uses) built around a real 3D bill model, with a click-to-toggle between an auto-tiered "sensible bundle" view and a literal true-height single stack.

---

## Physical constants (single source of truth)

Per the U.S. Bureau of Engraving and Printing, identical across all denominations:

```
BILL_LENGTH_MM     = 155.956 (6.14 in)
BILL_WIDTH_MM      = 66.3    (2.61 in)
BILL_THICKNESS_MM  = 0.10922 (0.0043 in)
BILL_MASS_G        = 1.0
```

Cross-check: 100 × `BILL_THICKNESS_MM` = 10.922 mm ≈ 0.43 in, matching the BEP's own public trivia for a banded strap. Use this as a regression-pinned constant in tests — if it drifts, something's wrong.

These live in a new `src/lib/billStack.ts`, alongside the pure tier/geometry maths (see below), unit-tested the same way `volume.ts` and `CocaineBrickStack.helpers.ts` are.

---

## Data model changes

**`src/lib/commodities.ts`**
- Add `'bill_stack'` to the `RenderStyle` union (sibling to `'cube'` and `'still_with_readout'`).
- Add `'note'` to `Commodity['unit']`.
- New commodity:
  ```ts
  const cash: Commodity = {
    id: 'cash',
    displayName: 'Cash',
    mvpLaunch: true,
    pageOrder: 5,
    renderStyle: 'bill_stack',
    unit: 'note',
    unitMassGrams: 1,
    sourceId: 'cash',
    sourceName: 'U.S. Bureau of Engraving and Printing (note dimensions) — exact by construction, not a market price',
    dataQuality: 'live', // depends only on the live BTC/USD price already in prices.json
    priceField: 'usd_note', // sentinel — never looked up, see getCommodityPrice special-case below
    facts: [],
  };
  ```
  Append to `ALL_COMMODITIES`; it picks up `pageOrder: 5` in `LAUNCH_COMMODITIES` automatically.

**`src/lib/prices.ts`**
- `getCommodityPrice`: add `if (commodity.id === 'cash') return 1;` as the first branch (mirrors the existing `cocaine` special-case immediately below it). One note = one dollar, always. `computeCommodityAmount` then falls out correctly with zero other changes: `noteCount = btcAmount * dayPrices.btc`.

**`src/lib/format.ts`**
- `formatRatio` in `+page.server.ts` (see below) needs a note-count branch; a small `formatNoteCount` in `format.ts` is the natural home (large-number formatting: "1,482,391 bills" / "2.1 million bills" / "1.68 trillion bills" past the point individual counting is meaningful — same ladder `formatUsd` in `+page.svelte` already uses for M/B/T).

---

## Tier system (`billStack.ts`)

Two independent things, both driven by `noteCount`:

1. **Tier selection** — which real cash-handling unit is the "natural" way to look at this many bills. Mirrors `CocaineBrickStack.helpers.ts`'s `selectTier`.
2. **View mode** — `'tiered'` (auto-selected bundling, roughly-cubic at scale) vs `'literal'` (always one true-height column). User-toggled by clicking the stage; not URL-synced (matches `sliderMode`/`staged`, which are local view state).

### Tiered mode — worked table

| Notes | Real unit | Visual |
|---|---|---|
| 0–99 | loose bills | individually-instanced GLB bills, slight jitter, true stack height |
| 100–999 | strap(s) of 100 | banded straps (paper-band decal texture), stacked |
| 1,000–99,999 | bundle(s) of 1,000 (10 straps) | rubber-banded bundles, grid-arranged |
| 100,000–9,999,999 | bundles arranged in a **roughly-cubic grid** | rows × cols × layers solved for near-equal extents — this is the "roughly cubic stack" from the brief |
| ≥10,000,000 | palletised bricks, receding field | same idea as Cocaine's `production` tier — hero big-number readout carries the magnitude, not per-unit rendering |

Grid solver: given `n` bundles of known footprint (bundle footprint = bill footprint; bundle height = 1000 × `BILL_THICKNESS_MM`), find integer `(cols_x, cols_z, layers_y)` with `cols_x × cols_z × layers_y ≥ n` minimizing the spread between the three resulting world-space extents. Small brute-force search over divisors of small integers — same complexity class as `gridDims()` already in `CocaineBrickStack.helpers.ts`. New function `cubicGridDims(n)`, unit-tested with representative `n` (8, 27, 100, 1000) asserting near-equal extents.

### Literal mode

Always one column, `height = noteCount × BILL_THICKNESS_MM`. Individually-instanced real bills for the bottom (up to an instance cap tuned during build — start at 2,000, adjust after a perf pass), a solid extruded block above that using the same footprint with a procedural edge-stripe texture (stripe repeat = true bill count in that segment, so the texture frequency stays physically honest rather than decorative).

Both modes feed the **same generic camera-dolly maths** in `scene/maths.ts` unchanged — `cameraTransform(dominant)` already handles mm-to-monolith scale for the metal cubes; the "dominant" fed in is the stack height (literal mode) or the bundle-grid's largest extent (tiered mode).

### Worked positions (canonical slider checkpoints, 1 BTC ≈ $110,000 today)

| BTC | USD | Notes | Tiered tier | Literal height |
|---|---|---|---|---|
| 1 sat | $0.0011 | 0 (rounds down) | empty state | — |
| 0.001 BTC | $110 | 110 | 1 strap + 10 loose | 12 mm |
| 1 BTC | $110,000 | 110,000 | roughly-cubic bundle grid | 12 m |
| 100 BTC | $11M | 11,000,000 | palletised field | 1.2 km |
| 21M BTC | $2.3T | 2.3 trillion | palletised field, big-number hero | ≈252,300 km — about 66% of the way to the Moon (384,400 km average distance). Compute this ratio at build time against a `DISTANCE_TO_MOON_KM` constant; don't hardcode the percentage in copy since it moves with the live BTC price. |

---

## 3D model

Source: `assets/blender/one_dollar_bill.glb` — Sketchfab-sourced, single mesh (24 verts / 12 tris, thin rounded box, `doubleSided`), correct 2.61:6.14 aspect ratio, real edge thickness already modeled (~0.12 mm), but at **exactly 2× true scale** (bbox extents are 2× the BEP dimensions — a Sketchfab unit-scale artifact, not a modeling error).

**Texture**: the baked-in `baseColorTexture` is a photo-real stock image of an actual $1 note with a visible stock-agency watermark on both faces — not shippable (watermark) and legally unwise to reproduce photo-real currency art regardless. Per your call, replace it with a **procedurally-generated stylized texture** — canvas-drawn, green-toned, "$1"/"ONE" typography, simple ornamental border, abstract portrait silhouette. Deliberately not a reproduction of genuine Federal Reserve Note artwork. Matches the site's existing illustrative-not-photographic style (see the Cocaine bricks).

**Pipeline**: new `scripts/compress-bill.ts`, structurally mirroring `compress-shiba.ts` — `gltf-transform optimize` with `--texture-compress webp`, normalize scale via bbox measurement (same technique `LiveStage.loadDog` already uses: measure loaded bbox, `scale.setScalar(BILL_LENGTH_M / bboxSize.x)`), output to `static/models/references/one_dollar_bill/bill.glb`. No animations, single mesh — budget should land well under 300 KB (vs the Shiba's 3 MB skinned-animated budget).

**Rendering component**: new `src/lib/scene/BillStage.svelte`, a sibling to `LiveStage.svelte` (not an extension of it — same separation precedent as `CocaineBrickStack` being wholly separate from `CubeRenderer`). Shares: WebGL bootstrap, ground plane, key light, resize/visibility observers, the Shiba GLTFLoader pattern (factor the "load a GLB, normalize its scale, add to scene" logic into a small shared util — the one justified extraction here, since it's identical logic twice, not speculative). New: `InstancedMesh` for repeated bills/bundles, the procedural texture generation, the tier/grid placement logic (consumes `billStack.ts`'s pure functions).

Poster/SSR fallback: `BillRenderer.svelte` (parallel to `CubeRenderer.svelte`) — a CSS/DOM composition (not WebGL) for the no-JS / no-WebGL / pre-hydration state, showing the tiered view at a reasonable default amount. Same "poster-first, canvas overlays after hydration" contract as the metal cubes.

No Shiba on this tab — same call as Cocaine (a stack of bills next to a dog doesn't add legibility the way a cube does; the human-scale comparison line in the readout carries scale instead).

---

## Interaction

Click/tap the stage to toggle `viewMode` between `'tiered'` and `'literal'`. Camera re-dollies via the existing damped-lerp (`camPos.lerp(wantPos, k)`) — the transition IS the explanation, same principle as the preset-tween camera dolly on the homepage slider. Keyboard equivalent: Enter/Space when the stage has focus (a11y parity with the existing radiogroup tab pattern). A small persistent label indicates the active mode and hints at the toggle ("tap to see it as one column").

---

## Readout (`BillReadout.svelte`, parallel to `CocaineReadout.svelte`)

Top to bottom:
1. **Note count** (hero figure, large) — "1,482,391 bills" style, via `formatNoteCount`.
2. **Mode-dependent secondary line** — literal mode: stack height with a human-scale comparison (nearest-below match against a fixed ladder: doorway 2.03 m → adult human 1.7 m → Statue of Liberty 93 m → Eiffel Tower 330 m → Burj Khalifa 828 m → Everest 8,849 m → Kármán line 100 km → distance to the Moon 384,400 km). Tiered mode: current tier label + bundle-grid dimensions.
3. **Exactness note** (small, persistent) — "Priced exactly: one $1 note is worth $1. No market estimate." (This tab has no illustrative-pricing caveat unlike Cocaine/Pu-238 — worth stating plainly since every other tab on the site does carry some pricing uncertainty.)
4. **Source/methodology footer** — BEP dimensions citation, links to `/methodology` and `/data`, same pattern as every other readout.

---

## Integration checklist

- `HeroStage.svelte`: 5th tab; `isCash = active.id === 'cash'` branch parallel to `isCocaine`; mount `BillStage`/`BillReadout`; extend the `commodityAccent()` switch (suggest a US-currency green, e.g. `#85bb65`); extend `dataCommodity` readiness-gating the same way `brickReady` gates Cocaine (wait for the mesh to actually mount before advertising `data-commodity` to the X-bot screenshotter).
- `commodities.ts` doc comment at the top ("Locked launch order... gold, silver, pu238, cocaine") needs updating to include cash as 5th.
- `/btc/cash`: new `COMMODITY_CONTENT.cash` entry in `src/lib/seo/commodity-content.ts` (title/h1/intro/context/faqs/metaDescription, `{ratio}`-templated); `formatRatio` in `+page.server.ts` gets a `unit === 'note'` branch; `showPoster` logic in `+page.svelte` currently gates on `renderStyle === 'cube'` — Cash needs its own poster branch (reuse `BillRenderer` as the poster, same as gold/silver/pu238 reuse `CubeRenderer`).
- Homepage (`+page.svelte`): 5th card in the "Per-commodity deep-dives" `seo-cards` list; `HOMEPAGE_FAQS` gets 1–2 new entries if there's a natural "how much cash..." question.
- `/methodology`: new paragraph documenting the BEP constants and the "priced exactly, not a market estimate" framing.
- Og-image (`functions/og-image.ts`) and oEmbed: check whether these are commodity-generic (formula-driven) already — if so, Cash should fall out for free; if custom-art-per-commodity, scope a generic-panel fallback rather than bespoke art (matches how Cocaine's OG treatment was handled).
- `quantity-anchors.json` / `QuantityAnchorCard`: **not used** for Cash — the human-scale comparison ladder is bespoke (height-based, not mass-based; existing anchors are mass-keyed). No changes needed there.
- `PhysicalRep.svelte`: only branches on `cube`/`progression`/`vessel`/`bulk` — confirm during implementation whether this component is still live anywhere; if so it needs a graceful pass-through (no crash) for `bill_stack`, not necessarily a full render path.

---

## Testing

- `billStack.ts` pure functions: unit tests for `noteCount → height`, tier selection at boundary values (99/100, 999/1000, etc.), `cubicGridDims` near-equal-extent property, the BEP-constant cross-check (100 × thickness ≈ 0.43 in).
- Visual regression baselines at the canonical worked positions above (mirrors Cocaine's 5-baseline requirement).
- Toggle interaction: both keyboard and pointer, at a low count (loose bills) and a high count (pallet tier) — confirm the camera dolly completes and doesn't strand mid-transition on reduced-motion (should snap, not tween, matching the existing `prefersReduced` handling in `LiveStage`).
- No-WebGL / reduced-motion fallback: `BillRenderer` poster renders and is legible at at least one mid-range amount.
- `compress-bill.ts`: same fail-loudly verification pattern as `compress-shiba.ts` (size budget, mesh survives, texture applied).

---

## Out of scope / explicit follow-ups

- Photorealistic or licensed bill artwork — stylized procedural texture is the v1 (and likely permanent) choice; revisit only if you later source a properly licensed, non-watermarked asset.
- Non-USD denominations or non-$1 notes.
- Per-tier bespoke og-image art (generic panel is fine for v1, matching Cocaine).

---

## Done when

- Cash tab renders coherently at the five canonical worked positions (1 sat, 0.001 BTC, 1 BTC, 100 BTC, 21M BTC)
- Toggle between tiered and literal views works via click and keyboard, at both a low and a high note count
- Note count, height/grid-dimension readout, and the human-scale comparison line are all correct against the physical constants (spot-check by hand against the worked table)
- `/btc/cash` builds, has correct FAQ JSON-LD matching visible copy, and its poster renders without JS
- Homepage SEO card + methodology paragraph present
- `compress-bill.ts` produces a budget-compliant, watermark-free `bill.glb`
- No console errors at any slider position; visual regression baselines committed
- Conventional commits: `feat: add cash (dollar-bill-stack) commodity`, `feat: wire cash hero tab + readout`, `feat: add /btc/cash landing page`, `chore: commit cash visual regression baselines`

**Stop. Confirm the Cash panel reads coherently at the five canonical positions, in both view modes, before considering this stage complete.**
