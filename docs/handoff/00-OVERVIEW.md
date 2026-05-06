# Bitcoin Weigh-In — Marathon Session Overview

*Read this first at the start of every stage. Single source of truth for context. Last updated 4 May 2026.*

---

## Working assumptions

- **BTC price as of session date (5 May 2026): ~$80,000.** All worked numbers in subsequent stages use this. When `prices.json` loads on the day, canonical-position figures will shift; the fact-card thresholds are pinned to absolute mass not BTC, so they'll fire at the right substantive positions regardless.
- **Page render order at MVP, locked: gold → silver → Pu-238 → cocaine.** Metals frame the tour, Pu-238 is the philosophical apex, cocaine is the editorial close.

## What this session is for

A coordinated implementation push that compresses two weeks of design conversation into seven staged Code sessions. The seven stages are sequential, each ends with a stop-and-confirm boundary, and each stage prompt lives in its own file:

```
00-OVERVIEW.md            ← you are here
01-spec-sync.md           ← Stage 1: read + summarise + sync docs
02-schema-and-data.md     ← Stage 2: schema + illustrative-prices + quantity-anchors
03-components.md          ← Stage 3: build new component scaffolding
04-gold-silver.md         ← Stage 4: wire up gold and silver
05-cocaine.md             ← Stage 5: wire up cocaine
06-pu238.md               ← Stage 6: wire up Pu-238
07-tests-signoff.md       ← Stage 7: tests, regression, final report
```

Don't try to ship multiple stages in one session. Stop at each boundary. The phase shape exists so the human reviewer can catch any misreading before it propagates.

---

## The four locked pivots

These are the design changes this session encodes. None are speculative. None are up for renegotiation inside the session. If any of these feels wrong as you implement, surface it — don't quietly amend.

### Pivot 1 — Four-commodity launch

Launch scope shrinks from 6+ commodities to **four: gold, silver, cocaine, Pu-238**. Everything else (copper, oil, natural gas, uranium fuel pellet, platinum, coffee, wheat) drops out of MVP and becomes post-launch work.

Their schema entries and price data stay in the codebase — flagged inactive via a new `mvpLaunch: boolean` field on the `Commodity` interface. The page render loop iterates only over commodities with `mvpLaunch: true`. The uranium fuel pellet is deferred; Pu-238 takes its philosophical nuclear-fuel slot.

### Pivot 2 — Universal Shiba on cube-mode panels

The cycling 19-entry scale-reference library is deleted. A single Shiba Inu, anchored at true real-world height of **40 cm**, is the universal scale reference on every cube-mode panel — gold, silver, and Pu-238. The camera viewport scales to keep both the cube and the dog in frame. The dog never moves or resizes in real-world terms — the viewport does the work.

Cocaine is the single exception. Its forensic-still register is set entirely by the image; introducing a 40 cm reference dog would muddle the editorial mood the still does on its own.

### Pivot 3 — Two render styles only

Cube mode (gold, silver, Pu-238) and still-with-readout (cocaine). Tile mode and progression mode are unused at launch — preserve the schema definitions but no commodity invokes them.

Pu-238 is rendered in cube mode like gold and silver, with two additional layers that scale with mass: a **radiant glow** keyed to blackbody emission temperature (separate intensity and colour-temperature channels) and an **opt-in Geiger crackle** synthesising real Poisson-distributed click events at a rate proportional to specific activity. Pure Pu-238 metal at **19.8 g/cm³** density. The visualisation has the luxury of nothing spontaneously disassembling — pure plutonium metal at multi-kilogram mass would self-destruct from its own decay heat in reality, but the cube on screen is what the dial says it is. The "would melt itself in reality" caption appears at relevant thresholds as honest commentary on what physics says about the real world.

### Pivot 4 — US-primacy locked

Dollars and imperial as defaults everywhere. Metric and other currencies as opt-in via the existing `unit=metric` and `currency=` URL params.

Sweep existing UK-flavoured copy:
- "≈ N UK homes" fact templates → "≈ N US homes"
- "£1 coin" references in old comments → strip or replace
- Default mass formatting → lb / oz primary, kg / g secondary
- Verify `formatMass()` and `formatLength()` helpers default to imperial unless `unit=metric` is set

---

## Things deliberately not in this session's scope

To prevent drift, these are explicitly out:

- The date scrubber (Phase 3 work)
- Entity holdings automation (Phase 3.5)
- OG image generation (Phase 4)
- Methodology page content (Phase 4)
- Lightning tipjar wiring (Phase 4)
- Three.js hero scenes (Phase 5)
- Affiliate links (Phase 6)
- Newsletter capture (Phase 4)
- Re-enabling deferred commodities (post-launch)

If you find yourself wanting to touch any of the above to "complete" something, stop and surface it as a question instead.

---

## Constraints reminder

- **Never put API keys in chat.** `FRED_API_KEY` and `COINGECKO_API_KEY` come from `.env` locally and repo secrets in Actions. If you find yourself wanting to ask for a key value directly — that's a mistake, push back on the prompt instead.
- **Small commits, conventional messages.** `feat: add Pu-238 cube glow`, `chore: remove cycling reference library`, `docs: sync DECISIONS.md for May 4 pivots`, etc.
- **One logical unit per commit.** Easier to revert, easier to read in `git log` later.
- **Spec is the source of truth.** If the spec says one thing and your memory says another, trust the spec. If you genuinely think the spec is wrong, stop and surface it.
- **Asset gaps are placeholder-only, never fabricated.** When a sprite is missing (Shiba, cocaine forensic still, Pu-238 metal cube), render a labelled grey placeholder and continue. Do not attempt to author Blender assets yourself.

Now read the stage prompt for the current stage and proceed.
