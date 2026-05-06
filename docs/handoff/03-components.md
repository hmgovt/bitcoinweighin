# Stage 3 — Component scaffolding

*Read `00-OVERVIEW.md` first. Stages 1 and 2 must be confirmed complete.*

Build the components needed for the new render modes. **Don't wire them up to specific commodities yet** — that happens in Stages 4, 5, 6. This stage is component construction and unit-test coverage in isolation.

Components to build, all under `src/lib/components/`:

| Component | Used by | Stage where wired up |
|---|---|---|
| `<YAxis />` | gold, silver, Pu-238 | 4, 6 |
| `<QuantityAnchorCard />` | gold, silver | 4 |
| `<CubeGlowOverlay />` | Pu-238 | 6 |
| `<StillPanel />` | cocaine | 5 |
| `<TieredPricingTable />` | cocaine | 5 |
| `<CocaineDenominationRow />` | cocaine | 5 |
| `<Pu238FactCard />` | Pu-238 | 6 |

---

## `<YAxis />` (cube-mode)

Per existing draft (single vertical line left of cube, label at midpoint, adaptive units). If a partial implementation exists from prior session work, complete it.

- Imperial primary, metric via `unit=metric` URL param
- Adaptive unit ladders: `mm` / `cm` / `m` / `km` (metric); `in` / `ft` / `mi` (imperial)
- Switches threshold: 1000 mm → m; 1000 m → km; 12 in → ft; 5280 ft → mi
- Label format: 1 significant figure for very small or very large; 2-3 sig figs in the human-scale range
- Accepts prop `cubeEdgeMetres: number` and renders the line at viewport-correct height

Applies to all three cube-mode commodities (gold, silver, Pu-238).

---

## `<QuantityAnchorCard />` (gold and silver)

Props: `commodityId: string`, `currentMassKg: number`. Reads `quantity-anchors.json`, finds anchors within ±10% of `currentMassKg`, picks highest priority (1 beats 2; ties broken by ascending mass). Renders small italic caption beside the readout strip.

```typescript
function selectAnchor(anchors: QuantityAnchor[], currentMassKg: number): QuantityAnchor | null {
  const matches = anchors.filter(a => 
    Math.abs(a.quantityKg - currentMassKg) / a.quantityKg <= 0.10
  );
  if (matches.length === 0) return null;
  return matches.sort((a, b) => 
    a.priority - b.priority || a.quantityKg - b.quantityKg
  )[0];
}
```

Style: low-key, brand-voice consistent — *not* a hero card. Italics, small type, beside the readout. Pu-238 doesn't use this — it has its own fact card (see below).

Unit tests: assert correct selection at boundary masses (e.g. exact match, ±9% match, ±11% miss, two equal-priority matches resolved by mass).

---

## `<CubeGlowOverlay />` (Pu-238 cube only)

Triggered by `commodity.glowScales === true` inside the existing cube renderer. The cube renders normally (metallic surface at the appropriate CSS-mm size), and a glow effect is composited around and through it.

**Important:** glow is built from **two independently-scaling channels** — intensity (brightness, opacity, bloom) and colour temperature (visible-spectrum hue position) — not from threshold bands with bundled colour+opacity pairs. Real incandescence works this way: a small hot pellet can already be cherry-red but dim, while a kilogram is bright at the same colour, and ten kilograms is bright *and* yellow. Intensity climbs faster than colour temperature does.

```typescript
// Hue position 0 → 1 along a blackbody emission ladder
function massToColorTemp(massGrams: number): number {
  if (massGrams < 1) return 0; // invisible IR
  // Each 10× in mass shifts colour up by ~0.18; clamp at 1 (white-hot)
  return Math.min(1, Math.log10(massGrams) * 0.18);
}

// Brightness 0 → 1; scales faster than colour
function massToIntensity(massGrams: number): number {
  if (massGrams < 0.1) return 0;
  return Math.min(1, Math.log10(massGrams * 10) * 0.22);
}

// Canonical incandescent emission stops, ~600 °C → 1500 °C+
const COLOR_STOPS = [
  { t: 0.00, hex: '#1a0000' }, // just-perceptible IR red, ~400 °C
  { t: 0.15, hex: '#5c1a00' }, // dull red, ~600 °C
  { t: 0.30, hex: '#a83000' }, // cherry red, ~800 °C
  { t: 0.50, hex: '#ff5500' }, // orange, ~1000 °C
  { t: 0.70, hex: '#ffaa00' }, // amber-yellow, ~1200 °C
  { t: 0.85, hex: '#ffee99' }, // white-yellow, ~1400 °C
  { t: 1.00, hex: '#ffffff' }, // white-hot, dial-cranked-past-physics
];

function interpolateColor(t: number): string {
  // Linear RGB interpolation between the two adjacent stops
  // (ideally HCL or OKLab for perceptual smoothness; linear RGB is acceptable MVP)
}

interface GlowParams {
  color: string;       // interpolated from COLOR_STOPS at current colorTemp
  opacity: number;     // intensity-driven
  bloomPx: number;     // intensity-driven
  warningCaption: boolean; // mass > 1000 g
}

function computeGlowParams(massGrams: number): GlowParams {
  const colorTemp = massToColorTemp(massGrams);
  const intensity = massToIntensity(massGrams);
  return {
    color: interpolateColor(colorTemp),
    opacity: intensity * 0.9,        // peak 0.9 so it never fully obscures the cube
    bloomPx: intensity * 64,         // peak 64 px bloom radius
    warningCaption: massGrams >= 1000,
  };
}
```

