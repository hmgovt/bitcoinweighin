# Bitcoin Weigh-In — Project Status

*Last updated: 25 April 2026*

## What this is

A static site visualising what bitcoin's purchasing power looks like across physical commodities, with a 2013–present history scrubber. Domain: **bitcoinweighin.com**. Staging: **bitcoinweighin.pages.dev**.

## Current phase

**Phase 2b — Renderer integration in progress.** Renderer logic for scale mode, tile mode, reference system (coin, silhouette, comparison cards), and readout strip are implemented with stub sprites. Gold progression expanded to 10 stages. Dollar readout promoted to primary UI element. Waiting on real sprite production (separate asset session).

## Phases complete

**Phase 0 — Data pipeline.** Full daily commodity price history 2013-01-01 to present (4,857 days) from stooq (metals, agri, BTC) and FRED (oil, natural gas). BTC circulating supply computed deterministically from block-height/halving schedule. `prices.json` at 0.77 MB raw / 0.17 MB gzipped. 18 unit tests passing. GitHub Action daily cron configured. FRED_API_KEY set as repo secret.

**Phase 1 — Skeleton.** SvelteKit with `@sveltejs/adapter-static` deployed to Cloudflare Pages. Six commodity sections rendering as grey placeholder boxes with live mass/volume readouts. Logarithmic BTC slider (0.00000001 to 21,000,000), date picker, metric/imperial unit toggle, preset pill bar. URL state wired end-to-end. `illustrative-prices.json` loaded for uranium fuel pellet. Commodity catalogue, volume computation (intrinsic + visual), and preset resolvers all working.

**Phase 2b — Renderer logic (partial).** Gold progression expanded to 10 stages with stub sprites. Renderer components built: `PhysicalRep.svelte` (orchestrator), `SpriteStage.svelte` (scale + tile mode), `CoinReference.svelte` (£1 at 23.43mm, suppressible), `HumanSilhouette.svelte` (1.75m, threshold-gated), `ComparisonCard.svelte` (text-only, mass/volume lookup). `ReadoutStrip.svelte` with tabular-figures font and `countTemplate` rendering. Dollar readout promoted to primary UI element under slider (~2× type size, tabular-nums). `RenderStage` schema extended with `renderMode`, `projection`, `tileConfig`, `countTemplate`, `suppressCoinRef`. Tile-mode computation (`computeTileState`) with integer + fractional fill. 20 stub SVGs generated for gold (10 stages + 10 fill variants). All other commodities still use placeholder paths (renderer gracefully falls back).

## What's next

**Phase 2a — Asset production (gold).** Produce real gold sprites for 10 stages per the stub contract. Separate session per DECISIONS.md 2026-04-20 (Claude Code + Blender MCP first, hard deadline one weekend, fall back to outsource). Asset session receives its own handoff with stub contract and materials reference.

**Phase 2b — Renderer integration (remaining commodities).** Apply the same 10-stage pattern to silver, copper, oil, natgas, uranium. Each commodity gets its own stub set, then real assets. Gold pipeline must be proven first.

**Phase 3 — Scrubber and anchor events.** Timeline scrubber at bottom of viewport, play/pause/speed controls, anchor event dots with caption cards on crossing. Dual-range mobile design.

**Phase 3.5 — Entity holdings automation.** *(newly added, originally planned for Phase 6)* Build automated pipeline for entity preset holdings from CoinGecko `/companies/public_treasury/bitcoin` and bitcointreasuries.net scraping. Historical holdings by date so scrubber resolves entities as-of the scrubbed date. Re-enable entity presets that were deferred from MVP.

**Phase 4 — Polish and launch.** Methodology page, `/data` page with CC-BY dataset download, dynamic OG image generation via Cloudflare Workers, about page, email capture, Lightning tipjar at `tim@bitcoinweighin.com` via Alby + static `.well-known/lnurlp` file. Launch: HN Show, crypto Twitter, r/bitcoin, r/dataisbeautiful.

**Phase 5 (optional).** Three.js hero scenes for gold and oil. Subtle idle animation, not interactive.

**Phase 6 (post-launch, ongoing).** Curio cabinet Tier 3 commodities (U3O8 yellowcake, rhodium, osmium, saffron, tritium, californium-252). Affiliate integrations. Weigh-In newsletter cadence.

