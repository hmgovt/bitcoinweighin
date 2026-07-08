# Handoff 13 — The Delight Pass

*Drafted 2026-07-08. A creative brief + execution plan for making bitcoinweighin.com more fun, easier to grip, and more gloriously executed — without ever betraying the voice. Written for a fresh execution session: every idea carries its hook points in the existing code, an effort tag (S/M/L), and an acceptance line.*

---

## 0. North star

The brand voice is **honest, precise, slightly dry** — and that is also the comedy engine. Everything below obeys one rule:

> **The fun must come from the physics, never be painted on top of it.**

The site already proves this works. Its best moments are all honesty played straight until it becomes funny: the meltdown warning ("Decay heat exceeds dissipation — would self-destruct in seconds"), the staging line ("Shiba standing nearer the camera — true perspective, not rescaled"), the tipjar loop ("Plug the amount into the slider to see what you just sent"). None of these are jokes. All of them land as jokes. That is the register every new feature must hit.

**Anti-goals — do not build:** confetti, streaks, points, badges-as-gamification, share nags, price predictions, countdown timers, anything that moves without the user asking, anything the methodology page couldn't defend with a straight face.

A second observation drives the priority order: **the project's single best writing currently ships only to X.** The bot's object-ladder captions ("In gold, 1 BTC put on a golf ball since yesterday's close") live in `scripts/bot/deltas.ts` + `objects.json` and never appear on the site. Several items below are really one move: *bring the bot's voice home.*

---

## 1. Tier 1 — The Big Five (flagships, in build order)

### 1.1 The Daily Delta line — the bot's voice on the homepage · **S**

One line under the hero readout, computed from the last two days of `prices.json`:

> *Since yesterday's close, 1 BTC put on a golf ball of gold (+46 g).*

