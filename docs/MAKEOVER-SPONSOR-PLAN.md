# Bitcoin Weigh-In — Makeover & Sponsorship Plan

*Written 10 June 2026. Concept doc — nothing here is committed work. Companion specs: `handoff/10-scale-band-continuum.md` (renderer), `handoff/11-consequence-layer.md` (copy layer), `prototypes/ar-cube.html` (AR proof of concept).*

## Thesis

The site's asset is a single honest mechanic: true-scale purchasing power, daily, shareable by URL. The makeover does not add features for their own sake — it puts that mechanic in the first viewport, gives people a reason to come back daily, and gives sponsors clean surfaces that don't touch the editorial honesty (which is the thing being sponsored).

## 1. Hero-first restructure

Currently the page opens on controls. It should open on a *result*.

First viewport: today's date, one rendered gold cube at today's 1 BTC size against its band reference, one line — "1 bitcoin weighs in at **N oz of gold** today" — and the consequence line under it. Slider and preset bar directly below the fold line, everything else as now. The visitor should understand the entire site before touching anything. (Gold already renders eagerly for LCP; this is a reordering, not a re-architecture.)

## 2. The habit loop — "Today's Weigh-In"

The bot already computes daily deltas (`scripts/bot/deltas.ts`). Surface the same numbers on-site as a thin strip under the hero: "Overnight: +14 g gold · −0.3 kg silver · +2 g Pu-238." Green/red, tabular figures, dry. This converts a one-visit curiosity into a checkable daily number — the property sponsors actually pay for is the *return visit*, and right now the site has no reason to give one.

Milestone events compound this: threshold crossings are postable moments ("1 BTC's gold cube just passed baseball size"; "a whole-coin weigh-in now out-lifts the NIOSH limit"). The band boundaries from Stage 10 and the consequence thresholds from Stage 11 give the bot a calendar of events for free — detection is a comparison against yesterday's values, already in hand.

## 3. Personal hook — "Weigh your stack"

A sats/BTC input that is just a styled shortcut to the existing slider + URL state. Entirely client-side, nothing stored, nothing sent — say so under the input, because the privacy stance is a feature for this audience. Every stack URL is a share. This is the cheapest feature on this list and probably the most-used.

## 4. AR — the press hook

"Put 1 BTC of gold on your kitchen table." `@google/model-viewer` is already a dependency; the cube is parametric. See `prototypes/ar-cube.html`. AR placement of a *correctly sized* gold cube in your own room is the strongest possible answer to "realistic presence" — it isn't simulated presence — and it is the line every journalist will lead with. Ship behind a small "View in your room" button on cube panels. (iOS Quick Look needs USDZ files — pre-generated size ladder; noted in the prototype. Android/WebXR works from the parametric GLB directly.)

## 5. The embeddable widget — the actual sponsor magnet

A single iframe embed: live cube, today's figure, slider optional, "bitcoinweighin.com" attribution baked in. Newsletters, podcasts show-notes pages, and dashboards embed it; every embed is distribution and a backlink. Static-host friendly (it's the same prerendered code at an `/embed` route with a compact layout). An oEmbed endpoint later if uptake justifies it.

This is the sponsor magnet because it turns the site from a destination into infrastructure — "presented by [sponsor]" rides inside every embed.

## 6. Sponsorship surfaces

Principles first: no programmatic ads, no trackers (the privacy stance is locked), no sponsor influence on figures or copy, sponsorship always labelled. The honest register is the product; a sponsor buying adjacency to it must not be allowed to dilute it.

Surfaces, in order of build cost:

1. **Daily card sponsor line** — one line on the bot's X cards and OG images: "Today's Weigh-In is presented by —". Zero new build; the card pipeline exists.
2. **Newsletter (*The Weigh-In*)** — classic single-sponsor slot. The platform isn't registered yet (Phase 4); the sponsor model argues for moving that up.
3. **Panel presenting partner** — "Gold, weighed daily — presented by [bullion dealer]" on a commodity panel. Natural advertiser fit: bullion dealers, hardware wallets, exchanges, mining hosts. One panel, one sponsor, never inside the readout.
4. **Embed sponsor line** — rides the widget (see 5).

What sponsors will ask for and the answer: audience numbers (Plausible/Umami public dashboard — analytics is currently unwired, Phase 4; it becomes a prerequisite for any sponsor conversation), and click attribution (UTM on the single sponsor link; nothing more invasive).

No rate guidance here — that's a market conversation once there's a traffic baseline, not a figure to invent.

## 7. Sequencing

1. Hero restructure + daily delta strip (small, immediate, no new data).
2. Weigh-your-stack input (trivial).
3. Consequence layer (Stage 11 — small).
4. Scale-band continuum (Stage 10 — the big renderer job; the makeover *looks* finished when this lands).
5. AR button (prototype → production; USDZ ladder for iOS).
6. Embed route, then sponsor surfaces in cost order — gated on analytics being live so there's something to sell with.

Launch plan (HN Show, crypto X, r/bitcoin, r/dataisbeautiful) stands; AR and the daily delta give the posts their hook.

## Open items

- Newsletter platform registration (name reservation flagged since May).
- Analytics choice + public dashboard — now sponsor-critical, not just nice-to-have.
- Sponsor outreach list — needs your call on which categories are acceptable (bullion and hardware wallets feel on-brand; anything yield/leverage-flavoured probably isn't).
- Whether the embed ships at launch or fast-follows.
