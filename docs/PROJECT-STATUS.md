# Bitcoin Weigh-In — Project Status

*Last updated: 5 May 2026*

## What this is

A static site visualising what bitcoin's purchasing power looks like across physical commodities, with a 2013–present history scrubber. Domain: **bitcoinweighin.com**. Staging: **bitcoinweighin.pages.dev**.

## Current phase

**Phase 2c — Mixed-mode renderer integration (in flight per `docs/handoff/`).** Marathon-session pivot to a four-commodity launch — gold, silver, Pu-238, cocaine — in locked render order. Three cube-mode panels with universal Shiba as the single scale anchor at true 40 cm height; one editorial-still panel for cocaine. Phase 2a/2b for gold and silver is the established pattern this phase extends — gold and silver cube sprites and the cube renderer are already shipped. The cycling 20-entry scale-reference library is being deleted in favour of the universal Shiba; copper, oil_brent, uranium_fuel_pellet, platinum, coffee, wheat (and the already-removed natgas) are flagged `mvpLaunch: false` and re-enter post-launch. **US-primacy locked 2026-05-04:** dollars and imperial as defaults; metric and other currencies opt-in via URL params. Stage 1 (spec sync) is complete; Stages 2–7 implement.

## Phases complete

**Phase 0 — Data pipeline.** Full daily commodity price history 2013-01-01 to present from stooq (metals, agri, BTC) and FRED (oil). BTC circulating supply computed deterministically from block-height/halving schedule. `prices.json` at 0.77 MB raw / 0.17 MB gzipped. 18 unit tests passing. GitHub Action daily cron configured with `STOOQ_API_KEY` and `FRED_API_KEY` repo secrets. Stooq introduced an API key requirement post-bootstrap; auth fix landed 2026-04-25 along with diagnostic improvements to `health.json` and a workflow guard against silent failure modes.

**Phase 1 — Skeleton.** SvelteKit with `@sveltejs/adapter-static` deployed to Cloudflare Pages. URL state wired end-to-end. Logarithmic BTC slider (1 sat to 21M), date picker, metric/imperial unit toggle, preset pill bar with denominations and absurdity categories. Dollar readout is a primary UI element directly under the slider with tier-aware formatting (M/B/T) at extreme amounts. Readout strip carries continuity with mass, volume, and an optional per-commodity count line in tabular figures.

**Phase 2a — Cube-mode asset production (gold).** Gitignore fixed to track `assets/blender/**/*.blend` and the `scripts/blender/` Python pipeline. `assets/materials-reference.md` created with iterated PBR values locked. Three-quarter camera rig (`scripts/blender/rig_three_quarter.py` + `assets/blender/_rigs/three_quarter.blend`) committed. Gold cube sprite at canonical 100 mm edge length plus contact shadow rendered to `static/sprites/gold/cube@2x.png` and `cube-shadow@2x.png`. Reference library: 19 SVG silhouettes at `static/sprites/references/`.

**Phase 2b — Cube renderer integration.** `Commodity` schema extended with `renderStyle: "cube" | "progression" | "vessel" | "bulk"` and `cubeSpritePath` / `cubeShadowPath`. New components: `CubeRenderer.svelte`, `ScaleReference.svelte`. `PhysicalRep.svelte` is now a dispatcher branching on renderStyle. Gold migrated to `renderStyle: "cube"`; its 10-stage `RenderProgression` removed. `ReadoutStrip` made cube-aware (skips stage-derived metadata for cube-mode commodities). The standalone `CoinReference` and `HumanSilhouette` components remain in place for progression-mode consumers; their visual logic is duplicated by the `pound_coin` and `person` entries in the reference library, which is the path cube-mode takes.

**Phase 2b.1 — Animal reference library, proof-of-concept (Shiba Inu).** First photoreal animal reference shipped. Static sprite rendered through the canonical Blender pipeline (`scripts/blender/shiba_inu.py`). Animated `.gltf` served from `static/models/references/shiba_inu/` for an opt-in easter egg: `<model-viewer>` swaps in for the static sprite on hover (≥200 ms desktop), sustained tap (≥500 ms mobile), or the `?easter=doge` URL parameter; all three respect `prefers-reduced-motion: reduce`. Library `@google/model-viewer` and the `.gltf` are dynamically imported on first trigger so neither costs anything on initial page load. *Promoted to canonical pattern under the 2026-05-04 universal-Shiba pivot — the Shiba is now the single scale reference on every cube-mode panel; the queue of 11 additional animals is retired.*

## What's next

**Phase 2b.2 — Remaining 11 animal references.** *Deprecated 2026-05-04 under the universal-Shiba pivot — only the Shiba survives. Queue retired; `assets/references-attribution.md` reduces to Shiba attribution only.*

**Phase 2c — Mixed-mode renderer integration.** This is the marathon session. Three cube-mode panels with universal Shiba (gold, silver, Pu-238) plus one editorial-still panel (cocaine), illustrative-pricing pattern extended to cocaine and Pu-238, quantity-anchor proximity card system introduced, Pu-238 cube glow + opt-in Geiger crackle authored. Stages laid out in `docs/handoff/` 02-spec-sync through 07-tests-signoff. US-primacy defaults rolled in alongside.

