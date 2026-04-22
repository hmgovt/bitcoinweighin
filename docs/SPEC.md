# Bitcoin Weigh-In — Build Spec

*A handoff document for Claude Code. Written 19 April 2026. Domain: bitcoinweighin.com*

---

## Project identity

**Name:** Bitcoin Weigh-In
**Domain:** bitcoinweighin.com
**Tagline candidates:** "What does a bitcoin weigh?" · "Bitcoin, measured." · "The purchasing power of one coin, in things you can hold."
**Brand voice:** honest, precise, slightly dry. Never hypey. The name does the heavy lifting — copy should support, not oversell. "Weigh-in" is both the activity (measuring) and the stance (a considered take). Every commodity section is a weigh-in. The newsletter is *This Week's Weigh-In*.

---

## Concept (one paragraph)

A single long-scroll page that renders — at true relative scale — what a user-selected amount of bitcoin currently buys across a curated set of commodities. Each commodity section has a physical-object visualisation with a persistent human silhouette for scale. A sticky date scrubber at the bottom animates the entire page across BTC's price history from 2013 to today, with anchor-event captions firing as the playhead crosses them. All state (BTC amount, date, unit system) is URL-encoded and therefore shareable. No runtime backend — one static JSON blob refreshed daily via GitHub Actions.

---

## Core principles

- **Static first.** Every price in memory, served from CDN. No runtime API calls to price feeds. Full history is a single JSON file.
- **One source of truth.** One combined daily-closes file, target ~3-5 MB gzipped, covering all commodities 2013-01-01 to yesterday.
- **Shareable state.** Every slider + date position is a URL. Copy-paste reproduces the view exactly.
- **Graceful degradation at extremes.** At 0.001 BTC the silver stack is two coins; at 10 BTC the copper pile is cartoonishly huge. Both should look intentional, not broken.
- **Privacy-respecting.** No account system. Plausible or Umami analytics only. No third-party trackers.
- **Mobile-first.** Majority of shares will be read on phones. Touch-scrub the timeline. Vertical scroll is the primary axis.

---

## MVP commodity catalogue (8 items)

| ID | Display name | Unit | Density (g/cm³) | Physical representation | Data source |
|---|---|---|---|---|---|
| `gold` | Gold | troy oz | 19.30 | Grain → coin → small bar → kilo bar → Good Delivery bar → stack | stooq `xauusd` |
| `silver` | Silver | troy oz | 10.49 | Coin → tube → monster box → shoebox → pallet | stooq `xagusd` |
| `copper` | Copper | lb | 8.96 | Penny → wire coil → 1-lb bar → brick stack → pallet | stooq `hg.c` |
| `oil_brent` | Brent crude | barrel | 0.835 (liquid) | Jerrycan → drum → drum cluster → road tanker → tank farm | FRED `DCOILBRENTEU` |
| `natgas` | Natural gas | MMBtu | gaseous (0.000717 at STP) | Translucent wireframe cube with equivalent-object captions | FRED `DHHNGSP` |
| `uranium_fuel_pellet` | Nuclear fuel pellet (LEU UO2) | pellet (7 g) | 10.97 (ceramic UO2) | Single pellet → handful → full fuel rod's worth → pallet | `illustrative`, composite ~$20/pellet (fuel fabrication cost: U feed + conversion + SWU + fabrication ≈ $3,000/kgU) |

**MVP optional (include if asset production allows):**

| ID | Display name | Unit | Density (g/cm³) | Physical representation | Data source |
|---|---|---|---|---|---|
| `platinum` | Platinum | troy oz | 21.45 | Grain → coin → small bar → kilo bar (denser than gold, tighter package) | stooq `xptusd` |
| `coffee` | Arabica coffee | lb | bulk (~380 kg/m³ roasted, ~650 green) | Espresso cup → retail bag → 60-kg jute sack → warehouse stack | stooq `kc.c` |

**Ordering rationale:** gold (universally familiar) → silver (dramatic scale jump) → copper (industrial mass) → oil (fluid, volume shock) → natural gas (invisible, stylised) → uranium fuel pellet (the philosophical punchline: 1 BTC ≈ 4,500 pellets ≈ electricity for ~1,650 UK homes for a year). The fuel pellet closes the tour with the most energy-dense substance humanity uses at scale, after demonstrating purchasing power across metals and fuels. Platinum and coffee, if included, slot between copper and oil for variety.

**Deliberately excluded from MVP:** wheat, corn, soybeans, sugar, cocoa. Agri commodities share a "sack of brown stuff" visual problem — they read redundantly. One agri (coffee, optional) gets a spot for its distinct visual vocabulary and relatable frame ("what a bitcoin buys you at Starbucks forever"); the rest are skipped. Can be added in Tier 2 if post-launch data shows demand.

**Diamonds are not included** at any tier. Unlike fungible commodities, diamond prices depend on the 4 Cs (carat, colour, clarity, cut) and there is no public spot price — the Rapaport Price List is subscription-only and structured as a matrix, not a single series. Additionally, the lab-grown-diamond revolution has made natural diamond prices chaotic and falling. A site built on honest, reproducible data should not try to represent a market this opaque.

**Further commodities** — conventional Tier 2 expansions, and a separate Tier 3 "curio cabinet" of exotic materials — detailed in the *Expanded commodity tiers* section below.

---

## Physical representation engine

**Approach:** pre-rendered realistic sprites with CSS-scaled transitions. No rotation, no user-controlled camera. The asset is a beautifully lit still image per progression stage, not a real-time 3D scene. This gives photoreal quality at mobile-friendly performance with tractable production cost.

**Optional hero upgrades:** one or two commodities (likely gold and oil) may get a Three.js scene in Phase 4 purely for subtle idle animation (slow parallax drift, flame flicker, liquid surface ripple). This is optional polish, not required for launch.

### Scale reference system

Two fixed references plus a text-comparison fallback. No menagerie of mid-range objects.

**1. Coin reference (small anchor).** A single £1 coin, always rendered at the small end of the visible area at **actual physical size** using CSS `mm` units. Exploits the browser's awareness of viewport DPI — on a calibrated desktop monitor the coin will render at roughly 23.43 mm. Not perfectly accurate across every device, but convincingly close on most. A small "actual size" badge near the coin confirms intent. (Locale detection may substitute €1 or US quarter later; MVP ships with £1.)

**2. Human silhouette (large anchor).** Fixed at 1.75 m true height. Rendered only when the commodity sprite's displayed size exceeds ~30 cm. Below that threshold the silhouette is hidden — a 1.75 m person next to a single gold coin is visually absurd and makes the coin unreadable. Above the threshold, the silhouette and commodity sprite share a coordinate system and scale together.

**3. Text-comparison cards (extreme-end fallback).** When the commodity's displayed size would exceed the realistic viewport area (roughly 3× the human silhouette — i.e. >5 m of physical extent), stop trying to render at true scale. The sprite caps at a sensible display size and a comparison card appears below: "≈ 3 London buses end-to-end" or "fills 1.2 Olympic swimming pools". These are authored strings in a shared comparison library indexed by mass (kg) and volume (m³), selected at render time by finding the closest-matching card. Zero extra rendering cost, infinitely extensible.

The coin anchors the small end; the human anchors the middle; the text card handles the huge end. The commodity sprite flows continuously between them. No discrete reference-object swaps mid-scroll, no cultural specificity problem, no production burden of rendering a bestiary of reference objects.

**Viewport behaviour:**

| Commodity display size | Coin shown | Silhouette shown | Text card shown |
|---|---|---|---|
| < 1 cm | yes, actual size | no | no |
| 1-30 cm | yes, actual size | no | no |
| 30 cm - 5 m | optional (can fade out) | yes, true scale | no |
| > 5 m | no | yes (dwarfed, for drama) | yes |

**Comparison card library example:**

```json
{
  "by_mass_kg": [
    { "min": 1, "max": 10, "template": "a bag of sugar" },
    { "min": 10, "max": 100, "template": "a car tyre (~15 kg each)" },
    { "min": 100, "max": 1000, "template": "a small motorcycle" },
    { "min": 1000, "max": 10000, "template": "a small car" },
    { "min": 10000, "max": 100000, "template": "a London double-decker bus (~12 t)" },
    { "min": 100000, "max": 1000000, "template": "a blue whale (~150 t)" }
  ],
  "by_volume_m3": [
    { "min": 10, "max": 100, "template": "a shipping container (33 m³)" },
    { "min": 100, "max": 2500, "template": "Olympic swimming pool (2500 m³)" },
    { "min": 2500, "max": null, "template": "{n} Olympic swimming pools" }
  ]
}
```

