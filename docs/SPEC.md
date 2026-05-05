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

Two render styles only at launch — **cube mode** and **still-with-readout**. Tile mode and progression mode are preserved in the schema for potential post-launch revival; no launch commodity invokes them.

**Cube mode** — for dense fungible substances. A single authored cube sprite, rendered at the substance's true volume via cube-root scaling, against a single universal scale reference (a Shiba Inu at true 40 cm height). One cube sprite per material, one reference dog shared across every cube panel. Continuous growth, no stage transitions, no cross-fade artefacts. Pu-238 layers a blackbody glow and an opt-in Geiger crackle on top of the cube; both are properties of the cube renderer rather than separate render modes.

Applies to: gold, silver, Pu-238.

**Still-with-readout mode** — for the single editorial commodity. A fixed forensic-evidence-room still paired with a bold dynamic readout showing the weight purchasable at the slider's BTC amount. No cube, no scale dog, no progression stages. The image carries register; the readout carries truth at extremes.

Applies to: cocaine.

The two vocabularies are internally coherent and never mix within a single commodity section. The renderer branches on `commodity.renderStyle` (`'cube' | 'still'` at launch; `'progression'` and the legacy `'vessel'` / `'bulk'` stubs preserved in the schema for post-launch use).

---

## Cube mode

For dense fungible substances, a single cube of true substance volume is the physical visualisation. The cube's edge length grows continuously with the slider via cube-root scaling. Alongside the cube, a single universal scale reference (the Shiba Inu) is rendered at its true 40 cm height. The cube and the dog never resize relative to each other — the camera viewport scales to keep both on screen at sensible margins.

### Rendering rule

```typescript
function renderCubeCommodity(commodity: Commodity, amount: number): CubeRenderState {
  // 1. Compute mass and intrinsic volume
  const massGrams = amount * commodity.unitMassGrams;
  const volumeCm3 = massGrams / commodity.densityGPerCm3;

  // 2. Cube edge length
  const edgeLengthMm = Math.cbrt(volumeCm3) * 10;  // cm³ → cm → mm

  // 3. Universal Shiba at true 40 cm height; viewport zooms to fit both
  const dogHeightMm = 400;
  const zoom = computeViewportZoom(edgeLengthMm, dogHeightMm);

  return { cube: { edgeLengthMm }, dog: { heightMm: dogHeightMm }, zoom };
}
```

The cube sprite is identical at every amount; only its CSS-rendered size changes. The dog is rendered at its own true size, never scaled. The two objects share a coordinate system so the user reads relative size honestly: a 40 cm dog next to a 5 cm gold cube is a 5 cm gold cube.

### Universal scale reference

A single Shiba Inu, anchored at true real-world height of **40 cm**, is the universal scale reference on every cube-mode panel (gold, silver, Pu-238). The dog never moves or resizes in real-world terms — the camera viewport scales to keep both the cube and the dog in frame.

At sub-millimetre cube sizes the viewport zooms in until the dog fills most of the frame and the cube is a microscopic dot at its paw. At multi-metre cube sizes the viewport zooms out until the dog is a recognisable speck at the cube's foot. The relative-size reading is always honest: a 40 cm dog next to a 5 cm gold cube is a 5 cm gold cube.

Cocaine is the single exception. Its forensic-still register is set entirely by the image; introducing a 40 cm reference dog would muddle the editorial mood the still does on its own.

`src/lib/scale-references.json` reduces to a single entry under this scheme:

```typescript
interface ScaleReference {
  id: "shiba_inu";
  displayName: "Shiba Inu";
  realSizeMetres: 0.4;
  measurementAxis: "height";
  spritePath: string;            // /sprites/references/shiba_inu.webp
  shadowPath: string;            // /sprites/references/shiba_inu-shadow.png
  animatedModelPath?: string;    // optional easter-egg .gltf
}
```

The cycling reference library used by earlier drafts (~20 entries from grain of sand to Empire State Building, picked on log-scale closest match) is deleted. Stage 2 of the marathon session is the cutover.

### Universal-Shiba viewport

The cube renderer maintains a single zoom factor that keeps both objects on screen with sensible margins. The cube and dog are placed in the same coordinate system at their true mm sizes; the viewport applies the zoom uniformly:

