# Stage 2 — Schema and data files

*Read `00-OVERVIEW.md` first. Stage 1 (spec sync) must be confirmed complete.*

This stage updates the type schema and creates the data files the renderer will read. **No component code yet** — that's Stage 3.

---

## Update `src/lib/commodities.ts`

```typescript
type RenderStyle =
  | "cube"                  // gold, silver, Pu-238
  | "still_with_readout"    // cocaine
  | "progression"           // legacy, unused at MVP
  | "vessel"                // legacy, unused at MVP
  | "bulk";                 // legacy, unused at MVP

interface Commodity {
  id: string;
  displayName: string;
  mvpLaunch: boolean;             // NEW — page render loop iterates only over true
  pageOrder?: number;             // NEW — ordering for MVP page render (1=gold, 2=silver, 3=pu238, 4=cocaine)
  renderStyle: RenderStyle;       // existing
  glowScales?: boolean;           // NEW — Pu-238 only; cube renderer applies glow overlay when true
  geigerCrackle?: boolean;        // NEW — Pu-238 only; cube renderer applies opt-in Geiger audio when true
  specificActivityCiPerGram?: number; // NEW — Pu-238 only; ~17 Ci/g, drives Geiger click rate
  densityGramsPerCm3?: number;    // existing on cube-mode commodities
  // ... other existing fields preserved
  quantityAnchorsKey?: string;    // NEW — references entry in quantity-anchors.json
  brandVoiceClarification?: string; // NEW — mandatory persistent caption (Pu-238 uses this)
}
```

Update each commodity entry:

| ID | mvpLaunch | pageOrder | renderStyle | density (g/cm³) | quantityAnchorsKey | glowScales | geigerCrackle | specificActivity | brandVoiceClarification |
|---|---|---|---|---|---|---|---|---|---|
| `gold` | true | 1 | cube | 19.30 | `gold` | — | — | — | — |
| `silver` | true | 2 | cube | 10.49 | `silver` | — | — | — | — |
| `pu238` | true (NEW) | 3 | cube | **19.8** | — | true | true | 17 | "Plutonium-238 — the radioisotope that powers spacecraft. Non-fissile, not weapons material." |
| `cocaine` | true (NEW) | 4 | still_with_readout | — | — | — | — | — | — |
| `copper` | false | — | cube | 8.96 | `copper` | — | — | — | — |
| `oil_brent` | false | — | vessel | 0.835 | — | — | — | — | — |
| `natgas` | false | — | bulk | — | — | — | — | — | — |
| `uranium_fuel_pellet` | false | — | progression | 10.97 | — | — | — | — | — |
| `platinum` | false | — | cube | 21.45 | — | — | — | — | — |
| `coffee` | false | — | bulk | — | — | — | — | — | — |
| `wheat` | false | — | bulk | — | — | — | — | — | — |

Pu-238 density of **19.8 g/cm³** is pure plutonium-238 metal — fractionally denser than gold (19.30). Cube edges are marginally smaller than gold for equivalent mass. Specific activity ~17 Ci/g drives the Geiger click rate in Stage 6 — at 1 g the rate is ~17 disintegrations per second × statistical sampling ratio for the audio (calibrated in Stage 6).

The page render loop iterates `mvpLaunch === true` commodities, sorted ascending by `pageOrder`. This is the single mechanism that locks gold → silver → Pu-238 → cocaine on the page.

---

## URL state additions

The existing URL state mechanism gains one field:

| Param | Type | Default | Range/values |
|---|---|---|---|
| `audio` | string | `off` | `off` \| `on` |

When `?audio=on`, the Pu-238 panel's Geiger crackle is enabled. State persists per the existing `history.replaceState` pattern. No other commodity reads this param; future audio additions (if any) will gain their own commodity-scoped flags rather than reusing this one.

---

## Update `src/lib/illustrative-prices.json`

Preserve existing entries (`uranium_fuel_pellet`, `californium_252`). Add two new entries:

