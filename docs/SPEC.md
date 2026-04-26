# Bitcoin Weigh-In — Build Spec

*A handoff document for Claude Code. Written 19 April 2026, updated 25 April 2026 with the cube-mode pivot for metals. Domain: bitcoinweighin.com*

---

## Project identity

**Name:** Bitcoin Weigh-In
**Domain:** bitcoinweighin.com
**Tagline candidates:** "What does a bitcoin weigh?" · "Bitcoin, measured." · "The purchasing power of one coin, in things you can hold."
**Brand voice:** honest, precise, slightly dry. Never hypey. The name does the heavy lifting — copy should support, not oversell. "Weigh-in" is both the activity (measuring) and the stance (a considered take). Every commodity section is a weigh-in. The newsletter is *This Week's Weigh-In*.

---

## Concept (one paragraph)

A single long-scroll page that renders — at true relative scale — what a user-selected amount of bitcoin currently buys across a curated set of commodities. Each commodity section has a physical-object visualisation with appropriate scale references; for dense metals, this is a single cube of true substance volume against a cycling library of recognisable objects from a flea to the Eiffel Tower. A sticky date scrubber at the bottom animates the entire page across BTC's price history from 2013 to today, with anchor-event captions firing as the playhead crosses them. All state (BTC amount, date, unit system) is URL-encoded and therefore shareable. No runtime backend — one static JSON blob refreshed daily via GitHub Actions.

---

## Core principles

- **Static first.** Every price in memory, served from CDN. No runtime API calls to price feeds. Full history is a single JSON file.
- **One source of truth.** One combined daily-closes file, target ~3-5 MB gzipped, covering all commodities 2013-01-01 to yesterday.
- **Shareable state.** Every slider + date position is a URL. Copy-paste reproduces the view exactly.
- **Substance over packaging.** Where possible, render the substance itself at true volume rather than its commercial container or unit. A cube of gold is more honest than 200 pallets of bars; both contain the same gold, but only one is true to the slider's claim.
- **Graceful degradation at extremes.** At 1 sat the gold cube is sub-millimetre; at 21M BTC it's the height of a 10-storey building. Both should look intentional, not broken. The reference library cycles to keep the user oriented.
- **Privacy-respecting.** No account system. Plausible or Umami analytics only. No third-party trackers.
- **Mobile-first.** Majority of shares will be read on phones. Touch-scrub the timeline. Vertical scroll is the primary axis.

---

## Two visual vocabularies

The site uses two distinct rendering approaches, chosen per commodity based on what the substance actually is.

**Cube mode** — for dense fungible metals. A single authored cube sprite, rendered at the substance's true volume via cube-root scaling, against a cycling library of scale references. One sprite per material, ~18 reference objects shared across all cube-mode commodities. Continuous growth, no stage transitions, no cross-fade artefacts.

Applies to: gold, silver, platinum, copper, palladium, rhodium, osmium.

**Progression mode** — for everything cube mode doesn't fit. Per-substance authored stages with cross-fade transitions, the £1 coin and human silhouette as scale references, and text comparison cards as fallback at extreme sizes.