## Key decisions locked

- **Framework:** SvelteKit with `@sveltejs/adapter-static` (not `-cloudflare`); output dir is `build/` not `.svelte-kit/cloudflare`. Fully prerendered static site, no Workers needed.
- **Hosting:** Cloudflare Pages. Free tier.
- **BTC slider range:** 0.00000001 (1 sat) to 21,000,000 (total supply), logarithmic scale.
- **MVP commodity mix:** 6 core (gold, silver, copper, oil_brent, natgas, uranium_fuel_pellet) plus 2 optional (platinum, coffee). Wheat fetched in data but deliberately excluded from MVP rendering. No diamonds ever (non-fungible, no public spot price).
- **Uranium fuel pellet:** illustrative pricing at ~$20/pellet based on WNA composite fuel cost (~$3,000/kgU ÷ 7 g). Lives in `src/lib/illustrative-prices.json`, not `prices.json`. Source attribution mandatory.
- **Scale references:** £1 coin at actual physical size (CSS mm units) + 1.75 m human silhouette (shown only when commodity sprite >300 mm displayed) + text comparison cards for extreme scales (>5 m). No menagerie of mid-range reference objects.
- **Sprite production:** pre-rendered WebP at 2× density, no rotation, cube-root CSS scaling. Claude Code + Blender MCP as primary production route; £2-3k outsource as fallback.
- **MVP presets:** denominations + absurdity only (7 total). History and Entity categories deferred to Phase 3.5 and editorial content respectively.
- **BTC price source:** stooq (ticker `btcusd`) alongside the other commodities, not CoinGecko. One source, one parser, one failure mode.
- **Circulating supply:** computed from block height deterministically, no API dependency.
- **Data license:** CC-BY-4.0 for the prices dataset. MIT for the code.
- **Lightning tipjar:** Alby with custom domain at `tim@bitcoinweighin.com` via static `.well-known/lnurlp` file. Xverse remains separate for Runes/Ordinals/parasite.wtf rewards. Copy: *"Tips via Lightning: tim@bitcoinweighin.com. Plug the amount into the slider to see what you just sent."*

## Open threads

- Phase 2a execution route — attempt Claude Code + Blender MCP first; if quality doesn't reach portfolio bar after a weekend, switch to outsource. Hard deadline to avoid sinking time.
- Mobile scrubber precision — 13 years of daily data can't be dragged accurately on a ~400px timeline. Dual-range design (coarse year + fine day) likely required.
- Incorporation — stay as sole trader for now; UK Ltd only if project clears ~£2-3k/month; offshore structures deferred until relocation. Good record-keeping from day one via separate business bank account.
- Newsletter — *The Weigh-In* as working name; tool and newsletter share brand. Reserve Buttondown/Beehiiv name soon.
- Project migration from single chat to Claude Project — in progress; this status doc plus SPEC.md plus DECISIONS.md form the ongoing knowledge base.

## Infrastructure

| Item | Status |
|---|---|
| Domain `bitcoinweighin.com` | Registered |
| GitHub repo `hmgovt/bitcoinweighin` | Private, live |
| Cloudflare Pages project | Provisioned, deploying from `main` |
| FRED API key | Generated, stored in password manager, set as repo secret |
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
- **April 24:** Renderer update session. Gold progression redesigned from 6 to 10 stages. Tile-mode rendering for institutional scales. Scale + tile renderer components built with stub sprites. Readout strip promoted to primary continuity signal. Dollar readout promoted to primary UI element. All gold stages render end-to-end with stubs; real asset production is the next session.
- **April 25:** Data pipeline bugfix. Stooq started requiring an API key, which had been silently forward-filling all stooq sources for ~5 days. Added `STOOQ_API_KEY` to `.env`, GitHub secrets, the workflow yaml, and the URL construction in `fetchers.ts` (and `bootstrap.ts` for consistency). Extended `health.json` with `httpStatus`, `rowCount`, and redacted `url` per source so future failures surface their cause. Added a weekday guard so a fully-failed trading-day fetch exits non-zero rather than committing forward-filled data quietly.