```json
{
  "uranium_fuel_pellet": { /* preserved as-is */ },
  "californium_252": { /* preserved as-is */ },

  "cocaine": {
    "tiers": {
      "producer": {
        "pricePerKg": 2500,
        "range": [1500, 3500],
        "purityAssumption": "raw refined base",
        "asOfDate": "2024-12-31",
        "source": "UNODC World Drug Report 2024"
      },
      "wholesale": {
        "pricePerKg": 30000,
        "range": [25000, 35000],
        "purityAssumption": "≥80% pure (US wholesale standard)",
        "asOfDate": "2024-12-31",
        "source": "UNODC 2024 / DEA NDTA 2024"
      },
      "retail": {
        "pricePerKg": 120000,
        "range": [80000, 250000],
        "purityAssumption": "purity-adjusted to 100% for cross-tier comparison",
        "asOfDate": "2024-12-31",
        "source": "DEA / EMCDDA"
      }
    },
    "primaryTier": "wholesale",
    "sources": [
      "UNODC World Drug Report 2024 — unodc.org",
      "DEA National Drug Threat Assessment 2024 — dea.gov",
      "EMCDDA European Drug Report 2024 — emcdda.europa.eu"
    ],
    "methodology": "Three-tier pricing (producer / wholesale / retail-pure-equivalent) reflects the actual structure of the cocaine market; no spot price exists. Wholesale tier drives the primary BTC-equivalence readout because it is the most directly comparable to other commodities (standardised purity, kilogram-scale transactions). Producer and retail tiers display alongside as comparison rows. Range figures reflect typical spread documented in the cited sources; midpoints are used for display.",
    "notes": "Illustrative pricing only. No spot market exists. Figures from peer-reviewed and law-enforcement reporting. Annual global production for absurdity-tier framings: ~2,250 tonnes (UNODC 2024 estimate)."
  },

  "pu238": {
    "pricePerGram": 5000,
    "range": [4000, 8000],
    "fullyLoadedProgramCostPerGram": 100000,
    "asOfDate": "2024-12-31",
    "sources": [
      "DOE Office of Nuclear Energy — energy.gov",
      "NASA Planetary Science Division — Pu-238 program ~$150M/year for 1.5 kg/year production",
      "The Planetary Society — planetary.org/articles/plutonium-power-for-space-missions",
      "Cassini Mission OIG Report (1997) — $1,968/g escalated to 2024 dollars",
      "Atomic Insights — atomicinsights.com/rtg-heat-sources-two-proven-materials"
    ],
    "methodology": "Material cost composite estimate. Pu-238 has no spot market — it is produced exclusively by the DOE for NASA missions. Material cost (~$5,000/g midpoint of $4,000–$8,000 range) is the cost of the substance itself in kilogram-sized lots, used for BTC equivalence as it is the most comparable to how other commodities are priced. Fully-loaded program cost (~$100,000/g) includes facility maintenance, regulatory infrastructure, and the institutional apparatus required for production; cited separately on methodology page as contextual comparison.",
    "notes": "Non-fissile alpha emitter. 0.57 W/g decay heat. Density: 19.8 g/cm³ (pure metal). Used in NASA radioisotope thermoelectric generators (RTGs) for deep-space missions: Voyager, Galileo, Cassini, Curiosity, Perseverance, New Horizons. US production halted 1988, restarted 2015. Cannot go critical in any realistic configuration — decay heat would melt any approach to critical mass long before assembly, and the isotope's nuclear properties don't sustain chain reactions regardless. Bare-sphere theoretical critical mass: 9.04–10.07 kg per Wikipedia / DOE references."
  }
}
```

---

## Create `src/lib/quantity-anchors.json`

New file. Editorial fact cards keyed to mass in kilograms, fired by proximity (slider's computed mass within ±10% of an anchor's quantity). When multiple anchors match, pick highest priority (1 beats 2); break ties by ascending mass.