Comparison cards are text-only. No sprites needed. Easy to localise per market (swap bus → yellow schoolbus for US audiences) in Phase 6.

### Commodity metadata schema

```typescript
interface Commodity {
  id: string;
  displayName: string;
  unit: "troy_oz" | "lb" | "barrel" | "mmbtu" | "bushel" | "gram" | "kg";
  unitMassGrams?: number;        // omit for fluids/gases/bulk
  densityGPerCm3?: number;       // omit for fluids/gases/bulk
  render: RenderProgression;
  facts: FactTemplate[];         // e.g. "enough copper to wire {n} homes"
  affiliate?: { url: string; label: string; disclosure: string };
  sourceId: string;              // matches key in prices.json
  sourceName: string;            // human-readable, for methodology page
  dataQuality: "live" | "indicative" | "historical" | "illustrative";
}

interface RenderProgression {
  stages: Array<{
    id: string;                  // e.g. "coin", "stack", "monster_box"
    maxValue: number | null;     // unit amount; null = final stage
    spritePath: string;          // e.g. "/sprites/silver/stack@2x.webp"
    spriteWidthPx: number;       // native render width in pixels
    realWorldWidthMetres: number;// the actual physical width the sprite depicts
    caption?: string;            // optional override for readout strip
  }>;
  heroScene?: "gold" | "oil";    // optional Three.js upgrade flag
}
```

The `humanScaleRef` field is removed — silhouette visibility is now computed at render time from the displayed size of the commodity sprite, not declared per commodity.

### Renderer contract

A single Svelte component `<PhysicalRep commodity={c} amount={n} />` that:

1. Computes mass and/or volume from `amount × unitMass` and density (or fluid volume for liquids/gases)
2. Picks the appropriate stage from `render.stages` based on `amount`
3. Computes the target physical display width in millimetres: `stageRealWorldWidthMetres × 1000 × (computedVolume / stageReferenceVolume)^(1/3)`
4. Renders the stage sprite at that physical width using CSS `mm` units (falling back to scaled pixels on devices that ignore physical units)
5. Renders the **£1 coin reference** at actual physical size (23.43 mm) in the corner, always
6. Renders the **human silhouette** only when the computed commodity display width exceeds 300 mm; hidden otherwise
7. Renders a **comparison card** below the scene only when the computed display width exceeds 5000 mm; selected from the comparison library by matching computed mass or volume
8. At stage boundaries, cross-fades between sprites over 300 ms to avoid popping
9. Renders a readout strip below: **mass** · **volume** · **one fact** · **comparison card (if present)**
10. Shows a subtle `(market closed — Friday close)` tag when the current date's value was forward-filled

### Scaling strategy

Each sprite is rendered at a canonical "reference amount" during production — e.g. the silver "monster_box" sprite depicts exactly 500 ounces. The renderer scales up or down from that reference using the cube-root rule until the next stage threshold is crossed. Stage thresholds should be set so that adjacent stages overlap visually — i.e. the top of "stack" and the bottom of "monster_box" look similar in size — which makes the cross-fade read as continuous rather than jarring.

The sprite's rendered physical width is derived from its `realWorldWidthMetres` metadata and the computed volume ratio, not from arbitrary CSS. This lets the renderer claim "actual size" for small commodities on calibrated displays and scale proportionally once we're past the viewport-physical threshold.

### Progression examples (sprite stages)

**Gold** (very dense, small visual):
1. `grain` — loose flake, ref 0.1 g
2. `coin` — single 1 oz Britannia, ref 31 g
3. `small_bar` — 100 g LBMA bar, ref 100 g
4. `kilo_bar` — 1 kg investment bar, ref 1 kg
5. `good_delivery` — 400 oz LBMA bar, ref 12.4 kg
6. `bar_stack` — palletised stack, scales upward

**Silver** (less dense, dramatic jumps):
1. `coin` — 1 oz round, ref 31 g
2. `tube` — 20-coin tube, ref 620 g
3. `monster_box` — 500 oz US Mint green box, ref 15.5 kg
4. `shoebox_pile` — loose 1 oz bars, ref 35 kg (≈ 1 BTC today)
5. `pallet` — industrial 1000 oz bars stacked, scales upward

**Platinum** (ultra dense, stays tiny):
1. `grain`
2. `coin` — 1 oz American Eagle
3. `small_bar` — 100 g bar
4. `kilo_bar` — 1 kg bar

**Copper** (bulky, industrial):
1. `penny` — single US cent for scale nostalgia
2. `wire_coil` — 10 lb wire coil
3. `bar_1lb` — rounded bar, ref 454 g
4. `brick_stack` — stacked bricks
5. `pallet` — industrial pallet
6. `ingot_pile` — final stage, multiple tonnes

**Oil** (liquid, volume-dominant):
1. `jerrycan` — 5 gallon can, for small amounts
2. `drum` — 55-gallon blue steel drum, ref 1 barrel (42 US gal)
3. `drum_cluster` — 10 drums
4. `road_tanker` — articulated tanker, ref ~200 barrels
5. `tank_farm` — cylindrical storage tanks
6. `pool` — swimming pool overlay for extreme volumes

**Natural gas** (the visualisation problem):
- No sprite-scalable progression works physically — gas is invisible and takes stupid amounts of volume
- Solution: translucent cyan wireframe cube with subtle vapour animation inside, labelled with equivalent-object captions ("≈ X Olympic swimming pools at STP", "≈ heating Y UK homes for Z years")
- Accept this is stylised, not photoreal — it's the one honest exception

**Uranium fuel pellet** (illustrative, MVP core):
1. `single_pellet` — one matte-black ceramic cylinder, ~8 mm × 13 mm, on neutral surface with £1 coin for scale
2. `handful` — cupped-hands worth, ~50 pellets
3. `fuel_rod_worth` — the ~350 pellets loaded into one full fuel rod, arranged linearly
4. `shoebox_pile` — ~4,500 pellets (≈ 1 BTC at current prices), the hero visual
5. `pallet` — bulk storage quantity

**Coffee** (bulk agri, MVP optional):
1. `cup` — single espresso cup, ref ~18 g beans
2. `bag_1kg` — retail roastery bag
3. `jute_sack_60kg` — industry-standard hessian sack with green-bean texture
4. `warehouse_stack` — sacks on pallets

### Volume computation

Two distinct volume concepts, used in different places and never confused:

**1. Intrinsic material volume** — the actual volume of pure substance. Used in the text readout strip: *"0.5 BTC = 11 oz silver = 342 g · 32.6 cm³"*. Computed from density:

```typescript
function computeIntrinsicVolumeCm3(amount: number, commodity: Commodity): number {
  // Volume-native commodities (oil in barrels) — use their unit directly
  if (commodity.unit === "barrel") {
    return amount * 158987; // 1 US barrel = 158.987 L = 158,987 cm³
  }
  
  // Gas: report volume at STP using energy-to-volume conversion
  if (commodity.unit === "mmbtu") {
    // 1 MMBtu natural gas ≈ 28.3 m³ at STP (standard temperature/pressure)
    return amount * 28_300_000; // cm³
  }
  
  // Mass-based commodities with known density
  if (commodity.unitMassGrams && commodity.densityGPerCm3) {
    const massGrams = amount * commodity.unitMassGrams;
    return massGrams / commodity.densityGPerCm3;
  }
  
  // Bulk commodities (agri) — use bulk density
  if (commodity.unitMassGrams && commodity.bulkDensityKgPerM3) {
    const massKg = (amount * commodity.unitMassGrams) / 1000;
    const volumeM3 = massKg / commodity.bulkDensityKgPerM3;
    return volumeM3 * 1_000_000; // convert m³ to cm³
  }
  
  throw new Error(`Cannot compute volume for ${commodity.id}: missing density data`);
}
```

**2. Visual stacking volume** — the apparent displayed size including container overhead, packing gaps, and handling fixtures. Used by the sprite renderer. Never computed from first principles; always derived from the sprite's authored `realWorldWidthMetres` metadata using cube-root scaling:

```typescript
function computeDisplayWidthMm(amount: number, stage: RenderStage): number {
  const quantityRatio = amount / stage.referenceAmount;
  const scaleFactor = Math.cbrt(quantityRatio); // visual size grows as cube root of volume
  return stage.realWorldWidthMetres * 1000 * scaleFactor;
}
```

The two are related but distinct. A 1,000 oz silver crate has an intrinsic silver volume of ~2,960 cm³ (3 litres), but displays visually as ~50 cm wide — reflecting the physical crate, the packing, the stacking pattern. The readout text shows the truthful intrinsic value; the sprite shows the relatable visual.

### Reference density table

Values used in the Commodity schema. All figures are standard textbook references.

| Material | Density (g/cm³) | Notes |
|---|---|---|
| Gold | 19.30 | Pure 24k |
| Silver | 10.49 | Pure Ag |
| Platinum | 21.45 | Pure Pt |
| Palladium | 12.02 | Pure Pd (Tier 2) |
| Copper | 8.96 | Pure Cu; slightly less for common alloys |
| Rhodium | 12.41 | Curio cabinet |
| Iridium | 22.56 | Densest of the PGMs |
| Osmium | 22.59 | Densest naturally-occurring element |
| UO2 (fuel pellet) | 10.97 | Sintered ceramic, slightly below theoretical 10.97 — use 10.50 if modelling real pellets with 95% theoretical density |
| Crude oil (Brent) | 0.835 | API ~38°; varies 0.79–0.87 by grade |
| Natural gas (methane) | 0.000717 at STP | At atmospheric pressure; much higher if liquefied or compressed |
| Coffee beans (roasted) | 0.38 (bulk) | Bulk density, not particle density |
| Coffee beans (green) | 0.65 (bulk) | |

For bulk agri commodities (if added later), use bulk density in `bulkDensityKgPerM3` rather than solid density. Bulk densities carry ±5–10% uncertainty and should be documented as "typical" values on the methodology page.

### Commodity metadata schema (updated)

```typescript
interface Commodity {
  id: string;
  displayName: string;
  unit: "troy_oz" | "lb" | "barrel" | "mmbtu" | "gram" | "kg" | "pellet";
  unitMassGrams?: number;            // mass per unit; omit for volume-native (barrel, mmbtu)
  densityGPerCm3?: number;           // solid density for pure materials
  bulkDensityKgPerM3?: number;       // used for agri; takes precedence over solid density if both present
  render: RenderProgression;
  facts: FactTemplate[];
  affiliate?: { url: string; label: string; disclosure: string };
  sourceId: string;
  sourceName: string;
  dataQuality: "live" | "indicative" | "historical" | "illustrative";
}
```

### Data quality treatment

Not all commodities have live daily data. The `dataQuality` field drives UI treatment:

- **live** — daily close from a free/reliable source. Treat as authoritative. No UI flag.
- **indicative** — weekly or monthly broker averages (e.g. uranium U3O8). Forward-fill aggressively; display a small "indicative" badge near the readout.
- **historical** — no current data; last known reliable print is annotated with date. Display "as of [date]" clearly. Slider and scrubber freeze at that date for that commodity.
- **illustrative** — scientific/industry reference price used for commodities that are not freely traded (enriched uranium, tritium, californium). Clearly labelled "**Illustrative price** — based on [source, date]". Do not compound with BTC price as if it were live.

The dataQuality flag also controls scrubber behaviour: during playback, illustrative commodities freeze with a subtle "frozen" overlay rather than appearing to update.

### Illustrative prices — data pattern

Commodities with `dataQuality: "illustrative"` are not fetched into the daily `prices.json` pipeline. They live in a separate file, `src/lib/illustrative-prices.json`, loaded at build time alongside the main price data.

**Why separate:** illustrative prices are composite engineering estimates (fuel pellet, californium) or reference values from thinly-traded markets, not time-series from any exchange. They don't change day-to-day in any meaningful way. Treating them as a daily series would create a false sense of precision and complicate the fetch pipeline.

**Structure:**

```json
{
  "uranium_fuel_pellet": {
    "pricePerUnit": 20,
    "unit": "pellet",
    "unitMassGrams": 7,
    "asOfDate": "2025-01-01",
    "sources": [
      "World Nuclear Association — 'Economics of Nuclear Power' (world-nuclear.org)",
      "IAEA/OECD-NEA Red Book 2024"
    ],
    "methodology": "Composite cost: U3O8 feed at ~$100/lb, conversion to UF6 at ~$20/kgU, SWU at ~$150/SWU, fabrication at ~$300/kgU, yielding ~$3,000/kgU of finished fuel. Divided by 7 g/pellet = ~$20/pellet.",
    "notes": "Low-enriched uranium (LEU, 3–5% U-235) fuel pellet for PWR reactors. Order-of-magnitude estimate; actual fuel costs vary ±30% by contract terms, enrichment level, and market conditions."
  },
  "californium_252": {
    "pricePerUnit": 27000000,
    "unit": "gram",
    "asOfDate": "2024-01-01",
    "sources": [
      "US Department of Energy Isotope Program pricing (isotopes.gov)",
      "Oak Ridge National Laboratory Californium supply"
    ],
    "methodology": "DOE Isotope Program list price for Cf-252 neutron sources. Extremely thin market; few grams produced worldwide annually.",
    "notes": "Cf-252 is the most expensive commercially-available substance on Earth by unit mass."
  }
}
```

**Renderer behaviour:**

- On page load, the commodity catalogue merges `prices.json` (for live commodities) with `illustrative-prices.json` (for illustrative ones)
- Illustrative commodities display a small "Illustrative price" badge near the readout
- The methodology page links each illustrative commodity's price to its source and explains the composite calculation
- During scrubber playback, illustrative commodities do not recompute — they show their static value with a subtle "frozen" visual state so the user understands why they're not animating
- Historical scrub dates display the as-of date of the illustrative value, not the scrub date, to avoid implying the value was that specific number in, say, 2015

**Source attribution is mandatory.** Every illustrative entry must have at least one citable public source. This is part of the honesty story that makes the "1 BTC ≈ 4,500 fuel pellets ≈ power for 1,650 homes" claim land rather than feel like hype. If a source cannot be found for a proposed illustrative commodity, the commodity should not be included.

---

## Data pipeline

### Bootstrap (one-time)

Script `scripts/bootstrap.ts` fetches full history from each source from 2013-01-01 to today. Writes `data/prices.ndjson` (newline-delimited JSON, append-only, one row per date):

```json
{"date":"2013-01-01","btc":13.30,"xau":1664.75,"xag":30.19,"xpt":1555.00,"hg":3.64,"brent":111.38,"natgas":3.35,"wheat":7.78,"coffee":1.44}
```

### Daily cron (GitHub Actions)

Workflow `.github/workflows/daily-update.yml` runs daily at 02:00 UTC:

1. Fetch yesterday's close for each commodity from its source
2. Append single row to `data/prices.ndjson`
3. Run build script: pivot NDJSON into `public/prices.json` — keyed by ISO date
4. Write `public/meta.json`: `{ lastUpdated, sources, forwardFilledDates }`
5. Commit, push, Cloudflare Pages redeploys automatically

### Edge cases

- **Weekends/holidays:** commodities don't trade. BTC does. Forward-fill commodity values from the last available close. Flag forward-filled dates in `meta.json` so UI can show "(market closed)" subtly on those dates.
- **Source outage:** if a fetch fails, use previous day's value and log to a `public/health.json`. Do not fail the whole build.
- **Historical gaps:** stooq occasionally has holes. Bootstrap script should linearly interpolate gaps ≤ 3 days, flag longer gaps for manual review.

### Source details

- **stooq** — CSV endpoints, no API key required, e.g. `https://stooq.com/q/d/l/?s=xauusd&d1=20130101&d2=20260419&i=d`. Most generous free source. Primary source for all metals, agri, **and BTC** (ticker `btcusd`). Using stooq for BTC keeps the bootstrap simple — same parser, same forward-fill logic, same failure mode for all series.
- **FRED** — requires free API key, better for Brent and Henry Hub. Rate limits generous.
- **BTC circulating supply** — computed deterministically from block height using the known halving schedule (50 BTC per block pre-block-210,000, then 25 BTC, then 12.5 BTC, halving every 210,000 blocks). No API needed. Write as a pure function with unit tests against known halving block dates. This approach has zero external dependencies and is perfectly accurate by definition.
- **CoinGecko** — optional secondary source, e.g. for cross-validating BTC prices during bootstrap or for the `/companies/public_treasury/bitcoin` endpoint (entity holdings, see Presets section). Free Demo tier with API key is sufficient for daily use. Not required for the core price pipeline.
- **UxC / TradeTech** (uranium) — no free API. Use tradingeconomics.com scrape of broker-average U3O8 spot, or Sprott Physical Uranium Trust (SPUT) NAV as proxy. Weekly cadence; flag as `indicative`.
- **Johnson Matthey / Heraeus** (rhodium, iridium) — published price sheets, monthly. Flag as `indicative`.
- **Industry reference prices** — for illustrative commodities (enriched uranium, tritium, californium, antimatter) use last reputable published figure with explicit date annotation. Flag as `illustrative`.