```typescript
function viewportZoom(cubeEdgeMm: number, dogHeightMm = 400): number {
  const longest = Math.max(cubeEdgeMm, dogHeightMm);
  return computeZoomToFit(longest, viewportWidthMm, viewportHeightMm);
}
```

This is the only camera primitive cube mode needs. No log-scale reference picking, no cross-fade transitions between references, no per-amount sprite swaps.

### Reference sprite — Shiba

Rendered through the same Blender pipeline as the metal cubes (canonical: `scripts/blender/shiba_inu.py`, which inherits `scripts/blender/gold_cube.py`). Same camera rig, HDRI, three-light setup, intrinsic transparent margin, separate contact-shadow PNG. Output is WebP at the same 1600×1600 canvas as the cube. An animated `.gltf` lives at `static/models/references/shiba_inu/scene.gltf` for the easter-egg path described below.

#### Easter egg — animated Shiba

The static Shiba sprite is the default render. A `<model-viewer>` element swaps in the animated `.gltf` on three trigger paths, all gated by `prefers-reduced-motion: reduce` (when set, the static sprite always wins):

- **Hover (desktop):** pointer dwell on the dog for ≥200 ms.
- **Sustained tap (mobile):** touch held for ≥500 ms; auto-reverts after 8 s.
- **URL parameter:** `?easter=doge` auto-animates the dog whenever a cube-mode panel is on screen.

`@google/model-viewer` and the `.gltf` are both lazy-loaded — neither hits the network on initial page load. Implementation: `src/lib/components/ScaleReference.svelte`.

### Cube sprite specifications

One authored cube per metal, rendered in Blender at the standard three-quarter rig (25° elevation, 30° azimuth, ~50 mm focal length). Material per `assets/materials-reference.md`. Canonical render size 100 mm edge length, 1600×1600 px @ 2× density, transparent background, separate greyscale contact-shadow PNG.

The cube is what most users will see most often (~24 mm edge length at 1 BTC today's prices). It must read as the correct substance at first glance, with proper specular highlights, slight edge bevels (real cast metal isn't razor-sharp), and material-appropriate surface character. Test during authoring at the displayed size, not just at canonical size.

For launch: gold and silver cubes are authored. Pu-238 follows the same geometry and lighting rig with a Pu-238-specific PBR material — roughly an hour per material once the rig is locked. Platinum, copper, and other deferred metals re-enter post-launch.

### Pu-238 overlays

Pu-238 layers two effects on top of the cube. Both are properties of the cube renderer triggered by per-commodity flags, not separate render modes.

**Blackbody glow** — triggered by `commodity.glowScales === true`. Two channels driven independently by mass:

- **Intensity** — climbs faster than colour temperature. Tied to absolute glow output (radiative flux scales with mass × specific activity).
- **Colour temperature** — climbs slowly. Cool red at sub-gram amounts, dull-orange at ~1 g (which matches photographs of real Pu-238 fuel pellets glowing from their own decay heat), bright-yellow at multi-kilogram amounts where in reality the metal would melt itself.

The visualisation has the luxury of nothing spontaneously disassembling. Pure plutonium metal at multi-kilogram mass would self-destruct from its own decay heat in reality, but the cube on screen is what the dial says it is. A "would melt itself in reality" caption fires at relevant mass thresholds as honest commentary on what physics says about the real world. Exact threshold values (a function of mass × surface-area-to-volume, geometry-corrected) land in Stage 6.

**Geiger crackle** — triggered by `commodity.geigerCrackle === true`, default off. Persisted via `?audio=on` URL state. Click events are synthesised from a Poisson distribution at a rate proportional to specific activity (~17 Ci/g for pure Pu-238 — click rate scales linearly with mass). Honest physics: the clicks are real Poisson events, not a looped recording.

Both layers are scoped to Pu-238 alone. Gold and silver render as plain cubes against the dog.

### What cube mode does not have

- No stage transitions. The cube is one sprite at all amounts.
- No tile mode. Tile-mode schema fields exist for potential future use by other commodities but are unused by any commodity at launch.
- No comparison-card fallback. The universal Shiba and the viewport zoom cover the full slider range; comparison cards were a progression-mode feature and are deferred with progression mode.
- No cycling reference library. Earlier drafts cycled through ~20 references (grain of sand to Empire State Building) picked by closest log-scale match; that scheme is superseded by the universal Shiba.
- No standalone £1 coin or human silhouette. Both were entries in the prior reference library and are gone.