Two layered effects on the panel:

1. **Outer atmospheric glow** — positioned div behind the cube with a radial gradient using the interpolated colour, opacity, and `bloomPx`. Centred on the cube, extent ~2× cube edge. Blend mode `screen` so it reads as light, not paint.
2. **Cube surface emission** — `filter: brightness()` and `box-shadow` on the cube sprite itself, using the same colour and intensity. At higher masses the cube reads as actively emitting, not just lit.

Use CSS custom properties for `--glow-color`, `--glow-opacity`, `--glow-bloom` so transitions are smooth as the slider moves. Both channels animate independently — colour temperature shifts feel different from brightness shifts; interpolating them as one variable produces an unnatural fade.

When `warningCaption` is true (mass ≥ 1 kg, where pure metal would self-melt; firmly past theoretical critical mass above ~10 kg), append " *(would melt itself in reality)*" to the readout strip's mass line.

Unit tests: assert `massToColorTemp` and `massToIntensity` at boundary masses; assert `interpolateColor` produces sensible values at 0, 0.5, 1; assert warning caption fires at exactly 1 kg.

---

## `<StillPanel />` (cocaine)

Replaces the cube + reference layout for still-mode commodities. Props: `commodityId: string`, `imagePath: string`, `currentBtc: number`, `children: Snippet` (the readout strip components are passed as children).

Renders the still image at fixed size (max 800 px wide, aspect ratio preserved) with the readout strip below. No Shiba, no Y-axis, no quantity anchors. The readout strip is where all the dynamic content lives.

If the image at `imagePath` is absent (404), render a labelled grey placeholder of the same dimensions and continue. Don't crash the panel.

---

## `<TieredPricingTable />` (cocaine)

Props: `commodityId: string`, `currentBtc: number`, `priceData: CocainePriceData`. Renders three tier rows: producer, wholesale, retail-pure-equivalent. Each row:

```
Producer    $1,500–$3,500/kg     1 BTC ≈ 30 kg
Wholesale   $25,000–$35,000/kg   1 BTC ≈ 2.5 kg     ← primary
Retail      $80,000–$250,000/kg  1 BTC ≈ 0.6 kg
```

Use each tier's midpoint figure for the BTC equivalence calculation; show the range alongside. The wholesale row is highlighted as primary (subtle border or background).

---

## `<CocaineDenominationRow />` (cocaine)

Props: `currentMassKg: number`. Single-line readout that switches with mass. Logic:

```typescript
function denomination(massKg: number): string {
  const massG = massKg * 1000;
  if (massG < 1)         return `≈ ${Math.round(massG / 0.030)} lines (30 mg each)`;
  if (massG < 1000)      return `≈ ${Math.round(massG)} retail bags (~1 g each)`;
  if (massKg < 1000)     return `≈ ${Math.round(massKg)} 1-kg bricks`;
  if (massKg < 100000) {
    const pallets = Math.round(massKg / 1000);
    return `≈ ${pallets.toLocaleString()} pallets · ≈ ${Math.round(massKg).toLocaleString()} bricks`;
  }
  // Above 100 t — frame against global production (~2,250 t/year per UNODC)
  const yearsOfGlobal = massKg / 2_250_000;
  if (yearsOfGlobal < 1) return `≈ ${Math.round(yearsOfGlobal * 100)}% of one year of global production`;
  return `≈ ${yearsOfGlobal.toFixed(1)} years of global production`;
}
```

Unit tests: assert correct strings at boundary masses (0.030 g, 1 g, 1 kg, 1000 kg, 100000 kg, 2250000 kg, 22500000 kg).

---

## `<Pu238FactCard />` (Pu-238)

Props: `currentMassGrams: number`. Slider-position-dependent contextual fact, appearing in the same slot the gold/silver panels use for `<QuantityAnchorCard />`. Mapping:

```typescript
function pu238Fact(g: number): string {
  if (g < 1)      return "About a grain";
  if (g < 10)     return "About a heat-source pellet for a small RTG";
  if (g < 50)     return "Roughly the canonical fuel for a CubeSat-scale deep-space mission";
  if (g < 200)    return "About one GPHS fuel module — NASA's standard heat-source unit (~150 g)";
  if (g < 1000)   return "Several GPHS modules — enough for a small RTG";
  if (g < 5000)   return "Roughly Voyager 1's original fuel load (~4.5 kg) — the substance powering humanity's farthest object";
  if (g < 10000)  return "Approaching theoretical critical mass for bare metal (~10 kg) — would melt itself long before assembly";
  if (g < 50000)  return "Multiple flagship deep-space missions' worth of fuel";
  return                 "More than all Pu-238 ever produced for civilian space use";
}
```

Style: matches `<QuantityAnchorCard />` for visual consistency across cube-mode panels. Italics, small type, beside the readout.

Unit tests: assert correct strings at boundary masses.

---

## Done when

- All seven components exist under `src/lib/components/` with type-safe props
- Each component renders without crashing when supplied with edge-case props (zero mass, very large mass, missing data)
- Unit tests cover the boundary cases listed for `<QuantityAnchorCard />`, `<CubeGlowOverlay />`, `<CocaineDenominationRow />`, `<Pu238FactCard />`
- `npm run test` passes
- Storybook entries (or equivalent) exist for each component if the project uses one
- Conventional commits, one logical unit per commit (e.g. `feat: add CubeGlowOverlay component`, `test: cover CubeGlowOverlay boundary masses`)

**Stop. Confirm components compile and unit-test cleanly before proceeding to Stage 4.**
