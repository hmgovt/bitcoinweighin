# Stage 7 — Tests, regression, and sign-off

*Read `00-OVERVIEW.md` first. Stages 1–6 must be confirmed complete.*

This is the closing stage. Coverage hardens, regression baselines verify, and a final report goes back to the human reviewer. **No new features in this stage** — anything that would feel like new feature work is a flag, not a quiet addition.

---

## Test coverage

### Unit tests (Vitest)

Add or verify coverage for:

- **`computeViewportMetres()`** at slider extremes for cube mode (every cube-mode commodity at 1 sat, 1 BTC, 21M BTC)
- **Cube edge derivation** — `cbrt(volumeCm3) * 10` correctness across density values 10.49 (silver), 19.30 (gold), 19.80 (Pu-238)
- **`massToColorTemp()`** at boundary masses (0.5 g, 5 g, 50 g, 500 g, 5 kg, 50 kg, 500 kg) — assert monotonic increase, clamp at 1
- **`massToIntensity()`** at boundary masses — assert monotonic increase, faster ramp than colour temp, clamp at 1
- **`interpolateColor()`** at canonical hue positions (0, 0.15, 0.30, 0.50, 0.70, 0.85, 1.0) — assert exact match at stops, sensible interpolation between
- **`computeGlowParams()`** asserts warning caption fires at exactly 1 kg, persists above
- **`denomination()`** for cocaine at boundary masses (0.030 g, 1 g, 1 kg, 1000 kg, 100,000 kg, 2,250,000 kg, 22,500,000 kg)
- **`pu238Fact()`** at boundary masses (0.5 g, 5 g, 25 g, 100 g, 500 g, 2,500 g, 7,500 g, 25,000 g, 100,000 g)
- **`<QuantityAnchorCard />` proximity matching** — within ±10% selects correctly; ±11% misses; equal-priority ties resolved by ascending mass
- **`GeigerEngine.setMass()`** computes correct `currentRate` at canonical masses; caps at 1000/sec; sets rate to zero below 1 g
- **`GeigerEngine` lifecycle** — start/stop on `setEnabled`, `setInViewport`, mass-below-threshold transitions; assert no leaked timers
- **Imperial / metric formatting helpers** — verify `formatMass()` and `formatLength()` default to imperial unless `unit=metric` is set in URL state
- **URL state round-trip for `?audio=on`/`?audio=off`** — assert hydrates Pu-238 audio toggle correctly

### Visual regression (Playwright)

Baselines committed across the four launch commodities:

- **Gold:** 5 baselines at 1 sat, 1 BTC, 21 BTC, 1M BTC, 21M BTC
- **Silver:** 5 baselines at 1 sat, 1 BTC, 21 BTC, 1M BTC, 21M BTC
- **Cocaine:** 5 baselines at 1 sat, 0.001 BTC, 1 BTC, 100 BTC, 21M BTC
- **Pu-238:** 10 baselines at 0.001 BTC, 0.01 BTC, 0.1 BTC, 1 BTC, 10 BTC, 100 BTC, 280 BTC (Voyager), 625 BTC (critical mass), 1000 BTC, 21M BTC — all with audio off

Total: 25 baselines. These are committed to the repo and Playwright fails the build on diff.

### Audio integration test (separate from visual regression)

- At Pu-238 slider position 1 BTC with audio enabled, instrument the `geiger:click` CustomEvent and measure click count over a 5-second window. Assert count is within ±10% of expected rate (~50 clicks/sec → 250 clicks ±25 over 5 sec).
- Assert audio cleanly stops on toggle off, panel scroll-out, mass below 1 g.
- Assert no audio context leak on repeated toggle.

### Performance — Lighthouse mobile

Verify ≥ 85 on mobile. The launch target is 90 (per SPEC.md), but full launch tuning is Phase 4 — 85 is the bar for this session's sign-off. If the score drops below 85, surface in the report and recommend tuning before launch.

### URL state round-trip

Verify the following hydrate cleanly and reproduce the visual state on reload:

- `?btc=1` (default date)
- `?btc=1&date=2026-04-19`
- `?btc=21000000` (market cap)
- `?btc=0.00000001` (1 sat)
- `?btc=1&unit=metric` (verify metric override works)
- `?btc=1&audio=on` (verify Pu-238 Geiger toggle hydrates enabled)
- `?btc=1&audio=off` (verify default-off explicit state)

### Console hygiene

- No errors at any slider position across the four commodities
- No React/Svelte hydration warnings
- No 404s for sprites that should exist (placeholders are fine and expected for missing assets)

---

## Final report

When all tests pass and regression baselines are committed, write a closing report directly back to the human reviewer covering:

### 1. Pivots landed

Confirm each of the four locked pivots from `00-OVERVIEW.md` has shipped:
- [ ] Four-commodity launch (gold, silver, cocaine, Pu-238) with `mvpLaunch` flag gating render loop
- [ ] Universal Shiba on cube-mode panels; cocaine as single editorial-still exception
- [ ] Two render styles only (cube, still-with-readout); Pu-238 cube glow as cube-renderer property
- [ ] US-primacy locked across the site (imperial primary, metric opt-in)

### 2. Spec deviations

Any place where the spec drafted in this handoff didn't survive contact with implementation. For each: what changed, why, what was committed instead. The bar isn't "no deviations" — it's "no silent deviations."

### 3. Outstanding asset gaps

For each missing asset:
- File path expected
- Whether a placeholder is currently rendering in its place
- Visual impact at the canonical slider positions
- Suggested next step (Blender pipeline, outsource, defer)

Likely list:
- Shiba sprite (used on three of four panels)
- Pu-238 metal cube sprite (cube-mode commodity)
- Cocaine forensic-lab still (entire panel hinges on it)
- Possibly: gold and silver cube sprites if cube-mode wasn't fully assetised before this session

### 4. Visual quality / brand-voice / audio concerns

Anywhere a panel reads as off-brand, off-voice, or visually weak at any canonical slider position. Examples worth flagging:
- Cocaine readout at 1 sat (the "0 lines" question from Stage 5)
- Pu-238 glow on a placeholder cube (does it work, or does it need the real metallic cube to read correctly?)
- Whether the two-channel glow (intensity + colour temperature) reads as physical incandescence rather than designed gradient at the canonical positions
- Geiger crackle calibration — does the SAMPLE_RATIO produce audio that's "musical, recognisable, not annoying" at 1 g, 100 g, 10 kg?
- Geiger visual indicator — does the pulse stay distinct at low rates and blur into steady glow at high rates?
- Y-axis label formatting at extreme scales (mm at 1 sat, km at market cap)
- Quantity-anchor card positioning when readout is already busy
- Audio toggle button affordance — is it clear it's local to the Pu-238 panel, not global?
- Any layout breakage on mobile widths

### 5. Suggested next-session focus

One paragraph. What's the highest-value next session — Phase 3 scrubber, Phase 3.5 entity holdings, asset production for the missing sprites, methodology page authoring, something else surfaced during this session? The recommendation is the human reviewer's call, but a fresh perspective from inside the implementation is useful.

### 6. Things deliberately not touched

Confirm none of the following were modified in this session (per `00-OVERVIEW.md` scope guard):
- The date scrubber
- Entity holdings automation
- OG image generation
- Methodology page content
- Lightning tipjar wiring
- Three.js hero scenes
- Affiliate links
- Newsletter capture
- Re-enabling deferred commodities

If any of these *were* touched, that's a flag — surface explicitly.

---

## Done when

- All unit tests pass (`npm run test`)
- All visual regression baselines committed and Playwright passing
- Lighthouse mobile ≥ 85
- URL state round-trip verified at the listed positions
- No console errors across all four commodities at all canonical slider positions
- Final report delivered with all six sections populated
- Conventional commit on the report itself: `docs: close marathon session report 2026-05-04`

Then stop. Don't drift into Phase 3, Phase 3.5, or asset production — those are separate sessions.

**This is the last stage. Hand back to the human reviewer with the final report.**
