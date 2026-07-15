# Cash feature — closing verification report

*Read `14-cash.md` (design spec) and `docs/superpowers/plans/2026-07-11-cash-dollar-bill-stack.md` (22-task implementation plan) first.*

This is a closing verification pass on `feature/cash-dollar-bill-stack`, written for review before the branch ships. Tasks 1–19 of the implementation plan were already committed (26 commits) at the start of this session. This session closed out Tasks 20–22 and, during manual verification, found and fixed two real bugs that predated this session. **No new features were added** — everything below is either plan-mandated work or a bug fix surfaced by testing against the plan's own "Done when" criteria.

---

## 1. Tasks 20–22 completed this session

- **Task 20** — added the "Cash (derived, no API)" subsection to `/methodology`, documenting the BEP physical constants and the "priced exactly, not a market estimate" framing. Commit `c1348e3`.
- **Task 21** — added `cash` to `OG_COMMODITIES` in `functions/_lib.ts`. Before this, `/og-image?commodity=cash` silently fell back to rendering as **Gold** (confirmed via `functions/og-image.ts`'s `OG_COMMODITIES[id] ?? OG_COMMODITIES.gold` fallback). Commit `afcc219`.
- **Task 22** — full integration pass (below).

## 2. Bugs found and fixed during Task 22

Neither bug threw a console error or failed a unit test — both were only visible by actually driving the UI at the plan's own canonical positions, which is why they survived 19 prior tasks' worth of commits.

### 2a. Readout stuck on the tiered secondary line

`HeroStage.svelte` mounted `<BillStage noteCount={amount} />` and `<BillReadout noteCount={amount} />` as siblings, but never wired them together. `BillStage` owns `viewMode` internally as a `$bindable` prop (toggled on click/keyboard), but `HeroStage` never bound to it, so `BillReadout` was permanently stuck on its `viewMode` prop's default (`'tiered'`) — the 3D scene would visibly switch to the literal true-height column, but the readout's secondary line kept showing the tiered tier label and bundle-grid dimensions regardless.

Fix: lifted a `billViewMode` state into `HeroStage`, bound to `BillStage` (`bind:viewMode={billViewMode}`) and passed straight through to `BillReadout`. Commit `2685414`.

### 2b. Literal mode renders blank at realistic heights, not just the extreme tail

Verified via direct WebGL canvas `readPixels()` (not just screenshots — see §4 on a separate, unrelated screenshot-tool artifact encountered along the way) that the literal-mode stage went **fully blank** at two of the plan's five canonical positions: **100 BTC** (~700 m tall at today's price) and **21M BTC** (~145,000 km tall). This is not a niche edge case — 100 BTC is one of the five positions the plan's own Task 22 explicitly requires to "render coherently."

Root cause: literal mode's column height scales **linearly** with note count. Every other commodity on the site (gold, silver, Pu-238 cubes) scales as the **cube root** of value, so even at the 21M BTC ceiling their cube edges stay in the metres range (confirmed: gold's cube at 21M BTC is only ~10 m). Cash's literal-mode column has a fixed real-bill width (~6.6 cm) but unbounded height, and the scene's camera dollies back linearly with height to keep the whole column in frame (`framingDistance(dominant) ∝ dominant`, no cap — this works fine for the cube-root-scaled commodities because their dominant never gets extreme). Past roughly 35 m of height, the column's fixed width subtends under one screen pixel and the object is no longer rasterizable — confirmed empirically, not just estimated: the canvas centre pixel was genuinely `[0,0,0,0]` (not a screenshot glitch) at 100 BTC.

There is no width/height combination that keeps the full height *and* a legible width in frame simultaneously — this is a structural property of rendering a fixed-width column at arbitrary height, not a parameter-tuning bug.

Fix (commit `3a66ad2`): decoupled the value returned for **camera framing** from the true modelled height. Camera framing now holds at a small, fixed cap (`LITERAL_FRAMING_CAP_M = 15`) regardless of true height — the column's base stays clearly in frame, and the shaft recedes upward out of frame past that point, the same way a photograph of a very tall real building works. Separately, the **modelled geometry** itself is capped at `LITERAL_HEIGHT_RENDER_CAP_M = 10_000` (10 km) purely as a float32-precision safety net (world-space vertex coordinates at the uncapped ~1.45e8 m scale are large enough to lose meaningful precision in the GPU pipeline). `BillReadout`'s height figure and human-scale comparison line are computed independently, straight from the true uncapped `stackHeightMm()` — they were never affected by either bug and report the correct number throughout.