---

## Asset production pipeline

The look of this site is its moat. Invest accordingly in the assets.

### Tools

- **Blender 4.x** — free, full PBR, handles everything from modelling through rendering
- **Poly Haven** — CC0 HDRIs and PBR textures. Primary environments: `studio_small_09` (warm product shot), `brown_photostudio_02` (neutral metal-friendly), `industrial_workshop_foundry` (for oil/copper/uranium grit)
- **Substance Painter** (optional, ~£15/mo) — for agri textures where PBR materials need hand-painted detail
- **Figma** — scene composition reference, brief prep if outsourcing

### Rendering specs

- **Format:** WebP with PNG fallback. Transparent background. No baked shadow (renderer adds contact shadow in CSS)
- **Resolution:** 1600 × 1600 px @ 2× density (effective 800 px display). Sprites below 400 px display (coins, grains) rendered at 800 × 800 @ 2×
- **Camera:** fixed three-quarter angle (roughly 25° elevation, 30° azimuth from object front). Consistent across all commodities so the composed page reads as one scene
- **Lighting:** HDRI environment lighting + single key light for product-shot specular. Consistent colour temperature ~5500 K across all assets
- **Materials:** PBR with metalness/roughness workflow. Reference values per material committed to `assets/materials-reference.md` for consistency across future additions
- **Contact shadow:** rendered separately as a greyscale PNG shadow, applied via CSS `filter: drop-shadow(...)` so it can tint to match page theme

### Asset naming convention

```
/public/sprites/{commodity_id}/{stage_id}@{density}.webp
/public/sprites/{commodity_id}/{stage_id}-shadow@{density}.webp

Examples:
/public/sprites/gold/kilo_bar@2x.webp
/public/sprites/silver/monster_box@2x.webp
/public/sprites/oil_brent/drum@1x.webp
```

### Progression-stage count per commodity

Budget 4–6 stages per MVP commodity. Total MVP asset count:

- 8 commodities × ~5 stages = ~40 commodity sprites
- Shared reference sprites: 2 (£1 coin, human silhouette) — rendered once, reused across all commodities
- With shadow masks for commodities: ~80 files total
- File size budget: 50 KB per WebP average, total asset payload ~4 MB lazy-loaded
- Comparison cards are text-only, authored in JSON — no sprite production needed

Deliberately not rendered: mid-range reference objects (bricks, cars, buses, whales). The scale system uses coin → human → text card. This keeps the asset inventory lean and avoids the cognitive overhead of per-commodity reference swaps. If a mid-range visual reference becomes essential post-launch, add it as a shared asset, not per commodity.

### Production routes

**Option A — Claude Code driving Blender via MCP (the interesting new option):** Anthropic and community-built MCP servers now expose Blender's Python API to Claude Code. A competent setup lets Claude Code open scenes, set up lighting, import reference geometry, configure PBR materials, adjust the camera, and trigger renders — all from natural-language instructions. This means asset production moves from "outside your skillset" to "an extension of the same session that builds the code". Realistic for this project: you brief Claude Code with the style guide and material reference table (both in this spec), it produces the gold sprite set first as the style anchor, you review the rendered output, approve or iterate, then it proceeds through the remaining commodities. Expect one weekend of active human oversight; Claude Code does the heavy lifting. See *Claude Code + Blender MCP* section below for setup and risks.

**Option B — solo in Blender by hand:** 2 weekends for a competent amateur. Start with gold (simplest, single material family) to establish the look, then replicate conventions across the rest. This is the fallback if the MCP route hits friction.

**Option C — outsource to a 3D generalist:** brief via Upwork or ArtStation. Budget £2–5k for all 8 commodities × 5 stages, delivered to spec over 2–3 weeks. Tight brief required: style guide, reference images, exact progression stages, camera/lighting specs locked before work begins. Fallback if Option A stalls and you lack Blender skills.

**Option D — hybrid:** Claude Code for the conventional metals and agri, outsource the trickier ones (oil/gas scenes, curio-cabinet exotica with radiation warning branding).

**Recommended path:** attempt Option A first. It's the most interesting and potentially the cheapest. If the output doesn't reach the quality bar after ~4 hours of iteration, fall back to Option C for the specific commodities that didn't work. Budget for mixed outcomes.

### Claude Code + Blender MCP

**Setup prerequisites:**
- Blender 4.x installed locally
- An MCP server exposing Blender's Python API. Several community implementations exist; `blender-mcp` by Siddharth Ahuja is the most widely referenced as of spec writing. Verify it's maintained and compatible before committing.
- Claude Code configured with the MCP server in its `mcp` config
- Poly Haven HDRIs downloaded locally, paths known to Claude Code
- The style guide and material reference table from this spec loaded into the session

**What Claude Code can reliably do through the MCP:**
- Open, modify, and save `.blend` files
- Set up scenes: camera position, focal length, HDRI environment
- Create primitive geometry and apply PBR materials with specified values
- Import mesh files (GLB, OBJ) from local paths
- Configure Cycles render settings (samples, resolution, denoising)
- Trigger renders and retrieve outputs
- Iterate based on your feedback on rendered stills

**What will need human judgement or manual intervention:**
- Complex modelling (detailed coin profiles, fuel pellet ridges, jute sack weave) — either import existing models or accept simpler geometry
- Subjective "does this look right?" calls — you review each render and direct changes
- Troubleshooting Blender crashes or MCP disconnections
- Final pixel-level polish in an image editor if needed

**Quality bar to hit before accepting a render:**
- Material reads as the correct substance at first glance
- Lighting is consistent with the established style across sprites
- Contact shadow exists and lands naturally
- No visible artefacts (fireflies, noise, clipping)
- Sprite occupies the correct proportion of the frame
- Transparent background is clean at alpha edges

**Risk management:**
- Version-control the `.blend` files alongside the code. This keeps assets reproducible.
- Commit one sprite's source `.blend` before attempting any other. The first one is the style template; protect it.
- If an MCP session goes off the rails, revert rather than debug. The feedback loop of render-review-revert is faster than trying to correct in place.
- Budget a hard deadline: if after a weekend of MCP-driven work the visual quality isn't at or near portfolio standard, stop and outsource the remainder. Don't throw good time after bad.
- Outsourced models (from BlenderKit, Sketchfab CC0, etc.) are legitimate starting points. Claude Code can adapt them rather than modelling from scratch.

### Material reference values (PBR)

| Material | Base colour | Metalness | Roughness | Notes |
|---|---|---|---|---|
| Gold (24k) | `#FFD700` (F0 ~1.0, 0.77, 0.34 in linear) | 1.0 | 0.12 | Warm reflection, clear IOR |
| Silver | `#F0F0F0` (F0 ~0.97, 0.97, 0.97) | 1.0 | 0.08 | Mirror-like on polished surfaces |
| Platinum | `#E5E4E2` cool | 1.0 | 0.15 | Slightly less reflective than silver |
| Copper | `#B87333` | 1.0 | 0.22 | Patina version for used bricks: `#A67456` with roughness 0.45 |
| Steel (drums, tankers) | `#4A5568` | 0.9 | 0.35 | With rust/paint layers per asset |
| UO2 pellet | `#1A1A1A` dark ceramic | 0.0 | 0.4 | Matte, slight subsurface warmth |
| Yellowcake (U3O8) | `#E8D54F` | 0.0 | 0.9 | Powder, in steel drum |

### Optional Three.js hero scenes (Phase 4)

Two scenes max. Budget one weekend total. Use react-three-fiber or Threlte (Svelte-native) to embed a `<Canvas>` that:

- **Gold hero** — kilo bar rotating imperceptibly slowly (one full revolution per minute), HDRI environment, real-time subtle specular shifts
- **Oil hero** — static drum cluster with looping liquid surface shader visible through a cutaway, or just gentle camera parallax on scroll