**Phase 2d — Vessel/bulk vocabularies and progression-mode commodities.** *Deferred post-launch under the four-commodity-launch pivot.* Oil-vessel, coffee, uranium fuel pellet, copper, platinum schema entries remain in the codebase under `mvpLaunch: false`. Re-enter as the launch four ship and the rendering pipeline stabilises.

**Phase 3 — Scrubber and anchor events.** Timeline scrubber at bottom of viewport, play/pause/speed controls, anchor event dots with caption cards on crossing. Dual-range mobile design.

**Phase 3.5 — Entity holdings automation.** Build automated pipeline for entity preset holdings from CoinGecko `/companies/public_treasury/bitcoin` and bitcointreasuries.net scraping. Historical holdings by date so scrubber resolves entities as-of the scrubbed date. Re-enable entity presets that were deferred from MVP.

**Phase 4 — Polish and launch.** Methodology page, `/data` page with CC-BY dataset download, dynamic OG image generation via Cloudflare Workers, about page, email capture, Lightning tipjar at `tim@bitcoinweighin.com` via Alby + static `.well-known/lnurlp` file. Launch: HN Show, crypto Twitter, r/bitcoin, r/dataisbeautiful.

**Phase 5 (optional).** Three.js hero scenes for gold and oil. Subtle idle animation, not interactive.

**Phase 6 (post-launch, ongoing).** Curio cabinet Tier 3 commodities (U3O8 yellowcake, rhodium, osmium, saffron, tritium, californium-252) — all candidates for cube mode given they're dense fungible substances. Affiliate integrations. Weigh-In newsletter cadence.

## Key decisions locked

- **Four-commodity launch (2026-05-04):** Launch set is gold, silver, Pu-238, cocaine in locked render order. Other commodities (copper, oil_brent, uranium_fuel_pellet, platinum, coffee, wheat) flagged `mvpLaunch: false` and re-enter post-launch. Pu-238 displaces the uranium fuel pellet at the philosophical nuclear-fuel slot.
- **Universal Shiba (2026-05-04):** Cycling 20-entry reference library deleted; single Shiba at true 40 cm height is the universal cube-mode scale anchor. Camera viewport zooms to keep cube and dog in frame. Cocaine is the single exception (no dog).
- **Cocaine still-with-readout (2026-05-04):** Forensic-evidence-room still + bold dynamic readout. No cube, no dog, no Y-axis, no quantity anchors. Image carries register; readout carries truth at extremes. Reverses the prior five-stage progression treatment.
- **Pu-238 (2026-05-04):** Pure metal at 19.8 g/cm³ rendered as cube + blackbody glow + opt-in Geiger crackle (default off, `?audio=on` to enable). Mandatory persistent brand-voice clarification: *"Plutonium-238 — the radioisotope that powers spacecraft. Non-fissile, not weapons material."* Pricing illustrative ~$5,000/g material cost (composite from DOE / NASA Planetary Science / Cassini OIG 1997 escalated to 2024).
- **US-primacy (2026-05-04):** Dollars and imperial as defaults. `unit=imperial` is the URL-state default; `currency=usd` unchanged. Metric and other currencies opt-in. `formatMass()` and `formatLength()` helpers default to imperial unless `unit=metric` is set.
- **Cube mode for metals (2026-04-25):** Gold and other dense fungible metals are rendered as a single cube of intrinsic substance volume, sized via cube-root scaling, against a cycling library of scale references from grain of sand to Empire State Building. Reverses the prior 10-stage progression. More honest, continuous (no stage transitions), roughly half the asset budget for the metals family.
- **Two visual vocabularies (2026-04-25):** Cubes for metals, vessels and packaging for fluids and bulk solids. The fuel pellet keeps its existing per-stage progression as the philosophical closer of the tour.
- **Scale reference library (2026-04-25):** New `src/lib/scale-references.json` with 19 entries spanning grain of sand to Empire State Building. Supersedes the per-commodity human silhouette and £1-coin components for cube-mode commodities; progression-mode commodities continue to use the standalone components for now.
- **Blender pipeline via Python (2026-04-25):** Asset rendering driven by versioned Python scripts in `scripts/blender/` invoked headless. The MCP server approach attempted in a prior session did not work out; Python scripts are the working route.
- **PBR material values authoritative in `assets/materials-reference.md` (2026-04-25):** The earlier SPEC.md table held design-time guesses (e.g. roughness 0.12 for gold) which did not survive iteration. The materials reference file holds iterated production values (gold roughness 0.20 with procedural variation 0.15–0.28).
- **Framework:** SvelteKit with `@sveltejs/adapter-static` (not `-cloudflare`); output dir is `build/` not `.svelte-kit/cloudflare`. Fully prerendered static site, no Workers needed.
- **Hosting:** Cloudflare Pages. Free tier.
- **BTC slider range:** 0.00000001 (1 sat) to 21,000,000 (total supply), logarithmic scale.
- **MVP commodity mix:** *Superseded 2026-05-04 by the four-commodity launch (gold, silver, Pu-238, cocaine). See "Four-commodity launch" entry above.* Earlier history retained: 5 core (gold, silver, copper, oil_brent, uranium_fuel_pellet) plus 2 optional (platinum, coffee), natgas removed 2026-04-29, wheat excluded but data fetched, no diamonds ever (non-fungible, no public spot price).
- **Uranium fuel pellet:** illustrative pricing at ~$20/pellet based on WNA composite fuel cost (~$3,000/kgU ÷ 7 g). Lives in `src/lib/illustrative-prices.json`, not `prices.json`. Source attribution mandatory.
- **MVP presets:** denominations + absurdity only (7 total). History and Entity categories deferred to Phase 3.5 and editorial content respectively.
- **BTC price source:** stooq (ticker `btcusd`) alongside the other commodities, not CoinGecko. One source, one parser, one failure mode. Stooq API key required since 2026-04-25.
- **Circulating supply:** computed from block height deterministically, no API dependency.
- **Data license:** CC-BY-4.0 for the prices dataset. MIT for the code.
- **Lightning tipjar:** Alby with custom domain at `tim@bitcoinweighin.com` via static `.well-known/lnurlp` file. Xverse remains separate for Runes/Ordinals/parasite.wtf rewards. Copy: *"Tips via Lightning: tim@bitcoinweighin.com. Plug the amount into the slider to see what you just sent."*