Applies to: oil (drum → tanker → fleet), natural gas (cube wireframe → LNG carrier → fleet), coffee (cup → bag → jute sack → warehouse), fuel pellet (single → handful → rod's worth → shoebox → pallet), and any future bulk or fluid commodity.

The two vocabularies are internally coherent and never mix within a single commodity section. The renderer branches on `commodity.renderStyle`.

---

## Cube mode

For dense fungible metals, a single cube of true substance volume is the physical visualisation. The cube's edge length grows continuously with the slider via cube-root scaling. Alongside the cube, a scale reference object from a shared library is rendered at its true real-world size, chosen at render time as the closest match to the cube's current edge length on a logarithmic scale.

### Rendering rule

```typescript
function renderCubeCommodity(commodity: Commodity, amount: number): CubeRenderState {
  // 1. Compute mass and intrinsic volume
  const massGrams = amount * commodity.unitMassGrams;
  const volumeCm3 = massGrams / commodity.densityGPerCm3;
  
  // 2. Cube edge length
  const edgeLengthMm = Math.cbrt(volumeCm3) * 10;  // cm³ → cm → mm
  
  // 3. Pick closest reference on log scale
  const reference = pickClosestReference(edgeLengthMm, scaleReferences);
  
  // 4. Render cube and reference at true sizes in shared coordinate system
  return { cube: { edgeLengthMm }, reference };
}
```

The cube sprite is identical at every amount; only its CSS-rendered size changes. The reference object is rendered at its own true size, never scaled. The two objects share a coordinate system so the user reads relative size honestly.

### Reference library

`src/lib/scale-references.json` holds ~18 entries spanning roughly six orders of magnitude. Each entry has:

```typescript
interface ScaleReference {
  id: string;
  displayName: string;
  realSizeMetres: number;     // edge or characteristic dimension
  spritePath: string;         // SVG, PNG, or WebP (animal references)
  description: string;        // accessibility
  culturalNote?: string;      // optional readout caption
  measurementAxis?: "length" | "height" | "longest";
                              // which bbox dimension realSizeMetres
                              // refers to; consumed by the Blender
                              // render scripts. Defaults to "longest".
  animatedModelPath?: string; // optional .gltf path for the easter-egg
                              // renderer (lazy-loaded <model-viewer>).
                              // References without it stay static-only.
}
```

Reference entries from smallest to largest:

| id | displayName | realSizeMetres |
|---|---|---|
| grain_of_sand | Grain of sand | 0.0005 |
| pinhead | Pinhead | 0.001 |
| flea | Flea | 0.002 |
| pencil_tip | Pencil tip | 0.005 |
| sugar_cube | Sugar cube | 0.016 |
| pound_coin | £1 coin | 0.0234 |
| espresso_cup | Espresso cup | 0.06 |
| football | Football | 0.22 |
| shiba_inu | Shiba Inu | 0.4 |
| microwave | Microwave oven | 0.5 |
| person | Person | 1.75 |
| refrigerator | Refrigerator | 1.8 |
| family_car | Family car | 4.5 |
| shipping_container | Shipping container | 6.1 |
| two_storey_house | Two-storey house | 8.0 |
| double_decker_bus | London double-decker bus | 11.0 |
| ten_storey_building | 10-storey building | 30.0 |
| statue_of_liberty | Statue of Liberty | 93.0 |
| eiffel_tower | Eiffel Tower | 330.0 |
| empire_state_building | Empire State Building | 381.0 |

Selection rule: pick the reference whose `realSizeMetres` is closest to the cube's edge length (in metres) on a logarithmic scale. Cross-fade to the next entry when the slider moves the cube past the geometric mean between two adjacent references — this gives smooth, roughly evenly-spaced transitions on the log slider.

The `pound_coin` and `person` entries replace the previously-separate £1 coin and human silhouette components. Same actual-size CSS-mm rendering for the coin; same 1.75 m fixed height for the person. Just sourced from the library.

### Reference sprite style

Two coexisting styles:

**Object references (silhouettes).** The objects in the library — flea, sugar cube, espresso cup, microwave, shipping container, Eiffel Tower, etc. — are clean line-art silhouettes filled with a single muted neutral colour (`var(--color-text-secondary)` or similar), with enough detail to be instantly recognisable but no more. Isotype-style pictograms. SVG preferred for scalability and small file size; PNG @ 2× acceptable where SVG would be unwieldy.

**Animal references (photoreal).** Animals in the library — Shiba Inu, blue whale, elephant, horse, dog, cat, mouse, bee, ant, flea — are rendered through the same Blender pipeline as the gold cube (canonical: `scripts/blender/gold_cube.py`). Same camera rig, HDRI, three-light setup, intrinsic transparent margin, separate contact-shadow PNG. Each animal's source `.gltf` (or `.blend`) lives at `assets/blender/references/{id}/`. Output is WebP at the same 1600×1600 canvas as the cube. Where the source is animated, a copy of the `.gltf` is also served from `static/models/references/{id}/scene.gltf` for the easter-egg path described below.

The Eiffel Tower and Empire State Building are deliberately the cultural-canon entries at the large end. The Shiba Inu is the first animal entry, with 11 more queued (see `assets/references-attribution.md`). Together they bookend the slider with humour and recognisability.

### Easter egg — animated references

References with an `animatedModelPath` field render the static sprite by default and swap to a `<model-viewer>` element loading the animated `.gltf` when triggered. Three trigger paths, all gated by `prefers-reduced-motion: reduce` (when set, the static sprite always wins):

- **Hover (desktop):** pointer dwell on the reference for ≥200 ms.
- **Sustained tap (mobile):** touch held for ≥500 ms; auto-reverts after 8 s.
- **URL parameter:** `?easter=doge` auto-animates whenever an animated reference is the active library entry.

`@google/model-viewer` and the `.gltf` are both lazy-loaded — neither hits the network on initial page load. Implementation: `src/lib/components/ScaleReference.svelte`. References without `animatedModelPath` are unaffected by all of the above.

### Cube sprite specifications

One authored cube per metal, rendered in Blender at the standard three-quarter rig (25° elevation, 30° azimuth, ~50 mm focal length). Material per `assets/materials-reference.md`. Canonical render size 100 mm edge length, 1600×1600 px @ 2× density, transparent background, separate greyscale contact-shadow PNG.

The cube is what most users will see most often (~24 mm edge length at 1 BTC today's prices). It must read as the correct substance at first glance, with proper specular highlights, slight edge bevels (real cast metal isn't razor-sharp), and material-appropriate surface character. Test during authoring at the displayed size, not just at canonical size.

For launch: gold cube only. Silver, platinum, and copper cubes can be authored later by re-rendering the same geometry with different materials — roughly an hour of additional work per material once the gold cube and lighting are locked.

### What cube mode does not have

- No stage transitions. The cube is one sprite at all amounts.
- No tile mode. Tile-mode schema fields exist for potential future use by other commodities but are unused by any commodity at launch.
- No comparison-card fallback. The reference library covers the full slider range; comparison cards are a progression-mode feature.
- No human silhouette as a separate concern. The `person` entry in the reference library handles this case.
- No standalone £1 coin. The `pound_coin` entry in the reference library handles this case at actual physical size.

---

## Progression mode

For commodities that don't fit cube mode — fluids, bulk solids, the fuel pellet — the existing progression-based approach applies. Per-stage authored sprites with cross-fade transitions at stage boundaries, cube-root scaling within stages, the £1 coin (via the reference library) at small displayed sizes, the human silhouette (via the reference library) at displayed sizes >300 mm, and text comparison cards at extreme displayed sizes >5 m.

The progression-mode renderer is unchanged from the prior spec. The rest of this section describes commodities and stages that use it.

### Oil and gas — vessel-based progressions

Both reframed around real-world maritime infrastructure with standardised capacity classes.

**Oil (Brent):**
- `jerrycan` — 5-gallon can, very small amounts
- `drum` — 55-gallon blue steel drum, ref 1 barrel
- `drum_cluster` — 10 drums
- `road_tanker` — articulated tanker, ref ~200 barrels (≈ 1 BTC at current prices)
- `aframax` — Aframax-class tanker, ref ~600,000 barrels
- `vlcc` — Very Large Crude Carrier, ref ~2,000,000 barrels (distinct silhouette from Aframax)
- `tanker_fleet` — multiple VLCCs in side-profile horizon shot, tile-mode-eligible

**Natural gas:**
- `wireframe_cube` — translucent cyan wireframe with vapour animation, household-scale and below
- `lng_carrier_moss` — single LNG carrier with distinctive Moss-type spherical tanks (~170,000 m³ liquid, ~3.5M MMBtu equivalent)
- `lng_qmax` — Q-Max class carrier, ~266,000 m³ capacity
- `lng_fleet` — multiple carriers, tile-mode-eligible

The vessel-class encoding is honest: real shipping uses these classifications and capacities. The sprite library is small (one Aframax, one VLCC, one Moss-type LNG, one Q-Max) and the rest is replication.

### Coffee, fuel pellet, and other progression commodities

Coffee retains its existing progression: cup → 1 kg bag → 60 kg jute sack → warehouse stack.

The uranium fuel pellet retains its existing progression: single pellet → handful → fuel rod's worth → shoebox → pallet. This is the philosophical closer of the tour and its specific physical vocabulary is part of why it lands.

---

## MVP commodity catalogue

| ID | Display name | Render style | Unit | Density (g/cm³) | Data source |
|---|---|---|---|---|---|
| `gold` | Gold | cube | troy oz | 19.30 | stooq `xauusd` |
| `silver` | Silver | cube | troy oz | 10.49 | stooq `xagusd` |
| `copper` | Copper | cube | lb | 8.96 | stooq `hg.c` |
| `oil_brent` | Brent crude | progression (vessel) | barrel | 0.835 | FRED `DCOILBRENTEU` |
| `natgas` | Natural gas | progression (vessel) | MMBtu | 0.000717 at STP | FRED `DHHNGSP` |
| `uranium_fuel_pellet` | Nuclear fuel pellet | progression | pellet (7 g) | 10.97 | illustrative |

**MVP optional:**

| ID | Display name | Render style | Unit | Density | Data source |
|---|---|---|---|---|---|
| `platinum` | Platinum | cube | troy oz | 21.45 | stooq `xptusd` |
| `coffee` | Arabica coffee | progression (bulk) | lb | 0.38 (bulk roasted) | stooq `kc.c` |

**Ordering rationale:** gold (cube, universally familiar) → silver (cube, denser visual contrast) → copper (cube, industrial) → oil (vessel, fluid) → natural gas (vessel, invisible substance made tangible via LNG carriers) → uranium fuel pellet (progression, philosophical closer). The cube-mode commodities sit together at the start of the tour, fluids in the middle, the fuel pellet's distinctive non-cube vocabulary at the end.

**Deliberately excluded from MVP:** wheat, corn, soybeans, sugar, cocoa. Agri commodities share a "sack of brown stuff" visual problem — they read redundantly. Coffee gets a spot for its distinct visual vocabulary; the rest are skipped. Can be added in Tier 2 if post-launch data shows demand.

**Diamonds are not included** at any tier. Unlike fungible commodities, diamond prices depend on the 4 Cs (carat, colour, clarity, cut) and there is no public spot price.

---

## Commodity metadata schema

```typescript
interface Commodity {
  id: string;
  displayName: string;
  renderStyle: "cube" | "progression";
  unit: "troy_oz" | "lb" | "barrel" | "mmbtu" | "gram" | "kg" | "pellet";
  unitMassGrams?: number;            // mass per unit; required for cube mode
  densityGPerCm3?: number;           // solid density; required for cube mode
  bulkDensityKgPerM3?: number;       // for bulk agri; takes precedence over solid density
  render?: RenderProgression;        // required for progression mode, omitted for cube mode
  facts: FactTemplate[];
  affiliate?: { url: string; label: string; disclosure: string };
  sourceId: string;
  sourceName: string;
  dataQuality: "live" | "indicative" | "historical" | "illustrative";
}
```

For cube-mode commodities, the renderer reads `densityGPerCm3` and `unitMassGrams`, ignores any `render` field, and delegates to the cube renderer. For progression-mode commodities, the existing `render: RenderProgression` field drives stage selection.

The `RenderStage` interface retains `renderMode` and `projection` fields for potential future use by progression-mode commodities; tile mode is in the schema but unused by any MVP commodity.

---

## Volume computation

Two distinct volume concepts, used in different places and never confused.

**1. Intrinsic material volume** — the actual volume of pure substance. For cube mode this drives the cube's edge length directly. For progression mode this populates the readout strip ("0.5 BTC = 11 oz silver = 342 g · 32.6 cm³"). Computed from density:

```typescript
function computeIntrinsicVolumeCm3(amount: number, commodity: Commodity): number {
  if (commodity.unit === "barrel") {
    return amount * 158987; // 1 US barrel = 158,987 cm³
  }
  
  if (commodity.unit === "mmbtu") {
    return amount * 28_300_000; // 1 MMBtu natural gas ≈ 28.3 m³ at STP
  }
  
  if (commodity.unitMassGrams && commodity.densityGPerCm3) {
    const massGrams = amount * commodity.unitMassGrams;
    return massGrams / commodity.densityGPerCm3;
  }
  
  if (commodity.unitMassGrams && commodity.bulkDensityKgPerM3) {
    const massKg = (amount * commodity.unitMassGrams) / 1000;
    const volumeM3 = massKg / commodity.bulkDensityKgPerM3;
    return volumeM3 * 1_000_000;
  }
  
  throw new Error(`Cannot compute volume for ${commodity.id}: missing density data`);
}
```

**2. Visual stacking volume** — the apparent displayed size including container overhead, packing gaps, and handling fixtures. Used by the progression-mode sprite renderer only; cube mode does not use this concept. Derived from sprite-authored `realWorldWidthMetres` metadata via cube-root scaling.

### Reference density table

Values used in the Commodity schema. All figures are standard textbook references.

| Material | Density (g/cm³) | Notes |
|---|---|---|
| Gold | 19.30 | Pure 24k |
| Silver | 10.49 | Pure Ag |
| Platinum | 21.45 | Pure Pt |
| Palladium | 12.02 | Pure Pd |
| Copper | 8.96 | Pure Cu; slightly less for common alloys |
| Rhodium | 12.41 | Curio cabinet |
| Iridium | 22.56 | Densest of the PGMs |
| Osmium | 22.59 | Densest naturally-occurring element |
| UO2 (fuel pellet) | 10.97 | Sintered ceramic |
| Crude oil (Brent) | 0.835 | API ~38°; varies 0.79–0.87 by grade |
| Natural gas (methane) | 0.000717 at STP | At atmospheric pressure |
| Coffee beans (roasted) | 0.38 (bulk) | Bulk density, not particle density |
| Coffee beans (green) | 0.65 (bulk) | |

---

## Asset production pipeline

Reduced scope under the cube-mode pivot. The look of this site is its moat. Invest accordingly in the assets, but don't pay for assets cube mode obviates.

### Tools

- **Blender 4.5 LTS** — Intel Mac compatible; final version with official Intel Mac support, maintained until July 2027. CPU/Intel iGPU rendering acceptable given modest asset count.
- **Poly Haven** — CC0 HDRIs and PBR textures. Primary environment: `studio_small_09` (warm product shot).
- **CC0 sprite sources for references** — `thenounproject.com` (CC0 only), `openmoji.org` (CC0). For sourcing reference-object silhouettes.
- **SVG-direct authoring** — for simple references (grain of sand, pinhead, sugar cube) where Blender is overkill.

### Rendering specs

- **Format:** WebP with PNG fallback for cube sprites. SVG preferred for reference silhouettes. Transparent background. Contact shadow for cube sprites rendered separately as greyscale PNG.
- **Resolution:** Cube sprites at 1600×1600 px @ 2× density. Reference silhouettes at native SVG (scale-free) or 800×800 px @ 2× for PNG.
- **Camera (cube sprites):** three-quarter rig, 25° elevation, 30° azimuth, perspective ~50 mm focal length.
- **Lighting (cube sprites):** HDRI environment + single key light for product-shot specular. Consistent ~5500 K colour temperature.
- **Materials (cube sprites):** PBR metalness/roughness workflow. Reference values committed to `assets/materials-reference.md` and never tuned in Blender state alone.

### Asset count under cube mode

For the metals family (gold, silver, platinum, copper):
- 4 cube sprites (one per material), or 1 for launch with 3 to follow
- 1 set of contact-shadow masks (4 if all four materials authored)

Shared across all cube-mode commodities:
- ~18 reference-object sprites (most CC0-sourceable)

For progression-mode commodities (oil, gas, fuel pellet, coffee):
- Existing per-stage sprites per the progression sections above

Total launch metals payload: 1 cube + 1 shadow + ~18 references ≈ 20 assets, vs. ~40 under the prior 10-stage progression. Per-additional-metal cost after gold: ~2 assets (cube + shadow).

### Material reference values (PBR)

Locked in `assets/materials-reference.md`. The file is the canonical source — do not tune in Blender state without committing the values.

| Material | Base colour (linear sRGB) | Metalness | Roughness | Notes |
|---|---|---|---|---|
| Gold (24k) | (1.000, 0.770, 0.340) | 1.0 | 0.20 base, varied 0.15–0.28 procedurally | Warm yellow; procedural noise → bump (strength 0.025); macro roughness mottle |
| Silver | (0.972, 0.960, 0.915) | 1.0 | 0.08 | Mirror-polished, slightly cooler than white |
| Platinum | (0.673, 0.637, 0.585) | 1.0 | 0.15 | Cooler grey than silver |
| Copper | (0.722, 0.451, 0.200) | 1.0 | 0.22 | Patina variant (0.654, 0.455, 0.337) roughness 0.45 |
| Steel (drums, tankers) | (0.290, 0.336, 0.408) | 0.9 | 0.35 | With rust/paint layers per asset |

The gold values above are the iterated production values from `gold_good_delivery_single_final.py`, locked after a v1 → v3 iteration. Earlier drafts of this table cited roughness 0.12 — that was a design-time guess and is superseded.

### Production routes

**Solo Claude Code + Blender via Python (headless)** — primary route, proven on the 2026-04-25 cube-mode session. Blender is driven by versioned Python scripts in `scripts/blender/` invoked as `Blender --background --python <script>.py`. Outputs land directly in `static/sprites/{commodity}/`. The MCP server route was attempted in a prior session and did not work out — Python scripts are the working pipeline.

**Solo manual Blender** — fallback if a script fights back. The cube and lighting setup are simple enough that hand-driven Blender is not significantly slower than scripted for one-off authoring.

**Outsourcing** — not an option. No budget. Fallbacks are: simpler material on the cube, fewer reference entries, or shipping the minimum-viable library (£1 coin, person, bus, building, Eiffel Tower).

### Version control

Source `.blend` files for the cube and the rig live at `assets/blender/`. The directory must be tracked — gitignore was previously configured to exclude the entire tree, which silently lost the prior asset session's work. Verified gitignore rule: track `assets/blender/**/*.blend`, exclude `assets/blender/**/*.blend[0-9]*` and other Blender backup/temp files.

`assets/materials-reference.md` is also tracked and is the canonical material source. PBR values flow from that file into Blender, never the reverse.

---

## URL state design

```
/?btc=1&date=2024-01-15&unit=metric&commodity=silver&preset=pizza_day
```

| Param | Type | Default | Range/values |
|---|---|---|---|
| `btc` | float | 1 | 0.00000001 – 21,000,000 |
| `date` | ISO date | latest available | 2013-01-01 – yesterday |
| `unit` | enum | `metric` | `metric` \| `imperial` |
| `commodity` | string | none | commodity id; if set, scrolls to and highlights |
| `preset` | string | none | preset id; when set, loads preset's btc and date values |
| `currency` | enum | `usd` | `usd` \| `gbp` \| `eur` \| `jpy` \| `chf` \| `cad` \| `aud` |

On load: parse params, hydrate Svelte stores. If `preset` is set, its values take precedence. On any state change: `history.replaceState` to update URL without page reload. Debounce slider changes to 100 ms.

---

## Presets

Two categories at MVP launch:
- **Denominations** — 1 sat, 1 bit, 1 Nakamoto, 1 BTC, 21 BTC.
- **Absurdity** — Total supply (21M BTC), total market cap.

History and Entity preset categories deferred to editorial content and Phase 3.5 respectively. Preset rendering must skip empty categories — no empty section headings.

The full preset schema and dynamic resolver mechanism are unchanged from the prior spec.

---

## Scrubber component

Position fixed to bottom of viewport, ~80 px tall. Drag playhead to update `date`; play/pause/speed controls (1×, 10×, 100×); anchor event dots fire caption cards on crossing. Mobile uses dual-range design (coarse year + fine date). Keyboard controls per the prior spec. Accessibility: ARIA slider role, `prefers-reduced-motion` disables auto-play and crossfades.

---

## Anchor events (MVP set)

Stored in `src/lib/events.json`. Captions kept under 120 characters. Pizza Day, halvings, Mt Gox events, COVID crash, El Salvador adoption, FTX, ETF launch — full list per the prior spec, unchanged.

---

## Facts engine

Each commodity has 2–4 fact templates that substitute computed values. For cube-mode commodities, the facts engine reads from intrinsic mass and volume. For progression-mode, it reads from the same plus stage context.

```json
{
  "gold": [
    { "template": "about {n} standard wedding rings (~4 g each)", "divisor_kg": 0.004 },
    { "template": "{n} Good Delivery bars (400 oz each)", "divisor_kg": 12.4 }
  ]
}
```

The fact engine is unchanged from the prior spec. Cube mode doesn't need its own fact templates — the existing mass/volume-based templates work fine alongside cube rendering.

---

## File structure

```
btc-commodity-visualiser/
├── .github/workflows/daily-update.yml
├── data/prices.ndjson
├── public/
│   ├── prices.json
│   ├── meta.json
│   └── health.json
├── scripts/
│   ├── bootstrap.ts
│   ├── fetch-daily.ts
│   └── build-prices-json.ts
├── assets/
│   ├── blender/                          # tracked, gitignore allows .blend through
│   │   ├── _rigs/three_quarter.blend
│   │   ├── gold/cube.blend
│   │   └── references/                   # animal-reference sources
│   │       └── shiba_inu/                # scene.gltf, scene.bin, textures/, render.blend, notes.md, license.txt
│   ├── materials-reference.md            # canonical PBR values
│   ├── references-attribution.md         # animal-reference inventory + CC-BY attribution strings
│   └── style-guide.md
├── src/
│   ├── lib/
│   │   ├── commodities.ts
│   │   ├── scale-references.json         # NEW: cube-mode reference library
│   │   ├── events.json
│   │   ├── illustrative-prices.json
│   │   ├── stores/{url,prices,playback}.ts
│   │   └── components/
│   │       ├── PhysicalRep.svelte         # branches on renderStyle
│   │       ├── CubeRenderer.svelte        # NEW: cube-mode rendering
│   │       ├── ScaleReference.svelte      # NEW: single reference object renderer
│   │       ├── SpriteStage.svelte         # progression-mode stage renderer
│   │       ├── Scrubber.svelte
│   │       ├── CommoditySection.svelte
│   │       ├── AnchorCaption.svelte
│   │       └── QualityBadge.svelte
│   ├── routes/{...}
│   └── app.html
├── static/
│   ├── sprites/
│   │   ├── gold/cube@2x.webp              # cube-mode
│   │   ├── references/                    # shared reference library
│   │   │   ├── pound_coin.svg
│   │   │   ├── person.svg
│   │   │   ├── eiffel_tower.svg
│   │   │   ├── shiba_inu.webp             # animal references: rendered photoreal
│   │   │   ├── shiba_inu-shadow.png       # contact shadow alongside the sprite
│   │   │   └── ...
│   │   └── oil_brent/                     # progression-mode per existing pattern
│   └── models/
│       └── references/
│           └── shiba_inu/                 # animated .gltf for the easter-egg path
│               ├── scene.gltf
│               ├── scene.bin
│               └── textures/
└── ...
```

---

## Build phases

### Phase 0 — Data pipeline (complete)

### Phase 1 — Skeleton (complete)

### Phase 2a — Cube mode asset production (in flight)

- Fix gitignore to track `assets/blender/**/*.blend`
- Create `assets/materials-reference.md` with locked PBR values
- Create three-quarter camera rig
- Author gold cube sprite at canonical 100 mm edge length
- Author or source ~18 reference-object sprites
- Total scope: 1 cube + 1 shadow + ~18 references

### Phase 2b — Cube renderer integration (next)

- Implement `CubeRenderer.svelte` and `ScaleReference.svelte`
- Update `PhysicalRep.svelte` to branch on `renderStyle`
- Migrate gold commodity entry to `renderStyle: "cube"`
- Verify continuous rendering across the full slider range

### Phase 2c — Vessel and bulk vocabularies

- Author oil tanker sprites (Aframax, VLCC, fleet)
- Author LNG carrier sprites (Moss-type, Q-Max, fleet)
- Verify progression-mode renderer handles vessel stages cleanly
- Coffee progression authored or verified against existing stubs
- Fuel pellet progression authored

### Phase 3 — Scrubber & events

### Phase 3.5 — Entity holdings automation

### Phase 4 — Polish & ship

### Phase 5 — Optional Three.js hero scenes

### Phase 6 — Curio cabinet, affiliates, newsletter cadence

---

## Defensibility / moat notes

The dataset, the visual quality, the audience, category ownership, and editorial voice — unchanged from the prior spec. The cube-mode pivot strengthens the visual-quality moat: a beautifully rendered cube of substance against a curated reference library is more distinctive than a stage-based progression, and the reference library itself becomes a small authority signal (citable, CC0-friendly to publish alongside the prices dataset).

---

*End of spec.*