Keep geometry low-poly (under 10k tris each), use baked ambient occlusion, and lazy-load the canvas only when the commodity section enters the viewport. Disable on `prefers-reduced-motion`.

---

## Expanded commodity tiers

Past MVP, commodity additions fall into two tiers based on data quality and intent.

### Tier 2 — Conventional expansions

These have adequate data and sensible physical representations. Add incrementally post-launch.

| ID | Display name | Data source | dataQuality | Physical rep |
|---|---|---|---|---|
| `palladium` | Palladium | stooq `xpdusd` | live | Small cube / coin |
| `lumber` | Softwood lumber | FRED `WPU081` or stooq | live | Stacked 2×4 boards |
| `corn` | Corn | stooq `zc.f` | live | Sacks, grain silo |
| `soybeans` | Soybeans | stooq `zs.f` | live | Sacks |
| `sugar` | Sugar #11 | stooq `sb.f` | live | 50 kg jute sacks |
| `cocoa` | Cocoa | stooq `cc.f` | live | Jute sacks, pods |
| `aluminium` | Aluminium | LME via stooq `al.lme` | live | Ingots, rolled coil |
| `nickel` | Nickel | LME via stooq | live | Nickel pellet briquettes |
| `iron_ore` | Iron ore (62% Fe) | stooq `iron.f` | live | Red pellets / hopper |
| `eua` | EU carbon allowance | ICE EUA via stooq | live | Abstract — translucent token, tonnes-CO2 label |

### Tier 3 — The curio cabinet

These are the screenshot-bait exotica. Data quality varies; clearly labelled per the framework above. Visual impact justifies their inclusion even where prices are indicative or illustrative.

| ID | Display name | Unit | Typical price | dataQuality | Physical rep |
|---|---|---|---|---|---|
| `uranium_u3o8` | Uranium yellowcake (U3O8) | lb | ~$85/lb | indicative | Yellow powder in 55-gal steel drum with radiation trefoil |
| `rhodium` | Rhodium | troy oz | $4–6k/oz | indicative | Single tiny metallic flake on card |
| `osmium` | Osmium (crystalline) | gram | ~$400/g | indicative | Blue-black crystal cluster (genuinely beautiful) |
| `saffron` | Saffron threads | gram | ~$5–10/g | live-ish | Delicate red threads on neutral background |
| `tritium` | Tritium | gram | ~$30,000/g | illustrative | Glowing glass vial (self-lit, phosphor-excited) |
| `californium_252` | Californium-252 | gram | ~$27M/g | illustrative | Lead-shielded capsule with warning trefoil; at 1 BTC you buy a speck |