---

## Still-with-readout mode

The single editorial commodity (cocaine) renders as a fixed forensic-evidence-room still paired with a bold dynamic readout showing the weight purchasable at the slider's BTC amount.

### Rendering rule

The still image is authored once at portfolio quality — forensic-still register: clinical, evidential, lab-tagged. The readout is the only thing that updates with the slider. There is no cube, no scale dog, no Y-axis, no quantity anchors, no stage transitions. The image carries register; the readout carries truth.

### Readout

Weight in grams primary, with mass-tier labelling that follows the value: `milligrams` at sub-gram amounts, `grams` in the working range, `kilograms` at >1 kg, `tonnes` at >1000 kg. At extremes the readout carries the truth honestly — at 1 sat the readout reads "≈ a few molecules"; at 21M BTC it reads in tonnes, with a stadium-equivalent comparison line. Specific tier copy and threshold values land in Stage 5.

### Why no dog

Introducing the 40 cm reference Shiba into the forensic-still mood would muddle the editorial register the still does on its own. The mood is set by the image; the only dynamic element is the weight readout. This is the deliberate exception to the universal-Shiba scheme.

---

## Progression mode (deferred from MVP)

Preserved in the schema for potential post-launch revival; no `mvpLaunch: true` commodity at launch invokes it. Stage definitions and cross-fade machinery for prior progression commodities (oil-vessel, coffee, the uranium fuel pellet) remain in the codebase under their existing entries, now flagged inactive. The vessel and bulk renderer stubs in `PhysicalRep.svelte` continue to throw "not implemented" — they're not wired up for any launch commodity.

The 2026-04-25 decision to move metals from progression mode to cube mode stands; the 2026-05-04 decision narrows the launch set to four commodities and demotes progression mode to deferred-from-MVP for everything else. Coffee, oil-vessel, and uranium-fuel-pellet schema entries are intact and can be re-enabled by flipping `mvpLaunch: true`.

---

## MVP commodity catalogue

| ID | Display name | Render style | Unit | Density (g/cm³) | Data source |
|---|---|---|---|---|---|
| `gold` | Gold | cube | troy oz | 19.30 | stooq `xauusd` |
| `silver` | Silver | cube | troy oz | 10.49 | stooq `xagusd` |
| `copper` | Copper | cube | lb | 8.96 | stooq `hg.c` |
| `oil_brent` | Brent crude | progression (vessel) | barrel | 0.835 | FRED `DCOILBRENTEU` |
| `uranium_fuel_pellet` | Nuclear fuel pellet | progression | pellet (7 g) | 10.97 | illustrative |

**MVP optional:**

| ID | Display name | Render style | Unit | Density | Data source |
|---|---|---|---|---|---|
| `platinum` | Platinum | cube | troy oz | 21.45 | stooq `xptusd` |
| `coffee` | Arabica coffee | progression (bulk) | lb | 0.38 (bulk roasted) | stooq `kc.c` |

**Ordering rationale:** gold (cube, universally familiar) → silver (cube, denser visual contrast) → copper (cube, industrial) → oil (vessel, fluid) → uranium fuel pellet (progression, philosophical closer). The cube-mode commodities sit together at the start of the tour, fluids in the middle, the fuel pellet's distinctive non-cube vocabulary at the end.

**Deliberately excluded from MVP:** wheat, corn, soybeans, sugar, cocoa. Agri commodities share a "sack of brown stuff" visual problem — they read redundantly. Coffee gets a spot for its distinct visual vocabulary; the rest are skipped. Can be added in Tier 2 if post-launch data shows demand.

**Diamonds are not included** at any tier. Unlike fungible commodities, diamond prices depend on the 4 Cs (carat, colour, clarity, cut) and there is no public spot price.

---

## Commodity metadata schema

```typescript
interface Commodity {
  id: string;
  displayName: string;
  renderStyle: "cube" | "progression";
  unit: "troy_oz" | "lb" | "barrel" | "gram" | "kg" | "pellet";
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