## Open threads

- Cocaine pricing source — illustrative figure for `src/lib/illustrative-prices.json` lands in Stage 5 with the still asset. Working assumption: composite of DEA / UNODC / open-source dark-web market scrapes weighted toward US street wholesale price per gram. Source list and exact figure to be confirmed before launch.
- Pu-238 melt-threshold values — "would melt itself in reality" caption needs concrete mass thresholds (function of mass × surface-area-to-volume, geometry-corrected). Lands in Stage 6 with the glow-and-audio implementation.
- Cocaine still asset — forensic-evidence-room still needs authoring (clinical, evidential, lab-tagged register). Placeholder until authored. Stage 5 target.
- Pu-238 cube sprite + glow shader — cube authored via existing Blender pipeline; the glow overlay is new. Implementation route (CSS filter vs. WebGL vs. layered sprite) to be decided in Stage 6.
- Mobile scrubber precision — 13 years of daily data can't be dragged accurately on a ~400px timeline. Dual-range design (coarse year + fine day) likely required.
- Incorporation — stay as sole trader for now; UK Ltd only if project clears ~£2-3k/month; offshore structures deferred until relocation. Good record-keeping from day one via separate business bank account.
- Newsletter — *The Weigh-In* as working name; tool and newsletter share brand. Reserve Buttondown/Beehiiv name soon.

### Deferred from MVP

The following commodities have schema entries in `src/lib/commodities.ts` flagged `mvpLaunch: false` (the field itself lands in Stage 2). They re-enter post-launch as the four-commodity render pipeline stabilises:

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
| Custom domain mapping | Not yet configured |
| Lightning address | Not yet set up (Phase 4 task) |
| Newsletter platform | Not yet registered (Phase 4 task) |
| Analytics | Not yet wired (Phase 4 task) |

## Recent session highlights

- **April 19:** Initial spec drafted across extensive conversation. Name chosen (Bitcoin Weigh-In, convergent with user's independent thinking). Domain registered.
- **April 19-20:** Phase 0 complete. Data pipeline shipped, 18/18 tests passing.
- **April 20:** Phase 1 complete. Staging URL live. MVP preset mix revised to remove broken History and stale Entity categories.
- **April 24:** Renderer update landed: dollar readout promoted to primary UI, readout strip wired as continuity signal, schema extended with `renderMode` and `projection` fields. 10-stage gold progression authored against stub sprites.
- **April 25 (data):** Stooq auth fix — silent forward-fill diagnosed and resolved, `health.json` and workflow guards improved.
- **April 25 (cube-mode pivot):** 10-stage gold progression and tile-mode for pallets reversed. Gold migrated to single-cube + cycling-reference rendering. Reference library introduced (19 entries). Python-driven Blender pipeline established and committed (it had been gitignored, losing the prior session's work). Gold cube sprite + shadow rendered. PhysicalRep refactored to a renderStyle dispatcher.
- **May 4 (marathon-session spec sync):** Four-commodity-launch pivot committed across `DECISIONS.md`, `SPEC.md`, and this file. Launch set is gold, silver, Pu-238, cocaine in locked render order. Cycling 20-entry scale-reference library replaced with universal Shiba on cube panels (gold/silver/Pu-238). Cocaine reverts to forensic-still + dynamic readout (no dog, no anchors). Pu-238 added with cube + blackbody glow + opt-in Geiger crackle (`?audio=on`). US-primacy locked: dollars and imperial as defaults. Stage 1 of `docs/handoff/` complete; no code edits this stage. Stages 2–7 implement.