**Removed from consideration entirely:** diamonds (non-fungible, no public spot price), wheat/corn/soybeans/sugar/cocoa (visually redundant as "sacks of brown stuff"), vanilla (hand-wavy pricing, visually weaker than saffron), helium-3 (redundant narrative slot with tritium), antimatter (the caveat dominates the fact — a site built on honest data shouldn't lead with "illustrative price of something that doesn't exist as a market"), palladium (visually too similar to platinum for MVP but fair game for Tier 2).

### On enriched uranium specifically

Highly-enriched uranium (HEU) is not a tradable commodity — it's a regulated nuclear material subject to IAEA safeguards and national export controls. Low-enriched uranium (LEU, ≤5% U-235) powers civilian reactors and is "priced" as a composite of three separately-traded components: U3O8 yellowcake + UF6 conversion + SWU (separative work units).

For this site, we take two honest angles:

1. **U3O8 yellowcake** as a Tier 3 `indicative` commodity — it genuinely trades on a thin spot market. Visual is compelling (yellow powder, steel drum, radiation trefoil).

2. **Nuclear fuel pellet as MVP core commodity (illustrative)** — promoted from Tier 3 to the main tour. A single UO2 fuel pellet (~7 g, ~$20 as a composite fabrication cost: uranium feed + conversion + SWU + fabrication at roughly $3,000/kgU of finished fuel) delivers the energy equivalent of ~1 tonne of coal, ~149 gallons of oil, or ~1 MWh of electricity over its reactor life. This is the philosophical payoff of the whole site. At current BTC prices that's ~4,500 pellets per bitcoin — a shoebox of matte-black ceramic thumbnails carrying the energy of roughly 1,650 UK homes for a year. Clearly flagged `illustrative` in the UI, with the composite pricing explained on the methodology page. The fact-engine caption writes itself: *"At today's prices, 1 BTC buys enough uranium fuel to power [X] UK homes for a year."*

Do not claim the fuel pellet price is a live market price. The honesty is part of the credibility story — and the illustrative framing is what makes the "1,650 homes" claim land rather than feel like hype.

### Curio-cabinet UX treatment

Tier 3 commodities should be gated behind a "Show curio cabinet" toggle, not rendered inline with MVP commodities. Reasons:

- Keeps the main page focused and fast
- Signals that exotica is editorial/illustrative, not a commodity trading tool
- Creates a second page depth layer for SEO and dwell time
- Makes it easy to add more without cluttering the core experience

Implementation: a section break after the 8 MVP commodities with a "Want the weird stuff?" CTA that expands/reveals Tier 3. Alternatively, a dedicated `/curios` route. Decide at Phase 2.

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

On load: parse params, hydrate Svelte stores. If `preset` is set, its values take precedence over explicit `btc`/`date`. On any state change: `history.replaceState` to update URL without page reload. Debounce slider changes to 100 ms to avoid URL spam. Clearing the slider manually clears the preset param too (presets are "sticky" only until the user moves the slider).

The `btc` range goes to 21 million because the "total supply" preset needs to resolve cleanly.

---

## Presets

Presets turn specific BTC amounts into named narrative frames. Each one is a shareable URL that loads a specific quantity (and optionally a specific date) to tell a small story. They double as a curation tool — a careful preset list is a better landing experience than a bare slider.

Presets appear as a horizontally-scrollable pill bar above the main BTC slider. Four categories, colour-coded subtly:

- **Denominations** — technical units. 1 sat, 1 bit, 1 Nakamoto, 1 BTC, 21 BTC.
- **History** — moments pinned to specific dates. Pizza Day, Mt Gox peak, halvings, ETF approval.
- **Entities** — real-world holders at a point in time. Strategy, BlackRock IBIT, El Salvador, US government, Satoshi's estimated stash.
- **Absurdity** — the "lol" tier. Total supply (21M BTC), total market cap.

### Schema

```typescript
interface Preset {
  id: string;                    // URL-safe, e.g. "pizza_day"
  label: string;                 // "🍕 Pizza Day"
  description: string;           // tooltip / expanded explainer
  category: "denomination" | "history" | "entity" | "absurdity";
  btc: number | "dynamic";       // static amount, or flag for computed
  dynamicFn?: string;            // id of resolver function (see below)
  date?: string;                 // ISO; if set, locks scrubber to this date
  dateRule?: "freeze" | "suggest";// freeze = scrubber disabled; suggest = user can move
  source?: string;               // citation + as-of date (for entity category)
  pinned?: boolean;              // show in main bar vs. "more presets" drawer
  factOverride?: string;         // optional bespoke fact card text
}
```

### Initial preset list

```json
[
  {
    "id": "one_sat", "label": "1 sat", "category": "denomination",
    "description": "The smallest unit. Shows how absurdly divisible BTC is.",
    "btc": 0.00000001, "pinned": false
  },
  {
    "id": "one_bit", "label": "1 bit", "category": "denomination",
    "description": "1,000 sats. Loose change.",
    "btc": 0.00001, "pinned": false
  },
  {
    "id": "one_nakamoto", "label": "1 Nakamoto", "category": "denomination",
    "description": "1 million sats (0.01 BTC). The daily-reckoning unit for serious stackers.",
    "btc": 0.01, "pinned": true
  },
  {
    "id": "one_btc", "label": "1 BTC", "category": "denomination",
    "description": "The canonical frame.",
    "btc": 1, "pinned": true
  },
  {
    "id": "twenty_one", "label": "21 BTC", "category": "denomination",
    "description": "A nod to the hard cap.",
    "btc": 21, "pinned": false
  },

  {
    "id": "pizza_day", "label": "🍕 Pizza Day", "category": "history",
    "description": "Laszlo Hanyecz's 10,000 BTC for two Papa John's pizzas. What would two pizzas have bought across history?",
    "btc": 10000, "date": "2010-05-22", "dateRule": "suggest", "pinned": true
  },
  {
    "id": "genesis", "label": "Satoshi's first block", "category": "history",
    "description": "The genesis block reward, mined 3 January 2009.",
    "btc": 50, "date": "2009-01-03", "dateRule": "suggest", "pinned": false
  },
  {
    "id": "first_halving_reward", "label": "Post-halving block", "category": "history",
    "description": "A single block reward after the first halving (25 BTC).",
    "btc": 25, "date": "2012-11-28", "dateRule": "suggest", "pinned": false
  },

  {
    "id": "strategy", "label": "Strategy's stack", "category": "entity",
    "description": "What Michael Saylor's company owns.",
    "btc": "dynamic", "dynamicFn": "entity_strategy",
    "source": "CoinGecko public treasuries API, updated daily",
    "pinned": true
  },
  {
    "id": "blackrock_ibit", "label": "BlackRock IBIT", "category": "entity",
    "description": "The largest spot Bitcoin ETF.",
    "btc": "dynamic", "dynamicFn": "entity_ibit",
    "source": "CoinGecko / issuer disclosures",
    "pinned": true
  },
  {
    "id": "el_salvador", "label": "🇸🇻 El Salvador", "category": "entity",
    "description": "State holdings of the first nation to make BTC legal tender.",
    "btc": "dynamic", "dynamicFn": "entity_el_salvador",
    "source": "Official presidential treasury tracker",
    "pinned": false
  },
  {
    "id": "us_govt", "label": "🇺🇸 US Government", "category": "entity",
    "description": "Seized BTC held by the US government. Includes Silk Road, Bitfinex recovery, etc.",
    "btc": "dynamic", "dynamicFn": "entity_us_govt",
    "source": "Arkham, bitcointreasuries.net",
    "pinned": false
  },
  {
    "id": "satoshi_stash", "label": "👻 Satoshi's stash", "category": "entity",
    "description": "Estimated Bitcoin held in wallets attributed to Satoshi Nakamoto. Untouched since 2010.",
    "btc": 1100000,
    "source": "Patoshi pattern analysis, Sergio Demian Lerner",
    "pinned": true
  },

  {
    "id": "total_supply", "label": "21M BTC — total supply", "category": "absurdity",
    "description": "Every bitcoin that will ever exist. The ceiling.",
    "btc": 21000000,
    "pinned": false
  },
  {
    "id": "market_cap", "label": "🌍 Entire BTC market cap", "category": "absurdity",
    "description": "The value of all bitcoins currently in circulation. Compare against the world's gold, oil, or any other commodity.",
    "btc": "dynamic", "dynamicFn": "market_cap",
    "factOverride": "BTC's market cap could buy about 5.5% of every gram of gold humanity has ever mined — more than the US, Germany, and Italy's central bank holdings combined.",
    "pinned": true
  }
]
```

### Dynamic preset resolvers

Static BTC amounts cover most presets. A few need computed values because the underlying quantity changes over time:

- **`market_cap`** — `btc = circulatingSupply(date) × 1` (i.e. enough BTC to own every coin). Requires circulating-supply series in the main dataset. See below.
- **`entity_*`** — read from a separate `entities.json` dataset, keyed by entity id and date. Current-day presets use today's holding; if the user moves the scrubber, use the holdings as of that date. Entities without historical data freeze at their last-known value with a subtle "as of [date]" tag.

The resolver receives the current `date` from the scrubber and returns a `btc` value. Pure functions, no async work in the render path.

### Automated entity holdings pipeline

Add to the existing GitHub Actions workflow. Daily run:

1. **CoinGecko** — `GET /companies/public_treasury/bitcoin` returns the public companies list with current holdings (Strategy, Tesla, Marathon, etc.). Free tier, generous rate limits.
2. **bitcointreasuries.net** — scrape for entities not in CoinGecko's list (nation-states, ETFs, private companies). Defensive scraping: fail gracefully if DOM changes, use previous day's values and log to `health.json`.
3. **Arkham Intelligence** (optional, requires login) — for US government seizure wallets, tracks on-chain movements. If this becomes critical, revisit automation; for MVP, manual weekly update is acceptable.
4. **Issuer 10-K/10-Q filings** — quarterly corporate disclosures (Strategy, CleanSpark, etc.). Not automatable cheaply; the CoinGecko endpoint covers most of this.

Output: `public/entities.json`:

```json
{
  "lastUpdated": "2026-04-18",
  "entities": {
    "strategy": {
      "displayName": "Strategy",
      "currentBtc": 636505,
      "history": [
        { "date": "2020-08-11", "btc": 21454 },
        { "date": "2020-12-21", "btc": 70470 },
        { "date": "2021-09-13", "btc": 114042 },
        ...
        { "date": "2026-04-15", "btc": 636505 }
      ],
      "sources": ["coingecko", "strategy_8k_filings"],
      "lastVerified": "2026-04-18"
    },
    "el_salvador": {
      "displayName": "El Salvador",
      "currentBtc": 6206,
      "history": [
        { "date": "2021-09-06", "btc": 400 },
        ...
      ],
      "sources": ["nayib_tracker", "manual_audit"],
      "lastVerified": "2026-04-18"
    }
  }
}
```

**Historical accuracy:** when the scrubber is on a past date, resolve the entity's holding as of that date, not today's. This is the interesting and honest bit. It means "Strategy's stack in 2022" shows what they actually held in 2022, not their 2026 pile. Educational, and it protects the site from looking like it's misleading by anachronism.

**Bootstrap cost:** non-trivial. For MVP, seed the history arrays manually with major purchase dates for the top 5 entities, then auto-refresh the current value daily. Expand history manually over time. Don't block launch on complete historical entity data — the `currentBtc` field is enough for the preset to function.

### Circulating supply dataset

Needed for the `market_cap` preset. Add to the main `prices.json` build:

- Pull daily circulating supply from CoinGecko's `/coins/bitcoin/history` endpoint or compute from block-height arithmetic (deterministic from block number; 50 BTC per block pre-first-halving, halving every 210,000 blocks)
- Store as `btc_supply` field in each daily record
- Backfill the full history during bootstrap; it's a clean function of block height

The `market_cap` resolver becomes a one-liner: return today's (or scrubbed-date's) supply from the loaded prices.json.

### Preset interaction rules

- **Tapping a preset:** sets `btc` (and `date` if preset includes one), updates URL, smooth-scrolls to top of commodity sections.
- **Dragging the slider after a preset is active:** preset becomes "suggestion" — URL updates to remove `preset` param, `btc` and `date` become primary state.
- **Moving the scrubber after a preset is active:** same behaviour — `preset` param drops out of URL.
- **Preset with `dateRule: "freeze"`:** scrubber is disabled while that preset is active. Currently none in MVP, but schema supports it for future use.
- **Share from preset state:** share button generates `/?preset=market_cap` — short, memorable URLs.
- **OG image for preset URLs:** pre-rendered at build time for pinned presets, on-demand for the rest. "🍕 Pizza Day · What 10,000 BTC bought in 2010" reads much better in Twitter cards than a generic share image.

### Editorial surface

Presets are the natural hook for the newsletter. "This week: what a Nakamoto bought in 2019 vs today." "Monthly: Strategy's stack just crossed X — here's what that buys in gold." Each post embeds a preset screenshot and a live URL. Tight content-to-tool loop that builds the list.

Consider a Phase 6 addition: author-created "custom presets" that are really just shareable URLs with campaign tags, used for social posts.

---

## Scrubber component

**Position:** fixed to bottom of viewport, full page width, ~80 px tall.

**Layout:**
```
[◀◀] [▶] [1× ▼]   |————•————————|   2013-01-01          2026-04-18
                  earliest    playhead                   today
```

**Behaviours:**
- Drag playhead: update `date` state, full page re-renders
- Play button: advances playhead at chosen speed
- Speed selector: 1× (1 day/100ms), 10× (1 day/10ms), 100× (full history in ~45s)
- Anchor events render as small dots on the timeline
- Hovering/tapping a dot shows event name tooltip
- During playback, crossing an event date triggers a centre-screen caption card, fades in over 300ms, persists 3s, fades out over 500ms
- Keyboard: `←`/`→` step ±1 day, `Shift+←`/`Shift+→` step ±1 month, `Space` toggle play/pause, `Home`/`End` jump to start/end
- Mobile: touch-drag the playhead; long-press dots for event tooltip

