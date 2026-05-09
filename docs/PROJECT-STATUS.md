# Bitcoin Weigh-In — Project Status

*Last updated: 9 May 2026*

## What this is

A static site visualising what bitcoin's purchasing power looks like across physical commodities, with a 2013–present history scrubber. Domain: **bitcoinweighin.com**. Staging: **bitcoinweighin.pages.dev**.

## Current phase

**Phase 2c — Mixed-mode renderer integration (polish stage).** All four launch panels are now wired end-to-end against real assets: gold and silver cube + Shiba; Pu-238 cube + glow + opt-in Geiger crackle (cube sprite still TBD — see open threads); cocaine still + readout with the forensic-lab still asset on disk. Recent work has been viewport polish — baseline correction per sprite, scene budget, and the 2026-05-08 viewport-sizing reversal that scales the scene to the dominant element rather than the cube alone. Stage 7 (tests & sign-off) and the remaining asset gap (Pu-238 cube sprite) are the visible blockers between here and a launchable preview.

## Phases complete

**Phase 0 — Data pipeline.** Full daily commodity price history 2013-01-01 to present from stooq (metals, agri, BTC) and FRED (oil). BTC circulating supply computed deterministically from block-height/halving schedule. `prices.json` at 0.77 MB raw / 0.17 MB gzipped. 18 unit tests passing. GitHub Action daily cron configured with `STOOQ_API_KEY` and `FRED_API_KEY` repo secrets. Stooq introduced an API key requirement post-bootstrap; auth fix landed 2026-04-25 along with diagnostic improvements to `health.json` and a workflow guard against silent failure modes. Daily price commits are still landing reliably (latest: 2026-05-08).

**Phase 1 — Skeleton.** SvelteKit with `@sveltejs/adapter-static` deployed to Cloudflare Pages. URL state wired end-to-end. Logarithmic BTC slider (1 sat to 21M), date picker, metric/imperial unit toggle, preset pill bar with denominations and absurdity categories. Dollar readout is a primary UI element directly under the slider with tier-aware formatting (M/B/T) at extreme amounts. Readout strip carries continuity with mass, volume, and an optional per-commodity count line in tabular figures.

**Phase 2a — Cube-mode asset production (gold + silver).** Gitignore fixed to track `assets/blender/**/*.blend` and the `scripts/blender/` Python pipeline. `assets/materials-reference.md` created with iterated PBR values locked. Three-quarter camera rig (`scripts/blender/rig_three_quarter.py` + `assets/blender/_rigs/three_quarter.blend`) committed. Gold and silver cube sprites + contact shadows rendered to `static/sprites/{gold,silver}/cube@2x.png` and `cube-shadow@2x.png` against the locked PBR mirror-polish material spec.

**Phase 2b — Cube renderer integration.** `Commodity` schema extended with `renderStyle: "cube" | "still_with_readout" | "progression"` and `cubeSpritePath` / `cubeShadowPath`. New components: `CubeRenderer.svelte`, `ScaleReference.svelte`. `PhysicalRep.svelte` is now a dispatcher branching on renderStyle. Gold and silver migrated to `renderStyle: "cube"`; their progression-mode entries removed. `ReadoutStrip` reshaped for cube mode (mass primary, volume + cube edge + dollar value, BTC-equivalent continuity line).

**Phase 2b.1 — Universal Shiba reference.** Static sprite rendered through the canonical Blender pipeline (`scripts/blender/shiba_inu.py`). Animated `.gltf` served from `static/models/references/shiba_inu/` for an opt-in easter egg: `<model-viewer>` swaps in for the static sprite on hover (≥200 ms desktop), sustained tap (≥500 ms mobile), or the `?easter=doge` URL parameter; all three respect `prefers-reduced-motion: reduce`. `@google/model-viewer` and the `.gltf` are dynamically imported on first trigger so neither costs anything on initial page load. Promoted to canonical pattern under the 2026-05-04 universal-Shiba pivot — the Shiba is now the single scale reference on every cube-mode panel.

## Phase 2c — Stage-by-stage status

Stages laid out in `docs/handoff/02–07`. Status as of 2026-05-08:

- **Stage 2 — Schema and data:** **shipped.** `mvpLaunch`, `glowScales`, `geigerCrackle`, `stillImagePath`, `quantityAnchorsKey`, the new `'still_with_readout'` renderStyle, illustrative-prices entries for cocaine and Pu-238, US-primacy formatting helpers.
- **Stage 3 — Components:** **shipped** — `CubeRenderer`, `ScaleReference`, `StillPanel`, `CubeGlowOverlay`, `Pu238FactCard`, `CocaineDenominationRow`, `TieredPricingTable`, `QuantityAnchorCard` all live in `src/lib/components/` and render in tests.
- **Stage 4 — Gold + silver:** **shipped.** Cube + Shiba renders; readout strip mass/volume/edge pair; `QuantityAnchorCard` contextual fact cards for both metals; cube-edge canonical regression tests stand in for the 10-baseline-screenshots Playwright dependency.
- **Stage 5 — Cocaine:** **shipped.** Forensic-lab still asset (`/sprites/cocaine/cocaine-lab.webp`) authored and on disk; `StillPanel` wired with mass primary, denomination row, three-tier pricing, markup fact, purity footnote, and persistent source attribution. Integration test mounts `CommoditySection` and confirms the still-mode dispatch path.
- **Stage 6 — Pu-238:** **partial.** `CubeGlowOverlay` (intensity + colour-temperature channels driven by mass) and `Pu238FactCard` (melt-threshold commentary) are shipped and unit-tested. Outstanding work, in recommended order: (a) **Pu-238 cube sprite** — `commodities.ts` references `/sprites/pu238/cube@2x.png` but the file does not exist on disk; `scripts/blender/pu238_cube.py` to be written inheriting from `silver_cube.py`, with the Pu-238 PBR material spec landing in `assets/materials-reference.md` (silvery-grey base, lower metalness than the noble metals because Pu's 5f electronic structure makes it a poorer optical metal — values to be calibrated against real photographs); (b) **glow tuning** — mass-threshold curves for intensity and colour temperature, calibrated so ~1 g matches real fuel-pellet photographs; (c) **meltdown visualisation** (per 2026-05-09 decision) — a ~0.7 Hz sine modulation on glow intensity above the dissipation threshold + a synced heat-haze shimmer on the contact shadow + a green→amber→red status dot + one readout line, all gated behind a geometry-corrected thermal threshold and silenced under `prefers-reduced-motion: reduce`; (d) **Geiger crackle** — Web Audio Poisson synthesis at ~17 Ci/g × mass, default off, opt-in via `?audio=on`, tube-transient click profile.
- **Stage 7 — Tests and sign-off:** **partial.** 123 unit tests passing across 9 files (volume, cube-edge canonical, viewport scaling, glow, Pu-238 fact, cocaine denomination, cocaine integration, quantity anchor, pipeline). No Playwright visual regression yet — deferred per the 2026-04-19 decision; numeric canonical-edge tests stand in.

## What's next

**Phase 2c remaining:**
- **Pu-238 cube sprite + shadow** rendered through the canonical Blender pipeline. Inherits gold/silver rig; the only difference is the PBR material (Pu-238 darker grey, slightly cooler than platinum).
- **Geiger crackle audio.** Web Audio synthesis from a Poisson distribution at ~17 Ci/g; default off, persisted via `?audio=on`. Mute control on the Pu-238 panel.
- **Pre-launch polish sweep:** copy review for US-primacy compliance (UK-flavoured fact strings, "≈ N UK homes" survivors), responsive QA at common breakpoints with the new viewport rule, brand-voice clarification placement audit on the Pu-238 panel.

**Phase 3 — Scrubber and anchor events.** Timeline scrubber at bottom of viewport, play/pause/speed controls, anchor event dots with caption cards on crossing. Dual-range mobile design.

**Phase 3.5 — Entity holdings automation.** Build automated pipeline for entity preset holdings from CoinGecko `/companies/public_treasury/bitcoin` and bitcointreasuries.net scraping. Historical holdings by date so scrubber resolves entities as-of the scrubbed date. Re-enable entity presets that were deferred from MVP.

**Phase 4 — Polish and launch.** Methodology page, `/data` page with CC-BY dataset download, dynamic OG image generation via Cloudflare Workers, about page, email capture, Lightning tipjar at `tim@bitcoinweighin.com` via Alby + static `.well-known/lnurlp` file. Launch: HN Show, crypto Twitter, r/bitcoin, r/dataisbeautiful.

**Phase 5 (optional).** Three.js hero scenes for gold and oil. Subtle idle animation, not interactive.

**Phase 6 (post-launch, ongoing).** Curio cabinet Tier 3 commodities (U3O8 yellowcake, rhodium, osmium, saffron, tritium, californium-252) — all candidates for cube mode given they're dense fungible substances. Affiliate integrations. Weigh-In newsletter cadence.

## Key decisions locked

- **Viewport sizing — dominant-element rule (2026-05-08, refined 2026-05-09):** `viewportHeightM = max(SHIBA_HEIGHT_M, cubeEdgeM) × 1.10`. Each element has a fixed bottom-corner anchor at midline ± `gapPx` (50 px desktop, 14 px below 768 px) — the *visible* corner, with per-sprite `translateX` to compensate for the transparent canvas margin. `pxPerMetre` is visible-pixels-per-metre; each slot is scaled by `1 / visibleHeightFraction` so the sprite's visible bbox fills the row without empty headroom. Row height is derived from the dominant element's visible height × margin (capped at `min(540 px, 50vh)` desktop / `min(360 px, 50vh)` mobile) so the row only consumes vertical space proportional to the visible content. Width clamp checks both cube and Shiba — at near-equal real heights (e.g. 1789 BTC) the cube's higher visible-width-to-height ratio makes its width the binding side even when Shiba dominates by height.
- **Four-commodity launch (2026-05-04):** Launch set is gold, silver, Pu-238, cocaine in locked render order. Other commodities (copper, oil_brent, uranium_fuel_pellet, platinum, coffee, wheat) flagged `mvpLaunch: false` and re-enter post-launch. Pu-238 displaces the uranium fuel pellet at the philosophical nuclear-fuel slot.
- **Universal Shiba (2026-05-04):** Cycling 20-entry reference library deleted; single Shiba at true 40 cm height is the universal cube-mode scale anchor. Persistently visible at every slider position. Cocaine is the single exception (no dog).
- **Cocaine still-with-readout (2026-05-04):** Forensic-evidence-room still + bold dynamic readout. No cube, no dog, no quantity anchors. Image carries register; readout carries truth at extremes. Reverses the prior five-stage progression treatment.
- **Pu-238 (2026-05-04):** Pure metal at 19.8 g/cm³ rendered as cube + blackbody glow + opt-in Geiger crackle (default off, `?audio=on` to enable). Mandatory persistent brand-voice clarification: *"Plutonium-238 — the radioisotope that powers spacecraft. Non-fissile, not weapons material."* Pricing illustrative ~$5,000/g material cost (composite from DOE / NASA Planetary Science / Cassini OIG 1997 escalated to 2024).
- **US-primacy (2026-05-04):** Dollars and imperial as defaults. `unit=imperial` is the URL-state default; `currency=usd` unchanged. Metric and other currencies opt-in. `formatMass()` and `formatLength()` helpers default to imperial unless `unit=metric` is set.
- **Cube mode for metals (2026-04-25):** Metals are rendered as a single cube of intrinsic substance volume against the Shiba. Reverses the prior 10-stage progression. More honest, continuous (no stage transitions), roughly half the asset budget for the metals family.
- **Blender pipeline via Python (2026-04-25):** Asset rendering driven by versioned Python scripts in `scripts/blender/` invoked headless. The MCP server approach attempted in a prior session did not work out; Python scripts are the working route.
- **PBR material values authoritative in `assets/materials-reference.md` (2026-04-25, refined 2026-04-29):** The materials reference file holds iterated production values (gold + silver mirror-polish: roughness 0.08 base with 0.05–0.12 procedural variation). The earlier SPEC.md cast-feel values (roughness 0.20) were superseded once silver landed and out-shone the gold render.
- **Framework:** SvelteKit with `@sveltejs/adapter-static` (not `-cloudflare`); output dir is `build/`. Fully prerendered static site, no Workers needed.
- **Hosting:** Cloudflare Pages. Free tier.
- **BTC slider range:** 0.00000001 (1 sat) to 21,000,000 (total supply), logarithmic scale.
- **MVP presets:** denominations + absurdity only (7 total). History and Entity categories deferred to Phase 3.5 and editorial content respectively.
- **BTC price source:** stooq (ticker `btcusd`) alongside the other commodities, not CoinGecko. One source, one parser, one failure mode. Stooq API key required since 2026-04-25.
- **Circulating supply:** computed from block height deterministically, no API dependency.
- **Data license:** CC-BY-4.0 for the prices dataset. MIT for the code.
- **Lightning tipjar:** Alby with custom domain at `tim@bitcoinweighin.com` via static `.well-known/lnurlp` file. Xverse remains separate for Runes/Ordinals/parasite.wtf rewards. Copy: *"Tips via Lightning: tim@bitcoinweighin.com. Plug the amount into the slider to see what you just sent."*

## Open threads

- **Pu-238 cube sprite + shadow.** `commodities.ts` references `/sprites/pu238/cube@2x.png` and `/sprites/pu238/cube-shadow@2x.png` but neither exists on disk yet. The panel will 404 the cube image until rendered. Stage 6 task — `scripts/blender/pu238_cube.py` to inherit from `silver_cube.py`; `assets/materials-reference.md` to gain a Pu-238 row.
- **Geiger crackle audio synthesis.** Schema flag `geigerCrackle: true` is set on Pu-238; the audio implementation isn't wired yet. Web Audio + Poisson click rate proportional to mass × specific activity (~17 Ci/g). Tube-transient click profile (fast attack, dry decay, slight HF content), not a looped recording. Stage 6 task.
- **Pu-238 melt-threshold values + meltdown visualisation.** Threshold needs a geometry-corrected thermal calc (decay-heat input vs. surface-area dissipation, against Pu's 640 °C melting point — single-digit to tens of grams territory for pure cube-form Pu-238). Visualisation per 2026-05-09 decision: ~0.7 Hz glow-intensity pulse + synced contact-shadow heat-haze + green→amber→red status dot + one readout line. `prefers-reduced-motion: reduce` kills the motion, keeps the colour state and copy. Stage 6 task.
- **Mobile scrubber precision.** 13 years of daily data can't be dragged accurately on a ~400 px timeline. Dual-range design (coarse year + fine day) likely required. Phase 3 problem.
- **Custom domain and lightning address.** Both still pending — Phase 4 tasks.
- **Newsletter — *The Weigh-In*** as working name; tool and newsletter share brand. Reserve Buttondown/Beehiiv name soon.
- **Staging vs main parity.** As of 2026-05-08 the staging URL still served the pre-fix viewport (tiny cube, tiny Shiba). Resolved by the 2026-05-08 viewport push; verify on the next deploy that the dominant-element rule lands.

### Deferred from MVP

The following commodities have schema entries in `src/lib/commodities.ts` flagged `mvpLaunch: false`. They re-enter post-launch as the four-commodity render pipeline stabilises:

- **uranium_fuel_pellet** — replaced at launch by Pu-238 (occupies the philosophical nuclear-fuel slot). May return as Tier 2.
- **copper** — candidate for cube-mode migration post-launch.
- **oil_brent** — vessel renderer remains stubbed.
- **natgas** — data feed already removed 2026-04-29; entry preserved as historical reference only.
- **platinum** — cube-mode candidate post-launch.
- **coffee** — bulk-mode renderer remains stubbed.
- **wheat** — data fetched, never rendered (deferred since 2026-04-20).

## Infrastructure

| Item | Status |
|---|---|
| Domain `bitcoinweighin.com` | Registered |
| GitHub repo `hmgovt/bitcoinweighin` | Private, live |
| Cloudflare Pages project | Provisioned, deploying from `main` |
| FRED API key | Generated, stored in password manager, set as repo secret |
| Stooq API key | Generated 2026-04-25, set as repo secret and in local `.env` |
| CoinGecko Demo API key | Generated (not yet needed for MVP) |
| Staging URL | bitcoinweighin.pages.dev |
| Custom domain mapping | Not yet configured (Phase 4) |
| Lightning address | Not yet set up (Phase 4) |
| Newsletter platform | Not yet registered (Phase 4) |
| Analytics | Not yet wired (Phase 4) |

## Recent session highlights

- **2026-05-04 (marathon spec sync):** Four-commodity launch pivot committed across SPEC, DECISIONS, and status. Universal-Shiba and US-primacy decisions locked. Stage 1 of `docs/handoff/` complete.
- **2026-05-04–07 (mixed-mode wiring):** Stages 2–6 substantially landed — schema additions, cocaine still + readout, glow overlay, Pu-238 fact card, quantity anchor cards. Cocaine forensic-lab still asset added to disk; integration test confirms still-mode dispatch.
- **2026-05-07–08 (viewport polish):** Multiple iterations on the cube + Shiba scene layout — half-divide bottom-corner anchoring, per-sprite baseline correction, scene budget enlargement, removal of YAxis component and reference label. The dominant-element viewport rule landed 2026-05-08 after staging revealed the prior rule was leaving 1 BTC views with two specks in a near-empty viewport.
- **2026-05-09 (viewport refinements, mostly mobile):** Edge-pinning and centred-pair drafts both lost the relative-scale read; landed on fixed midline anchors at ± `gapPx` with per-sprite L/R margin compensation so visible corners (not transparent canvas) sit on the anchor line. Switched `pxPerMetre` to visible-pixels-per-metre and scaled slots up by `1/visibleHeightFraction` so the visible content fills the row. Made the gap responsive (50 px → 14 px below 768 px) and derived row height from the dominant element's visible height × margin so the row never carries empty space above the visualisation. Width clamp now checks both cube and Shiba (regression: at 1789 BTC the cube was overflowing off the panel because the clamp only checked the slightly-taller Shiba). Daily cron continues to commit clean updates (2026-05-07, 2026-05-08, 2026-05-09).
