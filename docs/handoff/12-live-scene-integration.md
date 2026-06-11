# Stage 12 — Live-scene production integration

*Read `00-OVERVIEW.md` and `10-shiba-scene-direction.md` first. The working reference is `prototypes/live-scene.html` — every camera, staging, material and glow decision in it was iterated and signed off in-session (2026-06-11). This stage ports it into the SvelteKit site as the single hero stage. Companion: `docs/PRELAUNCH-REVIEW-2026-06-11.md` §2 (the one-stage layout decision).*

## ROLE

You are replacing the four stacked sprite viewports with one real-time three.js stage at the top of the page: gold/silver/PuO₂ tabs, the rigged Shiba as scale actor, slider-driven camera choreography. The prototype is the spec — port its behaviour 1:1, don't redesign it. The work here is integration discipline: SEO-safe hydration, one WebGL context, fallbacks, asset compression, and tests around the maths.

## Hard constraints

- **The SEO moat is inviolable.** Every page keeps shipping fully-prerendered HTML with live numbers; the stage hydrates *on top of* a poster image and never replaces the readout text. A crawler (or JS-off visitor) sees exactly what it sees today. LCP target unchanged — the poster is the LCP element, preloaded as the gold sprite is now.
- **One WebGL context per page.** The stage is the only canvas. No per-commodity scenes.
- **Sprite renderer survives** as the dispatch fallback: no WebGL, `prefers-reduced-motion: reduce`, or context-loss → current `CubeRenderer` path renders instead. Same data, same honesty.
- **URL state contract untouched:** dual-mode slider (double-click BTC ↔ date), presets, `unit`, `currency`, `?commodity=` — all behave exactly as production does today. The stage is a consumer of `(commodity, amount)`, nothing more.
- **Cocaine untouched** (still-with-readout, no stage). **Hashweight panel untouched.**
- **Brand voice:** the PuO₂ clarification line renders persistently whenever the Pu tab is active, exactly as `brandVoiceClarification` mandates today.
- **Shiba model credit (CC-BY-4.0, mandatory):** the licence requires visible attribution. Add the verbatim credit line from `static/models/references/shiba_inu/license.txt` to the methodology/credits section. This is a licence obligation, not a courtesy — it ships with the first stage deploy.

## Page shape (per pre-launch review §2)

1. Hero: live stage + commodity tabs (Au/Ag/Pu, locked order) + readout strip + slider + preset bar.
2. Cocaine still panel.
3. Hashweight panel.
4. Long-form SEO section + FAQ (unchanged).

`/btc/{gold,silver,pu238}` deep links and `?commodity=` select the tab. Commodity pages themselves stay static answer pages with a poster + "open in the visualiser" link at launch; embedding the stage there is a fast-follow.

## Architecture

```
src/lib/scene/
  maths.ts        ← pure: cubeEdge, framing (dominant rule), camY cap,
                    aim blend, dog NDC unprojection, glow ramp. PORTED
                    VERBATIM from the prototype; unit-test these.
  materials.ts    ← gold/silver/PuO₂ materials, roughness-variation map,
                    makeGoldEnv softbox rig
  LiveStage.svelte ← client-only island: renderer, composer (bloom),
                    model load, easter egg, pointer handling
```

- **Hydration trigger:** first interaction (pointerdown/over on slider, tabs, presets) or `requestIdleCallback` after load — whichever first. Until then the poster sits in the stage slot at reserved height (no CLS).
- **Poster:** reuse the current gold cube + Shiba sprite composition as the poster at launch — zero LCP regression, no new asset. Optional later: bake per-commodity posters by screenshotting the stage in CI (Playwright is already a dependency for bot cards).
- **Asset pipeline:** compress the Shiba (16 MB source → target ≤3 MB) with `@gltf-transform/cli` (draco or meshopt + texture resize to 1k). New script `scripts/compress-shiba.ts`; output `static/models/references/shiba_inu/shiba.glb`; source files stay for re-export. The model lazy-loads with the stage, never on first paint.
- **Renderer hygiene:** DPR capped at 2 (as prototype); pause the render loop when the tab is hidden or the stage is out of viewport (IntersectionObserver); `webglcontextlost` → swap to sprite fallback with the current state.
- **Bloom** (the radiative-glow pass) only on WebGL2 and only while the stage is the Pu tab or gold (thresholds per commodity as prototype — the dog must never halo, regression-test the threshold values).

## Behaviour to port (all working in the prototype)

- Banded camera: macro (edge×3 framing, floor 5 cm) → pair → wide, continuous at crossovers; camera height capped at 1 m (monoliths are looked up at); damped dolly easing — the easing is the scale cue.
- Dog staging: beside the cube's front-right corner; above ~1.2 m edge, walks to a foreground mark pinned to screen-space NDC (0.42, −0.72) and unprojected to ground, distance clamp 3.5–8.5 m as safety only. Readout gains "Shiba standing nearer the camera" when staged (honesty line).
- Materials: gold/silver per `materials-reference` with the softbox environment and roughness-variation map; PuO₂ near-black ceramic, emissive ramp deep-red → orange-yellow with size, core point light, dark-lab environment dim on the Pu tab.
- Easter egg: hover ≥200 ms / tap / `?easter=doge` → random trick clip (play_dead, rollover, shake), crossfade back to sitting idle. Clip selection by NAME — `animations[0]` is play_dead (the dog dies; this was a shipped prototype bug, do not regress it).
- Preset clicks tween the slider value (≈600 ms ease) so the camera plays the move — new behaviour, review §1.
- Date-scrub mode needs nothing new: amount changes flow through the same damped camera.

## New decisions this stage inherits (already recorded)

- **PuO₂ pivot (DECISIONS 2026-06-11):** density 11.46, oxide fuel framing — already propagated to `commodities.ts`, `functions/_lib.ts`, bot config, illustrative-prices notes, SEO copy, and the Pu test fixture. The methodology page still needs its sintered-density caveat paragraph (this stage).
- Methodology also gains: camera model (one declared geometry per frame), staging honesty (foreground dog = real perspective, stated in the readout), and the Shiba credit.

## Tests

- Port the prototype's verified maths into vitest: framing continuity at band crossovers; camY cap; dog ground-hit distance within clamp across 12 canonical slider positions × 3 commodities (the off-piste regressions of 2026-06-11, twice, were both staging maths — pin them).
- Glow ramp monotonic; bloom thresholds per commodity (dog-halo regression).
- Dispatch: no-WebGL and reduced-motion render the sprite path; SSR HTML contains poster + readout (crawler test).
- Cube-edge canonical tests already cover the maths; PuO₂ values flow from the schema (no new constants anywhere — see audit Q2).

## Out of scope (explicitly)

Geiger crackle audio (Stage 6 thread, slots in later via the same stage), commodity-page embedded stages, the embed/sponsor widget, AR (parked), oil page decision.

## Operator checklist (Tim — not buildable by the agent)

1. Search Console + Bing verification; submit `sitemap.xml` (now build-generated with lastmod).
2. Cloudflare Pages: confirm the apex is the primary custom domain (the new `static/_redirects` 301s www → apex, but the Pages domain config should agree).
3. Run `npm test` and `npm run build` locally — the PuO₂ density change will shift Pu cube-edge expectations if any test pins them, and the sandbox couldn't execute the suite (darwin binaries).
4. Reserve the newsletter name; analytics dashboard decision (sponsor-critical per the makeover plan).