**Accessibility:** ARIA slider role, keyboard controls announced, `prefers-reduced-motion` disables auto-play and crossfades.

---

## Anchor events (MVP set)

Stored in `src/lib/events.json`. All captions kept under 120 characters so they fit one line on mobile.

```json
[
  { "date": "2010-05-22", "name": "Pizza Day", "caption": "Laszlo Hanyecz pays 10,000 BTC for two Papa John's pizzas." },
  { "date": "2012-11-28", "name": "First halving", "caption": "Block reward drops from 50 to 25 BTC." },
  { "date": "2013-11-29", "name": "Mt Gox peak", "caption": "BTC hits $1,242 on Mt Gox before the long collapse." },
  { "date": "2014-02-07", "name": "Mt Gox goes dark", "caption": "The exchange handling 70% of BTC trades suspends withdrawals." },
  { "date": "2016-07-09", "name": "Second halving", "caption": "Reward drops to 12.5 BTC per block." },
  { "date": "2017-12-17", "name": "First $20k", "caption": "BTC touches $19,783 on Coinbase. Retail mania peaks." },
  { "date": "2020-03-12", "name": "COVID crash", "caption": "BTC loses 50% in a day as global markets panic." },
  { "date": "2020-05-11", "name": "Third halving", "caption": "Reward drops to 6.25 BTC." },
  { "date": "2021-09-07", "name": "El Salvador adopts BTC", "caption": "First nation-state to grant bitcoin legal tender status." },
  { "date": "2022-11-11", "name": "FTX collapse", "caption": "Second-largest exchange files for Chapter 11 bankruptcy." },
  { "date": "2024-01-11", "name": "US spot ETFs launch", "caption": "BlackRock, Fidelity and nine others receive SEC approval." },
  { "date": "2024-04-20", "name": "Fourth halving", "caption": "Reward drops to 3.125 BTC." }
]
```

