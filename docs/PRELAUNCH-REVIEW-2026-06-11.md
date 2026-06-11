# Pre-launch review — 11 June 2026

*Scope: preset bar, commodity/viewport arrangement, methodology/data/commodity pages, SEO. Builds on `AUDIT-2026-06-09.md` and `SEO-AUDIT-2026-06-10.md` rather than repeating them. Assumes the live-scene direction (prototypes/live-scene.html) is going to production.*

## 1. Preset bar — clearer, tidier, and one missed trick

The implementation is clean (one component, one data source, URL-synced). The problems are presentational and conceptual:

- **Three categories flattened into one row.** "1 BTC" (denomination), "US Government" (entity), "Total supply" (absurdity) read as the same kind of thing. The 2026-05-04 MVP decision was denominations + absurdity (7 pills); the current 10 include entities that were meant to wait for Phase 3.5. Either re-defer the entities or visually group: denominations first, a thin divider, entities (with their as-of dates), then the absurdity pair.
- **Subscript noise.** Every pill carries a two-line BTC-figure + date subscript. The as-of date only carries meaning for entities (holdings drift); for "🍕 10,000" it's clutter. Keep subscripts on entity pills only; move the rest to `title`/tooltip.
- **Wrapping.** `flex-wrap` + `justify-content: flex-end` gives a ragged three-row block in the header at mobile widths. Better: single row, `overflow-x: auto` with scroll-snap and edge-fade — the standard pill-bar pattern, tidier at every width.
- **Semantics.** It's a value selector, not ten independent buttons: `role="radiogroup"` + `aria-checked` on pills.
- **The missed trick (live-scene world):** a preset click should *tween* the slider to its value rather than jump. The camera dolly then plays the size change as a move — clicking "Satoshi" becomes a cinematic beat for free. One easing function in the URL store.

## 2. Arrangement of commodities and viewports

The current page stacks four independent viewport sections (gold, silver, Pu-238, cocaine) plus Hashweight and BitCube panels — a long scroll where each section repeats the same furniture. Under the live-scene direction this arrangement is not just sub-optimal, it's unviable: four stacked WebGL scenes means four GL contexts, four model loads, and a mobile GPU on its knees.

The prototype already demonstrates the answer: **one stage, commodity tabs** (Au/Ag/Pu). Recommended page shape:

1. **Hero: the live stage** — one WebGL scene, commodity tabs, slider + presets directly beneath. Gold default; `?commodity=` and `/btc/*` deep links select the tab. One scene to polish, one LCP poster to bake, the wow above the fold.
2. **Cocaine** keeps its still-with-readout panel below (it never had a viewport; unchanged).
3. **Hashweight panel** stays as is.
4. **Long-form SEO section + FAQ** below, unchanged — this is doing real indexing work (per the SEO audit) and must survive the redesign.

This collapses page length, halves the furniture, and matches how the prototype already feels. The locked render order (gold, silver, Pu-238, cocaine) survives as tab order. Keep the sprite renderer as the no-WebGL/reduced-motion fallback inside the same layout.

## 3. Methodology, data, and commodity pages

Substance is strong on all three (the audits rate the content well). Improvements, in value order:

- **Cross-link the spokes** (SEO audit A2): `/data` and `/methodology` link to zero commodity or snapshot pages; commodity pages don't link to snapshots. Add a small "explore" footer to all three page types — commodity ↔ relevant snapshot years, data → the pages that visualise each column. Cheapest relevance signal available.
- **OG/Twitter tags on `/data` and `/methodology`** (M2): the dataset page is the most linkable page on the site and currently shares as a bare text card. The OG image endpoint already exists; snapshot pages should pass their year-end date for a period-correct card.
- **Methodology gains a section** when the live scene ships: camera model, staging honesty (foreground dog + real perspective), and the PuO₂ density change (11.5 g/cm³, with source) — which also needs `commodities.ts` + DECISIONS.md updates. The site's credibility rests on the methodology page answering "is this honest?" before anyone asks.
- **Commodity pages get the live scene later, not at launch.** They currently work as static answer pages (answer in the first sentence, daily re-bake). Don't gate their SEO value on WebGL; add a poster frame + "open in the visualiser" link first, embed the scene as a fast-follow.
- **Oil decision** (M3): the homepage title/description promise oil; no oil page exists. Either ship `/btc/oil` (data exists back to 2013; `commodity-content.ts` takes new entries cheaply) or cut the word from the three prominent strings.

## 4. SEO

Yesterday's audit (`SEO-AUDIT-2026-06-10.md`) stands: **on-page B, infrastructure D**. Nothing in the live-scene work changes its conclusions, and one of its findings becomes a constraint on the redesign:

- **Constraint for the overhaul:** the current SEO strength is fully-prerendered HTML with live numbers and a fast LCP. The live scene must hydrate *on top of* a prerendered poster + readout, never replace it. If the redesign ships a black canvas to crawlers, it undoes the best work on the site.
- **The blockers are infrastructure, not content** — in order: (1) Search Console + Bing verification and sitemap submission (the site appears never to have been submitted at all); (2) 301 www → apex (www currently serves a full duplicate site); (3) real 404s (`+error.svelte` + `fallback` config — every typo URL currently soft-404s as the homepage); (4) generate `sitemap.xml` at build time with `lastmod` (hand-maintained file will drift, and `/snapshot/2027` will prove it on New Year's Day); (5) fix the dated `og:url` on the homepage and add the missing OG tags (item 3 above).
- Items 1–3 are an afternoon and unblock everything else; nothing else in the audit matters until they're done.

## Suggested order of work

1. SEO infrastructure items 1–3 (independent of the redesign — do now).
2. Preset bar tidy (small, independent).
3. Live-scene production integration under the one-stage layout (the big job — needs its own handoff doc; the prototype is the spec's working reference).
4. Cross-links + OG coverage + methodology section (rides the redesign).
5. Oil decision.
