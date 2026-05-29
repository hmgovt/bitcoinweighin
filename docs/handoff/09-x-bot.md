# Handoff 09 — X (Twitter) Bot

*An automated account that posts regular, share-worthy updates positioning
@bitcoinweighin as a must-follow. Built on the existing GitHub Actions + headless-capture
rails. No new infrastructure.*

---

## Strategic premise — why anyone follows this

The moat is **visceral tangibility**, not price. Thousands of bots post "BTC $X, +Y%" —
that is noise and nobody shares it. This account's edge is the site's whole thesis:
translating an abstract number into a physical object you can picture and weigh.

> "1 BTC today = a 29.9mm gold cube. Fits in your palm. Weighs 1.14 lb."

That is a screenshot people send to a friend. Every decision below serves shareability:

- **The image is the share unit; the caption is the hook.** Never post text-only.
- **Reframe, don't report.** Not "BTC +3% today" — "BTC just gained a Shiba Inu's weight
  in gold since this morning."
- **Quality cadence beats volume.** One strong scheduled post/day + opportunistic event
  posts. A must-follow posts less, but every post earns the follow.
- **Voice = deadpan weights-&-measures authority.** Precise numbers, no hype, no rockets.
  Letting the absurd physicality speak is what makes it shareable *outside* the crypto bubble.

---

## Decisions locked

- **X API tier:** paid media upload (cheap, prepaid). Uploaded images are in scope; the
  OG-image link card (Handoff 08A) remains the graceful fallback and is good practice regardless.
- **Infra:** reuse GitHub Actions, sibling workflow to `daily-update.yml`. Keys as repo secrets.
- **Cadence:** both — one scheduled daily post + event-triggered posts (within a monthly budget guard).

---

## Architecture

```
.github/workflows/bot.yml   (cron + workflow_dispatch, runs AFTER the daily data update)
   └─ scripts/bot/run.ts
        1. load data      → static/prices-latest.json, src/lib/entity-holdings.json,
                             src/lib/events.json (anchor events)
        2. pick content   → content engine: weekday pillar + event triggers + budget guard + dedup
        3. render image   → scripts/bot/make-card.ts (reuses make-gold-video capture)
        4. compose caption→ voice templates + computed readouts + deep link
        5. post           → scripts/bot/post.ts  (twitter-api-v2, OAuth 1.0a user context)
        6. record state   → data/bot-state.json  (committed back, like prices.ndjson)
```

Separate workflow from `daily-update.yml` so a bot failure never blocks the price commit.

**New repo secrets:** `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`.

---

## READ FIRST — before writing code, read and summarise back

1. `scripts/make-gold-video.ts` — the capture functions to reuse (`waitForReady`,
   `scrollToGold`, `captureFrame`, overlay injection). The bot card generator is a
   single-frame subset of this.
2. `src/lib/stores/url.ts` — exact URL param parsing. **Deep links are load-bearing for
   the bot (and OG images and the share button). See "Known issue" below — verify deep-link
   hydration is correct before relying on it.**
3. `src/lib/commodities.ts` — commodity catalogue, density/unit-mass constants, which
   commodities are in the render loop (gold, silver, platinum, copper, brent, wheat, coffee,
   plus illustrative pu238 + cocaine).
4. `src/lib/entity-holdings.json` — entity slugs, btc amounts, asOf dates (BlackRock,
   El Salvador, US Gov, SpaceX, Pizza Day, etc.).
5. `src/lib/prices.ts` — `commodityUnitsForBtc`-style computation (USD value → commodity units).
6. `static/prices-latest.json` / `static/meta.json` — the artifacts the bot reads for today's numbers.

Tell me: (a) which capture helpers can be imported vs. copied, (b) the exact deep-link param
set that produces a correct rendered state (post-fix), (c) the schema of prices-latest.json,
(d) whether events.json exists or only the fallback list in make-gold-video.ts.

---

## ⚠️ Known issue — deep-link hydration (investigate + fix first)

Observed: loading `https://bitcoinweighin.com/?btc=1000&commodity=gold` did **not** apply
btc=1000; the URL normalised to `?date=<latest>` only. The deep link is a prerequisite for
the bot, OG images, and the share button, so this must be diagnosed and fixed before the bot
relies on `?btc=` / `?commodity=` links. Candidate causes to rule out: (a) a slider/component
writing its default `btc=1` to the store on mount, after `hydrateFromUrl`, clobbering the
hydrated value (and `btc===1` is then omitted from the pushed URL); (b) the deployed
production build predating current `url.ts`; (c) `scrollToCommodity` not being a push-tracked
store. See investigation notes in the working session.