Note: events before 2013-01-01 (Pizza Day, early history) should still appear in the timeline if the scrubber supports pre-2013 dates — consider extending the range if BTC price data is usable from 2011 onwards (it's noisy but available from Mt Gox).

---

## Facts engine (phase 1, light)

Each commodity has 2-4 fact templates that substitute computed values. Rendered below the physical rep. Keeps the page shareable and educational.

Example templates:

```json
{
  "copper": [
    { "template": "enough to wire approximately {n} average UK homes", "divisor_kg": 200 },
    { "template": "equivalent to {n} Tesla Model 3 battery packs' worth of copper", "divisor_kg": 80 }
  ],
  "gold": [
    { "template": "about {n} standard wedding rings (~4 g each)", "divisor_kg": 0.004 },
    { "template": "{n} Good Delivery bars (400 oz each)", "divisor_kg": 12.4 }
  ],
  "oil_brent": [
    { "template": "roughly {n} full tanks for a mid-size car (~50 L)", "divisor_litres": 50 },
    { "template": "fuel for {n} transatlantic flights (~150,000 L each)", "divisor_litres": 150000 }
  ]
}
```

---

## Monetisation hooks (phase 1, placeholders only)

Each commodity section has an unobtrusive CTA slot with `data-affiliate="gold"` etc. MVP renders placeholder divs — fill in post-launch once partners are signed.

**Target partners (UK/EU-first):**

- Precious metals: BullionVault, The Royal Mint, Hatton Garden Metals, BullionByPost
- Bitcoin: Firefish (BTC-collateralised lending), Relai (stacking), Swan (US)
- Energy/commodities: limited retail options; likely skip

**Placement rules:**
- One CTA per commodity section, below the physical rep, above the fact strip
- Footer has full list with required FTC/ASA disclosure
- No interstitials, no pop-ups, no ad network scripts at launch
- Revisit Mediavine Journey or Ezoic at 5k+ monthly sessions

---

## Tech stack (opinionated)

- **Framework:** SvelteKit with `@sveltejs/adapter-static`. The site is fully prerendered — no server-side logic, no Workers, no dynamic routes. Static output deploys as flat files to Cloudflare Pages. (Do NOT use `@sveltejs/adapter-cloudflare`; that adapter is for Workers-backed sites, which we aren't building.) Cloudflare Pages build output directory should be set to `build/` (adapter-static's default), not `.svelte-kit/cloudflare`.
- **Visualisation:** SVG-first, rendered as Svelte components. Add Three.js only if the gold/copper hero scenes demand it — deferrable past MVP.
- **Styling:** Tailwind CSS. Dark theme default (the physical objects look better against dark bg), light toggle optional phase 2.
- **State:** URL is the source of truth. Svelte stores mirror URL state, update via `history.replaceState`.
- **Hosting:** Cloudflare Pages. Free tier sufficient. Bonus: Cloudflare Workers for dynamic OG image generation.
- **Data refresh:** GitHub Actions, daily 02:00 UTC cron.
- **Analytics:** Plausible (hosted, £9/month) or Umami (self-host on a cheap VPS).
- **Domain:** check availability on first commit. Suggestions: `satsinstuff.com`, `shoebox.index`, `oneisatoshi.com`.

---

## File structure

```
btc-commodity-visualiser/
├── .github/
│   └── workflows/
│       └── daily-update.yml
├── data/
│   └── prices.ndjson              # append-only daily history
├── public/
│   ├── prices.json                # built from ndjson, served to client
│   ├── meta.json                  # last-updated, source provenance
│   └── health.json                # fetch success/failure log
├── scripts/
│   ├── bootstrap.ts               # one-time historical fetch
│   ├── fetch-daily.ts             # daily cron entry point
│   └── build-prices-json.ts       # ndjson → pivoted json
├── assets/
│   ├── blender/                   # source .blend files, not shipped
│   │   ├── gold-scene.blend
│   │   ├── silver-scene.blend
│   │   └── ...
│   ├── materials-reference.md     # canonical PBR values per material
│   └── style-guide.md             # camera, lighting, composition rules
├── src/
│   ├── lib/
│   │   ├── commodities.ts         # catalogue definitions
│   │   ├── events.json            # anchor events
│   │   ├── stores/
│   │   │   ├── url.ts             # URL ↔ state sync
│   │   │   ├── prices.ts          # loaded prices.json
│   │   │   └── playback.ts        # scrubber play/pause/speed
│   │   └── components/
│   │       ├── PhysicalRep.svelte       # sprite stage picker + scaler
│   │       ├── SpriteStage.svelte       # single stage with crossfade
│   │       ├── HumanSilhouette.svelte   # SVG, fixed 1.75 m
│   │       ├── Scrubber.svelte
│   │       ├── CommoditySection.svelte
│   │       ├── AnchorCaption.svelte
│   │       ├── QualityBadge.svelte      # live/indicative/illustrative
│   │       └── hero/
│   │           ├── GoldHero.svelte      # optional Three.js scene
│   │           └── OilHero.svelte       # optional Three.js scene
│   ├── routes/
│   │   ├── +page.svelte           # the whole app
│   │   ├── +layout.svelte
│   │   ├── about/+page.svelte
│   │   ├── methodology/+page.svelte
│   │   ├── data/+page.svelte      # dataset download + citation
│   │   └── curios/+page.svelte    # Tier 3 exotica (post-MVP)
│   └── app.html
├── static/
│   └── sprites/
│       ├── gold/
│       │   ├── grain@2x.webp
│       │   ├── coin@2x.webp
│       │   ├── kilo_bar@2x.webp
│       │   └── ...
│       ├── silver/
│       └── ... (one dir per commodity)
├── tests/
│   └── ... (vitest + playwright visual regression)
├── svelte.config.js
├── tailwind.config.js
├── vite.config.ts
└── package.json
```

---

## Build phases

### Phase 0 — Data pipeline (2–3 hours)
- Write bootstrap fetcher for each of the 8 MVP sources
- Pull full history 2013-01-01 → yesterday
- Handle gaps, forward-fill, validate
- Produce first `prices.json` committed to repo
- Verify file size under 5 MB gzipped

### Phase 1 — Skeleton (one weekend)
- SvelteKit scaffold, Tailwind, Cloudflare Pages deploy
- URL state store wired end-to-end
- 8 commodity sections with placeholder grey boxes at correct aspect ratios
- BTC amount slider functional, computed masses/volumes update live
- Date picker input (no scrubber yet) to test historical data
- Ship to staging subdomain
- Deliberately NO sprites yet — this phase proves the data/state loop works

### Phase 2a — Asset production (parallel to Phase 1, 1–2 weekends or outsourced)
- Lock style guide: camera angle, HDRI, colour temperature, material values
- Produce gold sprite set first to establish visual grammar
- Produce remaining 7 MVP commodities to match
- Export all sprites as WebP @ 2×, with separate shadow masks
- Ship to `/static/sprites/{commodity}/`
- Cross-check file size budget: total sprite payload under 4 MB

### Phase 2b — Renderer integration (one weekend, after 2a)
- `<PhysicalRep>` and `<SpriteStage>` components with cube-root scaling
- Cross-fade transitions between stages
- Human silhouette component, consistent 1.75 m scale across all commodities
- Readout strips with mass/volume formatting (g → kg → tonnes, ml → L → m³)
- Facts engine with substitutable templates
- Unit toggle (metric/imperial)
- `dataQuality` badges for non-live commodities

### Phase 3 — Scrubber & events (one weekend)
- Timeline component with drag + keyboard
- Play/pause/speed controls (1×, 10×, 100×)
- Anchor event dots + caption cards
- Mobile touch handling (consider dual-range: coarse year + fine date)
- `prefers-reduced-motion` respected

### Phase 4 — Polish & ship (a few evenings)
- OG image generation via Cloudflare Workers (pre-render `og-image?btc=1&date=...`)
- Methodology page (data sources, computation notes, data quality framework)
- About page with Packaging the Fnords cross-link
- Dataset page (`/data`) with CC-BY download + citation block
- Email capture (Plausible/Umami + Buttondown or similar newsletter tool)
- Launch: submit to Hacker News, post to crypto Twitter, r/bitcoin, r/dataisbeautiful

### Phase 5 — Hero scenes + polish (optional, 1 weekend)
- Three.js / Threlte scene for gold (slow rotation or specular drift)
- Optional second hero scene (oil drum scene with parallax)
- Lazy-loaded via IntersectionObserver, disabled under `prefers-reduced-motion`
- Mobile Lighthouse check — must not drop below 85

### Phase 6 — Curio cabinet + affiliates (ongoing)
- Tier 3 exotica commodities with illustrative data quality framework
- `/curios` route or inline "reveal weird stuff" toggle
- Affiliate placements filled in per commodity
- GIF export of animated history (Cloudflare Workers + Satori/resvg)
- `/api/prices.json` soft-launch as free dataset with suggested citation

---

## Testing strategy

- **Unit:** price loading, date math, URL state roundtrip, unit conversion
- **Component:** each physical rep renders at extreme amounts without crashing
- **Visual regression:** Playwright screenshot comparison on three canonical states (0.01 BTC today, 1 BTC today, 10 BTC today) across three historical dates
- **Performance:** Lighthouse ≥ 90 on mobile. TTI under 3s on a mid-range Android

---

## Defensibility / moat notes

The code itself isn't defensible. Anyone can build a visualiser. The things that compound and make this a sellable asset:

1. **The dataset.** A clean, documented, CC-BY-licensed daily BTC-denominated commodity history with source provenance. Other sites and writers will cite it. Those citations compound as backlinks and authority. Publish from day one at `/data` with a suggested citation block.
2. **Visual quality.** Photoreal sprites, consistent lighting and composition across all commodities, and a distinctive curio-cabinet of exotica are genuinely hard to replicate without serious effort. Invest here — it's the differentiator.
3. **Audience.** Email list is the real asset at exit. Capture aggressively at anchor-event moments ("get the weekly Shoebox Report"). Segment by interest (BTC / bullion / macro). At 5-10k subscribers this becomes the thing a buyer actually wants.
4. **Category ownership.** First-mover on "BTC × commodities visualisation" is durable. Grab the canonical domain, social handles, and get the site cited early. Pricedingold.com has ranked for "bitcoin in gold" for over a decade on the same logic.
5. **Editorial voice.** Weekly recap with commentary — what moved, why, what it implies. This is the lifecycle-email skillset ported directly. Screenshots and a 200-word take go a long way on crypto Twitter.

**Candidate acquirers at exit:** crypto media properties (The Block, Bankless, Bitcoin Magazine), BTC-focused fintechs (River, Swan, Unchained), bullion dealers targeting the BTC-curious demographic (BullionVault has acquired content sites), data companies (Messari, Kaiko). Realistic range at 50k monthly sessions + 5k engaged list + clean brand: £50-150k.

**Operational notes:** register a company entity from day one; keep personal and project finances cleanly separated; instrument analytics well (source → session → email conversion); document everything so a due-diligence buyer can understand the operation in a week.

---

## Open questions for Claude Code to resolve

1. **Data sources:** stooq for metals and agri, FRED for oil and gas. Uranium and other Tier 3 commodities use `indicative`/`illustrative` flags with documented sources. Confirm stooq CSV format parses cleanly and rate-limits don't bite during bootstrap.
2. **Three.js vs sprites:** default is sprites. Three.js is Phase 5 only, for one or two hero scenes. Do not build Three.js in MVP.
3. **Currency toggle:** USD only at launch. GBP/EUR requires FX history from ECB or Frankfurter, adds complexity. Defer to Phase 6+.
4. **Pre-2013 BTC:** Pizza Day caption makes no sense without pre-2013 data. Recommend extending scrubber to 2011-01-01 with a warning-flagged thin-data caveat.
5. **Mobile scrubber precision:** with 13+ years of daily data, pixel-per-day on mobile is too narrow to drag accurately. Likely need a dual-range: coarse year slider + fine day-within-year slider. Design decision in Phase 3.
6. **Sprite production route:** solo Blender vs outsource vs hybrid. Decide before Phase 2a. Hybrid (solo gold + outsource rest) is recommended default.
7. **Framework:** SvelteKit static adapter default. If Threlte for hero scenes proves awkward, fall back to React + react-three-fiber for those components only.

---

## Handoff prompt for Claude Code

Paste this into a fresh Claude Code session in an empty `bitcoin-weighin` directory:

````
Build the Bitcoin Weigh-In static site per the attached spec (docs/SPEC.md). Start with Phase 0: data pipeline only. Do not build any UI yet.

Project name: Bitcoin Weigh-In
Domain: bitcoinweighin.com
Repository: github.com/[username]/bitcoin-weighin

Before you start, read docs/SPEC.md in full and summarise your understanding of: (1) the physical representation engine and scale reference system, (2) the presets and dynamic resolvers, (3) the data pipeline and data quality framework. This is so I can catch any misreadings before we write code.

Then, in this first session:

1. Initialise a SvelteKit project with static adapter, Tailwind, Vitest, and TypeScript
2. Create the data pipeline:
   - scripts/bootstrap.ts: fetches full daily history from 2013-01-01 to yesterday from stooq (xauusd, xagusd, xptusd, hg.f, zw.f, kc.f, **btcusd**) and FRED (DCOILBRENTEU, DHHNGSP)
   - scripts/compute-btc-supply.ts: pure function computing BTC circulating supply for any given date from block height and the known halving schedule. No API calls. Include unit tests against known halving dates (block 210,000 on 2012-11-28, block 420,000 on 2016-07-09, block 630,000 on 2020-05-11, block 840,000 on 2024-04-20)
   - scripts/build-prices-json.ts: pivots data/prices.ndjson into public/prices.json (include btc_supply field computed for each date for the market_cap preset)
   - .github/workflows/daily-update.yml: cron at 02:00 UTC running scripts/fetch-daily.ts then scripts/build-prices-json.ts, commits results
3. Run bootstrap once, commit initial prices.json and meta.json
4. Verify file size under 5 MB gzipped; document actual size in README
5. Write unit tests for:
   - Forward-fill logic for weekends/holidays
   - Gap detection in historical data
   - NDJSON → pivoted JSON transformation
   - Circulating supply calculation (assert correctness at each halving block boundary)

Do not touch src/routes, src/lib/components, or build any UI in this session. When data is stable and tested, stop and report back with:
- Your spec comprehension summary
- Actual prices.json size
- Any source outages encountered
- Any commodity where historical data is unexpectedly thin or gappy
- Confirmation the GitHub Action runs cleanly in a dry-run

I'll review, then we start Phase 1.

FRED API key will be provided via environment variable FRED_API_KEY.
````

---

*End of spec. Good hunting.*
