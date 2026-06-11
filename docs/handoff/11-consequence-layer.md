# Stage 11 — Consequence layer ("what the weight does")

*Read `00-OVERVIEW.md` first. Independent of Stage 10 — can ship before or after the scale-band continuum. Small, cheap, high-leverage.*

## ROLE

You are adding one line of dry physical-consequence copy to every cube-mode readout. The site is called *Weigh-In* and the UI currently only ever shows volume and a mass figure. This stage makes mass *felt*: what this much stuff would do to a floor, a crew, a truck. One line, brand voice (honest, precise, slightly dry — never hypey), always derived from the live mass.

## Hard constraints

- **No fabricated figures.** Every threshold ships with a `source` field. Entries marked [VERIFY] below are provisional — confirm against a primary source or replace before launch. If a figure can't be sourced, cut the line; do not approximate silently.
- **One line at a time.** Never stack consequences. The picker returns the single best match.
- **US-primacy (2026-05-04):** imperial-first phrasing via the existing `formatMass()` conventions; US anchor objects.
- **Brand voice:** statements of physical fact, not jokes. The humour is emergent, never written in.
- **Applies to cube-mode commodities only.** Cocaine's still-with-readout keeps its existing pricing/denomination apparatus; do not mix registers.

## What to build

### 1. Pure helper — `src/lib/consequences.ts`

```typescript
export interface ConsequenceEntry {
  id: string;
  minKg: number;          // inclusive
  maxKg: number | null;   // exclusive; null = open top band
  template: string;       // may use {n} like comparisons.ts
  source: string;
  perUnitKg?: number;     // for {n} computation
}

export function pickConsequence(massKg: number): string | null
```

Same shape and conventions as `comparisons.ts` — `{n}` substitution, band lookup, null below the floor. Floor the layer at 1 kg: below that, weight has no interesting consequences and the line is suppressed (sub-kg amounts are already served by `QuantityAnchorCard`).

### 2. Component — render slot in `ReadoutStrip`

One additional secondary line in the cube-mode readout, below cube edge, styled like the existing secondary lines, prefixed with a middot or nothing — no icon, no colour. Updates live with the slider; no transition needed (text swap is fine).

### 3. Copy bank — provisional thresholds

All masses are the *commodity* mass from the slider, not the cube edge. Bands below; verify-flagged values are placeholders for the real sourced figure, not approximations to keep.

| Band (kg) | Template | Source to confirm |
|---|---|---|
| 1–23 | "still a one-person lift — just" | NIOSH recommended weight limit, 51 lb / 23 kg |
| 23–100 | "past the recommended one-person lift ({n}× the NIOSH limit)" | NIOSH RWL, 23 kg |
| 100–400 | "a two-wheel hand-truck job, and a strong back" | [VERIFY — typical hand-truck rated capacity] |
| 400–1,000 | "forklift territory" | [VERIFY — Class I forklift base capacity] |
| 1,000–2,000 | "heavier than the payload of most half-ton pickups" | [VERIFY — F-150 payload range by config] |
| 2,000–11,000 | "needs a freight elevator — passenger lifts top out around 2,100 lb" | [VERIFY — ASME A17.1 typical passenger ratings] |
| 11,000–30,480 | "over the US highway payload limit for a single truckload" | [VERIFY — 80,000 lb federal gross vs tare → usable payload] |
| 30,480–200,000 | "≈ {n} fully loaded shipping containers (30.48 t max gross each)" | ISO 668 max gross, 30,480 kg |
| 200,000–10,100,000 | "more than the Statue of Liberty's copper and steel" | [VERIFY — NPS figure for statue tonnage] |
| 10.1M–53.15M | "heavier than the Eiffel Tower ({n}×)" | [VERIFY — SETE figure ~10,100 t] |
| 53.15M– | "≈ {n}× the Titanic, fully loaded" | 53,150 t displacement — **already canonical in `network-weight.ts`; reuse the constant, do not redeclare** |

Floor-loading line (the best one) is **deferred** until phrased defensibly: residential live-load ratings (40 psf, IRC) govern distributed load, not a dense cube's point load, and "would crack your floor" can't be claimed from that figure alone. If you want it, it needs a static-load calc with stated assumptions on the methodology page — open item, don't improvise.

### 4. Tests

- Band picker: one case per band + boundary cases, same style as the comparison/anchor tests.
- `{n}` substitution sanity (no "1×", no "1 containers" — singular/plural handling as in `comparisons.ts`).
- Titanic band imports the `network-weight.ts` constant (regression against value drift — see audit finding Q2; do not create a fifth copy of anything).

## Interaction with existing furniture

`QuantityAnchorCard` answers "how much stuff is this?" (wedding rings, Good Delivery bars). The consequence line answers "what would this much stuff *do*?" They coexist; they must never say the same kind of thing. If a copy review finds overlap, the anchor card wins and the consequence line yields.

## Open items

1. Verification pass on every [VERIFY] figure — list of primary sources to check is in the table. Nothing ships unverified.
2. Floor-loading methodology decision (see above).
3. Whether Pu-238 gets a thermal consequence line instead of a mass one above its dissipation threshold (ties into the Stage 6 meltdown visualisation — recommend yes, single line, same slot).