---

## Content engine — weekday pillar rotation

One scheduled post/day so it never reads like a ticker:

| Day | Pillar | Example |
|-----|--------|---------|
| Mon | Tangible reframe | "1 BTC today = a 29.9mm gold cube. Fits in your palm, weighs 1.14 lb." |
| Tue | Entity holdings | "BlackRock's IBIT holds 811,291 BTC — [X] tonnes of gold, [Y] bars stacked [Z] m high." |
| Wed | Weird commodity | rotate novelty assets: glowing pu238 cube, cocaine, coffee, brent oil. |
| Thu | On this day | "5 yrs ago today 1 BTC bought a marble of gold. Today: a dog-sized block." |
| Fri | Milestone watch | nearest round number being approached. |
| Sat/Sun | Best-of / question hook | lighter, shareable. |

**Event triggers** (checked every run; post in addition to the daily, within budget):
- BTC daily move ≥ ±7% → physical reframe of the delta.
- Entity holdings cross a round number (holdings sync already runs in `daily-update.yml`).
- Price crosses a psychological level (new ATH, $X0k).
- An `events.json` anchor date == today.

**State & guards** — `data/bot-state.json`, committed back by the workflow:
```json
{ "postsThisMonth": 0, "monthKey": "2026-05", "lastPillar": "tangible",
  "postedMilestones": ["blackrock-800k", "btc-100k"], "lastEventHash": "..." }
```
- Hard monthly budget guard (e.g. 400) regardless of tier headroom.
- Milestone dedup so a crossed threshold posts once.

---

## Image generation — `scripts/bot/make-card.ts`

Thin reuse of `make-gold-video.ts`: launch chromium, `goto(?btc=&commodity=&date=)`,
`waitForReady`, `scrollToGold`, optional overlay (date chip + caption card), single
`page.screenshot`. Output one PNG at **1200×675 (16:9)** for X. No ffmpeg. Params:
`btc`, `commodity`, `date`.

---

## Caption — voice and the one rule

**Voice:** deadpan weights-&-measures authority. Precise numbers, no hype, no
rockets/lambos/"to the moon". Let the absurd physicality carry it — this is what travels
outside the crypto bubble.

**Rule: reframe, don't report.** Always the physical translation, never a bare price/percent.
Per-pillar templates with computed readouts injected, lightly randomised so posts aren't
stamped. Always end with the deep link.

---

## Posting — `scripts/bot/post.ts`

`twitter-api-v2`, OAuth 1.0a user context. Media upload then tweet. Support `--dry-run`
(compose + render + log, no post) so the workflow and a week of drafts can be reviewed
before going live.

---

## Workflow — `.github/workflows/bot.yml`

- `schedule:` daily at a peak ET hour (e.g. `0 14 * * *` ≈ 10am ET), after the data update.
- `workflow_dispatch:` with a `dry_run` boolean input for manual testing.
- Commits `data/bot-state.json` back at the end.

---

## Build order

1. **Fix deep-link hydration** (Known issue above). Gate for everything that uses `?btc=`/`?commodity=`.
2. Create X dev app, confirm media-upload works, store keys as secrets.
3. (Recommended) Dynamic OG images — Handoff 08A — as the link-card fallback.
4. `make-card.ts` — produce a correct PNG locally.
5. `post.ts --dry-run`, then one manual live post to confirm auth + media.
6. Content engine + `bot-state.json` + budget guard + dedup.
7. `bot.yml` on dispatch-only / dry-run; review a week of generated drafts.
8. Flip to scheduled live posting.

---

## Measuring must-follow / must-share

Free-tier API can't read metrics, so track manually: shares/retweets per post (the real
signal), follower-growth slope, and which pillar drives the most shares. After ~3 weeks,
weight the rotation toward winners.

---

## Scope guard

Do NOT modify the commodity renderers, the data pipeline, or the site's visual design.
The bot is: new scripts under `scripts/bot/`, a new workflow, a new state file, and the
deep-link hydration fix. The fix is the only change to existing app code.