**This is a judgment call worth a second look, not just a mechanical fix.** The `15 m` framing cap was chosen so the most common demo position (1 BTC, ~7–12 m depending on live price) sits comfortably under it with headroom, while anything taller settles into "base in frame, shaft off the top" — I did not have a principled way to derive this number from the spec (which didn't anticipate the width/height tension at all) or from screen-pixel math without hardcoding a viewport-width assumption into a otherwise viewport-agnostic camera-maths module. Worth eyeballing at a few more intermediate positions (10 BTC, 1000 BTC) to confirm the recede-out-of-frame behavior reads as intentional rather than broken.

## 3. Verification performed

- `npx vitest run` — 232/232 passing, all 17 test files, both before and after every fix in this session.
- `npm run build` — clean, `/btc/cash` present in output, no new TypeScript or Svelte compiler errors (pre-existing compiler warnings in `CubeRenderer.svelte`/`ScaleReference.svelte`/`MiningGlobe.svelte` are unrelated to Cash and out of scope).
- Walked all five canonical positions (1 sat, 0.001 BTC, 1 BTC, 100 BTC, 21M BTC) via `?commodity=cash&btc=…` deep links, in **both** tiered and literal view modes, checking: note count, mass (kg/lb toggle), tier label / height+comparison secondary line, and zero console errors. All five now render coherently in both modes.
- Toggled tiered ↔ literal via both simulated click and confirmed the `aria-label` and visible hint text ("tap to see it as one column" / "tap to see it bundled") update correctly each time.
- Regression-checked Gold, Silver, and Plutonium-238 tabs at 1 BTC (Cocaine was checked at the 21M BTC extreme specifically, see below) — all render correctly, no console errors, Geiger toggle still present on Pu-238.
- Confirmed Cocaine's own extreme-scale ("production tier") readout at 21M BTC still renders correctly (its SVG-based renderer has no equivalent width/height tension, since it's flat and resolution-independent) — used this as the control to confirm the Cash blank-stage bug was Cash-specific, not a shared framing-math regression.
- Verified the og-image fix at the **logic layer**: imported `functions/_lib.ts` directly and confirmed `computeAmount`/`massGrams`/`formatHeadlineAmount` for the new `cash` entry produce correct, non-Gold-fallback figures (63,296 notes / 63.3 kg / 140 lb at 1 BTC and today's live price, using cash's own `#85bb65` accent). **Not verified**: the actual rendered PNG output, since this environment has no `wrangler`/Pages Functions runtime installed and no `wrangler.toml` configured — Task 22's suggested `npx wrangler pages dev` step was not runnable here. Worth a real request to `/og-image?btc=1&commodity=cash` once deployed or once wrangler is available locally.

## 4. Aside: a tooling artifact encountered mid-session (not a product bug)

Partway through verification, several browser-pane screenshots showed a large white/light-gray rectangle overlapping the top of the page, with content appearing genuinely blank. Direct DOM inspection (`document.elementFromPoint` + `getComputedStyle`) confirmed the actual background color underneath was correctly dark (`rgb(9,9,11)`) — this was a rendering artifact in the browser-preview tool's screenshot compositing, not a real product issue. Flagging only so a future session doesn't chase it: when a screenshot looks wrong, cross-check with `get_page_text`/DOM queries or (for WebGL specifically) direct `canvas.getContext('webgl').readPixels()` before concluding the app is actually broken. The literal-mode blank-stage bug in §2b was *confirmed* this way, precisely to rule out this same artifact.

## 5. Housekeeping

- Reverted an incidental `static/sitemap.xml` date-bump each time `npm run build` was run locally during verification (the build script regenerates `<lastmod>` to today's date) — not committed, since that's a deploy-time artifact, not a Cash-feature change.
- Two untracked files remain in the worktree, unchanged from before this session: `assets/blender/one_dollar_bill.glb` (the raw 804 KB Sketchfab source — the design spec itself flags this as carrying a **watermarked stock photo texture**, "not shippable... legally unwise to reproduce") and a scratch intermediate `_stripped.glb` from the compression pipeline. The final shipped `bill.glb` (watermark-free, procedural texture) is already committed. Whether to commit the raw source asset to the repo (private history still contains it either way once committed) is a licensing call for a human, not something touched here.

## 6. Suggested focus for the next reviewing pass

1. Sanity-eyeball the `LITERAL_FRAMING_CAP_M = 15` choice (§2b) at a couple of intermediate positions — does "base in frame, shaft recedes upward" read as intentional?
2. Confirm the actual `/og-image?commodity=cash` PNG once a wrangler-capable environment is available — the logic is verified but the rendered image was not visually inspected.
3. Decide on the raw watermarked source `.glb` — commit it, keep it local-only, or add an explicit gitignore rule so it stops showing as untracked noise.

---

## Done when (from the original plan, re-confirmed)

- [x] Cash tab renders coherently at all five canonical positions, in both view modes
- [x] Toggle between tiered and literal works via click and keyboard, at both low and high note counts
- [x] Note count, mass, height/grid-dimension readout, and human-scale comparison are correct against the physical constants
- [x] `/btc/cash` builds; poster renders without JS (unchanged this session, previously verified)
- [x] Homepage SEO card + methodology paragraph present
- [x] No console errors at any slider position in either view mode
- [ ] og-image logic fixed and unit-verified; rendered PNG not visually confirmed (no wrangler runtime available)

**Stop here — awaiting a second pass before this branch pushes or opens a PR.**