```json
{
  "gold": [
    {
      "id": "iphone_gold",
      "quantityKg": 0.000034,
      "displayName": "≈ the gold in one iPhone",
      "description": "Modern smartphones contain ~34 mg of gold across connectors and PCBs.",
      "source": "USGS / industry estimates",
      "priority": 2
    },
    {
      "id": "wedding_ring",
      "quantityKg": 0.004,
      "displayName": "≈ a standard wedding ring",
      "description": "Typical 18k gold wedding band, ~4 g.",
      "priority": 1
    },
    {
      "id": "olympic_medal",
      "quantityKg": 0.006,
      "displayName": "≈ the gold in an Olympic gold medal",
      "description": "Olympic golds have been silver-and-gold-plated since the 1912 Stockholm games. Actual gold content: ~6 g.",
      "source": "International Olympic Committee",
      "priority": 2
    },
    {
      "id": "good_delivery_bar",
      "quantityKg": 12.44,
      "displayName": "≈ one Good Delivery bar",
      "description": "400 troy oz LBMA-standard bar — the institutional unit of the gold market.",
      "source": "London Bullion Market Association",
      "priority": 1
    },
    {
      "id": "tutankhamun_coffin",
      "quantityKg": 110.4,
      "displayName": "≈ Tutankhamun's innermost coffin",
      "description": "110.4 kg of solid gold. Egyptian Museum, Cairo.",
      "priority": 1
    },
    {
      "id": "largest_bar_cast",
      "quantityKg": 250,
      "displayName": "≈ the largest gold bar ever cast",
      "description": "Mitsubishi Materials, 2005, 250 kg.",
      "priority": 2
    },
    {
      "id": "brinks_mat",
      "quantityKg": 2700,
      "displayName": "≈ the Brink's-Mat haul (1983)",
      "description": "Heathrow robbery, 2.7 tonnes of gold. Most never recovered.",
      "priority": 1
    },
    {
      "id": "annual_production",
      "quantityKg": 3200000,
      "displayName": "≈ one year of global gold production",
      "description": "Mine output 2024 estimate.",
      "source": "World Gold Council 2024",
      "priority": 1
    },
    {
      "id": "spdr_gld",
      "quantityKg": 900000,
      "displayName": "≈ SPDR Gold Trust (GLD) holdings",
      "description": "Largest gold ETF by assets.",
      "source": "SPDR Q4 2024",
      "priority": 2
    },
    {
      "id": "uk_reserves",
      "quantityKg": 310000,
      "displayName": "≈ the Bank of England's gold reserves",
      "description": "Post the 1999–2002 sale of ~395 tonnes at ~$275/oz — 'Brown's Bottom'.",
      "source": "World Gold Council, Q4 2024",
      "priority": 1
    },
    {
      "id": "us_treasury",
      "quantityKg": 8133000,
      "displayName": "≈ US Treasury gold reserves",
      "description": "Fort Knox, West Point Mint, Denver Mint combined.",
      "source": "US Treasury annual report",
      "priority": 1
    },
    {
      "id": "lbma_vaults",
      "quantityKg": 8800000,
      "displayName": "≈ all gold in LBMA London vaults",
      "description": "Roughly 8,500–9,200 tonnes across the LBMA vault network.",
      "source": "LBMA monthly reports",
      "priority": 1
    },
    {
      "id": "indian_household",
      "quantityKg": 25000000,
      "displayName": "≈ Indian household gold",
      "description": "The largest private hoard on Earth — roughly 12% of all gold ever mined.",
      "source": "World Gold Council estimate",
      "priority": 1
    },
    {
      "id": "all_gold_mined",
      "quantityKg": 213000000,
      "displayName": "≈ all gold ever mined",
      "description": "Fits in a cube ~22 m on a side. Warren Buffett's frame.",
      "source": "World Gold Council 2024",
      "priority": 1
    }
  ],

  "silver": [
    {
      "id": "morgan_dollar",
      "quantityKg": 0.02406,
      "displayName": "≈ a Morgan/Peace silver dollar",
      "description": "US standard silver dollar, 1878–1935.",
      "priority": 2
    },
    {
      "id": "solar_panel",
      "quantityKg": 0.020,
      "displayName": "≈ the silver in one solar panel",
      "description": "~20 g per panel. Photovoltaic demand has been quietly reshaping the silver market for a decade.",
      "source": "The Silver Institute",
      "priority": 1
    },
    {
      "id": "good_delivery_silver",
      "quantityKg": 31.1,
      "displayName": "≈ one LBMA silver Good Delivery bar",
      "description": "1,000 troy oz, the institutional silver wholesale unit.",
      "priority": 2
    },
    {
      "id": "atocha",
      "quantityKg": 40000,
      "displayName": "≈ the Atocha shipwreck recovery",
      "description": "1622 Spanish galleon, recovered from 1985. ~40 tonnes of silver bars and coins.",
      "priority": 1
    },
    {
      "id": "hunt_brothers",
      "quantityKg": 3110000,
      "displayName": "≈ the Hunt Brothers' 1980 corner",
      "description": "100 million troy oz directly held (~3,110 tonnes). Drove silver from $6 to $50/oz before Silver Thursday wiped them out.",
      "priority": 1
    },
    {
      "id": "buffett_silver",
      "quantityKg": 4040000,
      "displayName": "≈ Berkshire Hathaway's 1998 silver position",
      "description": "130 million troy oz (~4,040 tonnes). Buffett's only significant commodity speculation, liquidated by 2006.",
      "source": "Berkshire 1998 annual report",
      "priority": 1
    },
    {
      "id": "comstock_total",
      "quantityKg": 7300000,
      "displayName": "≈ all silver from the Comstock Lode",
      "description": "1859–1890s total output. Helped finance the Union in the Civil War.",
      "priority": 1
    },
    {
      "id": "annual_silver",
      "quantityKg": 26000000,
      "displayName": "≈ one year of global silver production",
      "description": "2024 estimate.",
      "source": "USGS 2024 / The Silver Institute",
      "priority": 1
    },
    {
      "id": "all_silver_mined",
      "quantityKg": 1740000000,
      "displayName": "≈ all silver ever mined",
      "description": "All silver mined throughout human history.",
      "source": "USGS / The Silver Institute",
      "priority": 1
    }
  ]
}
```

Note the unit conversions in the silver entries: 100 million troy oz × 31.1035 g/oz ≈ 3,110,000 kg (Hunt Brothers); 130 million troy oz ≈ 4,040,000 kg (Buffett). Spot-check the maths if anything looks off.

---

## Done when

- `commodities.ts` reflects the new schema with all four launch commodities marked `mvpLaunch: true` and the rest `false`
- `illustrative-prices.json` has the cocaine and Pu-238 entries alongside preserved existing entries
- `quantity-anchors.json` exists at `src/lib/quantity-anchors.json` with gold and silver entries
- Type-check passes (`npm run check` or equivalent)
- One commit per file: `feat: extend Commodity schema for mvpLaunch + glow + anchors`, `feat: add cocaine and Pu-238 illustrative pricing`, `feat: add gold and silver quantity-anchor library`

**Stop. Confirm schema and data look right before proceeding to Stage 3.**