- **What:** Port `computeDelta` from `scripts/bot/deltas.ts` and the ladders from `scripts/bot/objects.json` into a browser-safe module (natural first brick of the audit's shared-core task 2.1 — the maths is already pure). Render one caption for the *active hero tab's* commodity, updating when the tab changes. On `steady` days the existing flat-day copy already reads perfectly dry.
- **Why:** Daily-changing charm gives return visitors a reason; it's the bot's proven best material; near-zero new logic.
- **Hooks:** `src/lib/components/HeroStage.svelte` (below `ReadoutStrip`), full archive already loaded in `+page.svelte` onMount. Date-mode nicety: when scrubbing history, the line becomes "Since the previous close" for the scrubbed date — same function, different day pair.
- **Accept:** Caption on the page matches `npx tsx scripts/bot/deltas.ts` for the same day pair, for all four commodities.

### 1.2 "This much gold does not exist" — honesty at the extremes · **S**

The slider runs to 21M BTC. At the top end the site currently renders an enormous cube and says nothing. But past a knowable threshold the honest statement is glorious:

> *This much gold has never been mined. All gold ever: ~213,000 t — you are holding 4.7× that.*

- **What:** A threshold check in the readout: when `massKg` exceeds the largest quantity anchor (`all_gold_mined: 213,000,000 kg`, `all_silver_mined: 1,740,000,000 kg` — both already in `src/lib/quantity-anchors.json`), swap the anchor card for the impossibility line with the multiple. Pu-238 gets the same treatment earlier and funnier: world annual production is ~400 g/yr civilian (verify + cite on methodology) — *"At this mass you would own roughly 1,200 years of global production."* Cocaine: annual global production ~2,700 t (UNODC) — same construction.
- **Why:** This is the site's thesis — *the readout carries the truth at extremes* — executed at the exact place the current experience goes quiet. It's also the most screenshottable sentence on the site.
- **Hooks:** `QuantityAnchorCard.helpers.ts` (anchor selection already picks by mass band — add a terminal band), `Pu238FactCard.helpers.ts` (mirrors its existing critical-mass line). New illustrative facts need sources on `/methodology` per house rules.
- **Accept:** Slam slider to 21M on each tab → each shows a sourced impossibility line with the correct multiple; no anchor card pretends a real-world equivalent exists.

### 1.3 Ship the AR cube — "put 1 BTC of gold on your kitchen table" · **M**

`prototypes/ar-cube.html` already proves it: a parametric GLB built client-side at *exact* real-world edge, `<model-viewer ar ar-scale="fixed">` so it cannot be pinch-resized — honesty preserved in AR. `@google/model-viewer` is **already a production dependency** (Shiba easter egg), so the marginal cost is wiring, not platform.

- **What:** A quiet "View in your room" button on the three cube tabs (hidden where AR unsupported). Tapping builds the GLB at the current mass (port the prototype's `cubeEdgeMetres` — it already mirrors `src/lib/volume.ts`) with materials approximating `assets/materials-reference.md` values, and launches AR. Caption inside the readout: *"True scale. Resizing disabled on purpose."*
- **iOS path (documented in the prototype header):** Quick Look needs USDZ; pre-generate a log-spaced size ladder (~24 rungs/decade covers it), set `ios-src` to the nearest rung, state the exact edge in the caption. Ship Android/WebXR first if the ladder drags; the button can feature-detect.
- **Why:** Nobody else on the internet lets you stand a bitcoin's weight in gold on your table. It is the single most "gloriously executed" thing this codebase is already 80% of the way to.
- **Accept:** On an AR-capable Android phone, 1 BTC of gold places as a ~24 mm cube (at current ratio) that cannot be resized; readout edge matches the site's `ReadoutStrip` edge for the same state.

### 1.4 Time as a toy — the ▶ button and the Birthday Weigh-In · **M**

The dual-mode slider already scrubs history; two small builds turn it from a control into a story.

- **(a) Play button** next to the slider in date mode: sweeps the date from 2013 → today over ~12 s (log-eased, reusing the `tweenSceneBtc` machinery pattern in `+page.svelte`), cube breathing through thirteen years, then settles on today. Space bar pauses. `prefers-reduced-motion` → button hidden. The gold-history-video handoff (08) already establishes this is how the data wants to be seen; this is the interactive version.
- **(b) Birthday Weigh-In:** a small prompt near the date picker — *"What did 1 BTC weigh the day you were born?"* (dry footnote for pre-2013 birthdays: *"Dataset starts 2013. If you were born before that, congratulations on predating the dataset."*). Picking a date produces a **then-vs-now pair**: "2013-06-14: 3.1 g of gold. Today: 510 g." — and a share URL with `?date=` already supported end-to-end. This is the single best OG-card bait on the site and costs almost nothing: it is a framing device over existing state.
- **(c) Data-derived anchor events:** at build time, scan the archive for ratio milestones — the dates 1 BTC first crossed 1 ozt, 10 ozt, 100 ozt, 1 kg of gold (and silver equivalents) — and mark them as dots on the date-mode slider track with one-line captions on crossing. *Derived from the dataset, so zero editorial maintenance and no stale-fact risk.* (This quietly delivers the Phase 3 "anchor events" promise without hand-curated history.)
- **Hooks:** `+page.svelte` (slider modes, tween), `scripts/build-*` for the milestone scan (emit `static/milestones.json`), `ShareButton.svelte` for the then-vs-now text.
- **Accept:** ▶ sweeps smoothly at 60 fps with the readout ticking; a birthday deep-link renders the pair; milestone dots match hand-checked dataset dates.

### 1.5 The slider becomes an instrument — type-in, detents, keys · **M**

The slider is the product; right now it is drag-only. Three upgrades, all invisible until wanted:

- **(a) Click-to-type:** the big BTC readout becomes an input on click/tap. Accepts `0.5`, `50000 sats`, `$1M`, `$25,000` — dollar amounts convert through the day's price (the inverse readout the site never had; it makes the tool a two-way converter). Enter commits through the existing `setBtcFromSlider` path so URL state stays canonical.
- **(b) Detents:** magnetic snap (in slider space, ±4 steps) at 1 sat, 1k sats, 1M sats, 0.01, 0.1, 1, 6.25, 21M — with `navigator.vibrate(10)` on mobile where supported. The block-reward values are the dry wink.
- **(c) Keys:** ←/→ nudge log-space (native), Shift+←/→ jump a decade, `G/S/P/C` switch hero tabs, `T` toggles date mode (also fixes the dual-mode discoverability hole — the current dblclick affordance is hover-tooltip-only, which mobile and most desktop users never find). Add a visible, tiny `BTC | DATE` segmented control next to the slider; keep dblclick as the shortcut it already is.
- **Hooks:** `+page.svelte` controls panel; `stores/url.ts` untouched (all paths commit through existing setters).
- **Accept:** `$100,000` typed → slider, readout, URL all agree; arrow keys move value; every existing URL contract test still passes.

---

## 2. Tier 2 — Character work: the dog is an asset, spend it

The Shiba already has three easter-egg tricks (`play_dead`, `rollover`, `shake` — `LiveStage.svelte:379`). Small acting notes, big warmth:

- **2.1 Name the dog "Sat." · S** — One noun, three payoffs: the readout at exactly 1 sat gains the line *"1 sat. Also: one Sat."*; the staging honesty line becomes *"Sat is standing nearer the camera — true perspective, not rescaled"*; the methodology page gets a one-line cast credit (*"Scale reference: Sat, Shiba Inu, 40 cm at the withers, 9 kg. Constant."*). No new assets.
- **2.2 Gaze tracking. · S–M** — The dog's head bone aims at the cube's top vertex each frame (clamped to a natural range, lerped, disabled under reduced-motion). At dust scale the dog looks down its nose at the ground; at 21M it looks up at a wall. One quaternion per frame in the existing render loop; the model is already a rigged GLTF with an AnimationMixer. This is the highest-charm-per-line-of-code item in this document.
- **2.3 The respectful step. · M** — When the cube edge crosses the dog's height, Sat takes one step back (reuse the walk/staging machinery that already exists for the foreground `staged` state). Physics-honest body language.
- **2.4 Konami code → all three tricks in sequence. · S** — It's eight lines and the people who find it will screenshot it.

---

## 3. Tier 3 — "Your Share" (rescuing the orphan)

`BitCubePanel.svelte` (321 lines, nested supply cubes, "Your Share of the Supply") is **built, styled, and imported nowhere**. Entity holdings (incl. Satoshi's ~1.1M BTC with source) already ship in `entity-holdings.json`. One connective feature turns two orphans into a destination:

- **What:** Re-mount BitCubePanel below the Hashweight panel. Add a local-only "weigh your own stack" input above it — with the privacy line played absolutely straight, because it is *true and verifiable*: **"Your number never leaves this page. We're a static site; there is nowhere to send it."** Entering a stack personalises the inner cube, and one ranking line places you against the shipped entities: *"Your stack outweighs El Salvador."* / *"Satoshi outweighs you by 1,099,997 BTC. Most people."* Persist in `localStorage` only, never the URL.
- **Why:** The single most-asked crypto question is "how much is mine worth"; this answers the *better* question — "how much does mine weigh, and against whom" — without ever seeing the number.
- **Hooks:** `+page.svelte` (mount), `BitCubePanel.svelte` (accept an optional user amount), `holdings.ts` (entity compare).
- **Accept:** Stack entry renders instantly with no network request (verify in devtools); ranking line correct against `entity-holdings.json`; nothing written to URL. · **M**

---

## 4. Tier 4 — Share loops that compound

- **4.1 The Weigh-In Slip (receipt-style share card). · M** — Re-skin the OG card as a thermal receipt: monospace, itemised (`BTC … $ … Au … Ag … PuO₂ … date`), a barcode that is actually the share URL, and the footer line *"THANK YOU FOR WEIGHING IN"*. People screenshot receipts; it is the dry voice as a *visual*. Implement as `?style=receipt` in `functions/og-image.ts` (workers-og already renders HTML→image), used by the ShareButton; leave default OG style for organic link unfurls until the receipt proves itself.
- **4.2 Copy-as-text. · S** — A "copy" affordance next to share: `1 BTC = 510 g gold = 30.3 kg silver ($108,251 · 2026-07-08) bitcoinweighin.com/?btc=1`. Group chats are where this content actually travels; text beats cards there. Ten lines in `ShareButton.svelte` (clipboard path already exists).
- **4.3 Print-and-fold: the papercraft cube. · M** — For cube edges under ~180 mm, "Print at actual size" generates a fold-up cube net (SVG, mm-true — the CSS-mm plumbing already exists from the £1-coin era) with the readout printed on the faces: *"This cube = 1 BTC in gold · 2026-07-08 · 510 g if it were real."* Zero-tech shareable; every folded cube photographed next to a coffee mug is UGC the site never has to ask for. New route `/print` reading the same URL params.

---

## 5. Tier 5 — Systems polish

- **5.1 One sound system. · M** — Unify the existing Geiger synthesis (`GeigerEngine.ts`), ASIC hum (`AsicSoundEngine.ts`), and new micro-sounds (detent tick from §1.5b, a single soft scale-settle thunk when a preset tween lands) behind the one existing `?audio=on` store and a small speaker toggle in the header. Default off, reduced-motion-aware (the Geiger component already models this correctly — copy its gating). Position: instrument panel, not game SFX. Poisson clicks proved the house style; keep everything synthesised, nothing sampled.
- **5.2 Pu-238 wattage line. · S** — Pu-238's decay heat is ~0.57 W/g (verify + cite). One readout line: *"Decay heat: 285 W — about half a space heater, forever."* At RTG-relevant masses, the spacecraft framing the brand line already owns: *"Voyager's RTG launched with ~4.5 kg of this."* Hooks into `Pu238FactCard.helpers.ts` next to the melt commentary.
- **5.3 Snapshot pages get the ladder. · S–M** — `/snapshot/[year]` already computes yearly summaries (`summarizeYear`); add the year's biggest single-day move *in objects*: "Largest daily move of 2017: 1 BTC gained a bowling ball of silver (Dec 7)." Reuses the §1.1 module verbatim; gives thirteen static pages a reason to be screenshotted.
- **5.4 Hero tab → URL sync. · S** — Tab clicks currently don't write `?commodity=` (deliberate at the time; revisit). Syncing makes every tab state shareable and the OG pipeline already honours the param. Guard against scroll-jacking on load (the param currently also means "scroll to").

---

## 6. What NOT to do (calibrated restraint, recorded now)

- **No cocaine feature work.** The register there is a still image and a straight face; every idea above deliberately excludes it beyond the §1.2 honesty line. The restraint *is* the joke landing.
- **No leaderboards, no accounts, no cloud state.** "We're a static site; there is nowhere to send it" is a brand asset. Guard it.
- **No autoplaying sound or motion.** Everything above is opt-in and reduced-motion-gated, matching the Geiger/meltdown precedents.
- **No new WebGL scenes.** One context (handoff 12's inviolable) — AR runs in the OS viewer, not the page.
- **No AI-generated fact copy at runtime.** Every fact string ships reviewed, sourced, and static, per the illustrative-prices precedent.

## 7. Suggested execution order

| Order | Item | Effort | Why this order |
|---|---|---|---|
| 1 | 1.1 Daily Delta line | S | Biggest charm/effort ratio; creates the shared module 1.4c and 5.3 reuse |
| 2 | 1.2 Impossibility lines | S | Pure copy + threshold; instant screenshot fodder |
| 3 | 1.5 Instrument slider | M | Usability floor for everything else; fixes date-mode discoverability |
| 4 | 2.1 + 2.2 Sat + gaze | S+M | Character online before share loops amplify traffic |
| 5 | 1.4 Time toy | M | Rides the tween machinery; ships birthday cards |
| 6 | 4.1 + 4.2 Receipt + copy-text | M+S | Share loops after there's more to share |
| 7 | 1.3 AR cube | M | The glory feature; Android/WebXR first, USDZ ladder second |
| 8 | 3 Your Share | M | Rescues BitCubePanel; pairs with launch-week traffic |
| 9 | 5.x polish | S–M | Continuous |

*Prerequisite note: the audit's Milestone 0 (CI + drift tests, `AUDIT-2026-06-09.md`) should land before or alongside item 1 — §1.1 deliberately creates the shared pricing module the audit calls for, so build them as one motion, not two.*

---

*Every acceptance line above is testable without screenshots. When in doubt on any copy decision, re-read the meltdown warning and ask: would that sentence sit comfortably next to this one?*
