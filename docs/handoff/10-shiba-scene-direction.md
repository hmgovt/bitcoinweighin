# Stage 10 — Shiba scene direction (cube + dog, cinematic treatment)

*Read `00-OVERVIEW.md` first. Replaces the rejected scale-band-ladder draft (2026-06-10). The universal-Shiba decision (2026-05-04) stands: one dog, every cube panel, no reference ladder. This stage makes the cube + Shiba scene convincing through camera work — shots, zoom, perspective, and pose — not by swapping the reference.*

## ROLE

You are re-staging `CubeRenderer.svelte`'s scene. Cube maths, honesty principle, midline-anchor machinery, and the Shiba all stay. What changes: the scene gains a *camera* — a small set of shot types that frame cube and dog the way a photographer actually would at each scale, with continuous zoom inside a shot and animated transitions between shots. The dog gains poses, becoming a character that reacts to the cube rather than a sprite parked next to it.

## Why (diagnosis)

The current scene is one fixed two-shot across ~6 orders of magnitude of cube edge. At parity it works. At the extremes it degrades exactly as the spec predicted ("speck or giant") — predicted, but not *convincing*, because no real photograph would ever frame a 3 mm speck and a dog full-body in the same flat shot. Real photography solves scale with framing: macro for the speck (dog cropped to a snout), wide for the monolith (dog in the foreground, cube in the distance). We adopt that grammar.

## Hard constraints

- **One reference. The dog.** No ladder, no swaps. Rejected 2026-06-10.
- **Honesty, generalised:** every apparent size on screen derives from one declared camera geometry per frame — `apparentPx = focalPx × realSize / distance`. When cube and dog are at the *same* distance (the parity shot), this degenerates to today's single `pxPerMetre` and relative sizes read directly. When distances differ (macro, wide), the caption strip **states the geometry** ("Shiba 5 ft from camera · cube 180 ft"). Nothing is ever scaled by feel.
- **Cocaine and Pu-238 furniture untouched.** Still-mode bypasses this entirely; glow/Geiger composite on the cube slot regardless of shot.
- **`prefers-reduced-motion: reduce`:** no dolly animation, no pose cross-fade (hard cuts), no idle animation. Shot logic itself unchanged.
- **Shiba easter egg** (model-viewer on hover/tap/`?easter=doge`) survives in every shot where the dog is full-body.
- **US-primacy:** caption distances imperial-first via `formatLength()`.

## The four shots

Thresholds in cube edge (dog = 0.40 m shoulder throughout). Working range, verified against current schema: ~78 µm (1 sat of gold) to ~58 m (21M BTC of silver).

### S1 — Macro sniff (cube edge < 5 cm)

Ground-level macro. Cube close to camera, in focus, centred low. The dog enters the frame *cropped* — snout and one forepaw from frame-right, at true projected scale, head angled down at the cube. A cropped dog is still a scale anchor; this is how macro photography keeps context in frame.

- Camera geometry: cube near-plane (~0.3 m), dog ~1 m behind it. Both projected through the same formula; tune the two distances so the snout occupies roughly the right third of frame across the band.
- Below ~2 mm edge even the macro shot can't resolve the cube. Keep the 2 px floor, and add the **magnifier inset**: a circular loupe showing the cube at a declared magnification (×10 / ×50 / ×200, chosen so the inset cube renders 40–120 px). Declared magnification = honest. A 2 px glint the dog is sniffing at, plus a loupe, reads as intentional.
- Environment: tabletop/ground texture, tight vignette, shallow-DoF blur on the dog crop (it's behind focal plane — the blur is *correct*, not decorative).

### S2 — Two-shot (5 cm – 1.2 m)

Today's composition, kept and polished: both at the same distance, single `pxPerMetre`, midline anchors as shipped. This band is where the current renderer is already right. Additions: shared ground plane (one horizon/floor gradient both sprites sit on, instead of two independent contact shadows floating in void), and the parity moment — when cube edge crosses dog height, a one-time subtle cue (the dog's look-up pose starts here).

### S3 — Look-up (1.2 m – 4 m)

Same single-distance projection as S2, camera dropped to dog-eye height. Cube towers; dog at its base in the **look-up pose** (head tilted back). At 4 m the dog is still ~10% of frame height (~40 px at desktop row height) — visible, characterful, honest. Environment: floor line lower in frame, longer cube shadow.

### S4 — Wide (> 4 m)

The photographer's trick for mountains: **foreground dog, distant cube.** Dog near camera (fixed ~1.5 m), cube far enough away to fit the frame at ~70% height — distance solved from the projection formula, so it grows with the cube (58 m silver cube ends up a few hundred feet out). Dog renders at a near-constant, legible size across the whole band; the cube's growth is conveyed by the *stated distance* and by depth cues: ground-plane convergence to a horizon, atmospheric haze proportional to distance, shadow direction consistent with the key light.

- Caption strip gains the geometry line: "Shiba 5 ft from camera · cube 240 ft". That line is the honesty mechanism for this shot — it must never be dropped while distances differ.
- Dog pose: standing, looking toward the cube (profile or three-quarter rear — decide from test renders).

### Shot picker

```typescript
// volume.ts — pure, testable
export function pickShot(cubeEdgeM: number, currentShot?: ShotId): ShotId
```

Thresholds 0.05 / 1.2 / 4.0 m with ±10% hysteresis so slider scrubbing near a boundary doesn't flap. Within a shot, geometry interpolates continuously with cube edge — the slider always produces motion (this is what kills the "dead slider" feel). Between shots, a 400 ms log-interpolated dolly (zoom + reframe) with a 250 ms pose cross-fade. Reduced motion: hard cut.

## The dog as character

Pose ladder, one render each through the canonical Blender pipeline:

1. **Sniff-down** (S1 crop source + S2 low end) — head down toward the cube.
2. **Stand profile** (S2) — the existing shipped sprite. No new asset.
3. **Look-up** (S3) — head tilted back. The money pose.
4. **Stand distant-gaze** (S4) — may reuse profile; decide from test renders.

So **two, at most three, new dog renders**, plus environment gradients. That's the entire asset bill — compare seven sprites for the rejected ladder.

Idle life (optional, cheap, do last): the animated `.gltf` already on disk gives an occasional idle — an ear flick or head turn every ~20 s, ≤1 s, S2/S3 only, killed by reduced-motion. This is the difference between a sprite and a *pal* without becoming a gimmick.

**Open item before asset work:** confirm the Shiba `.gltf`/Blender source is poseable (rigged), not just a baked animation. If baked-only, the poses come from re-rendering the original model in Blender with manual posing — more work, same output; budget accordingly.

## Implementation notes

- The projection layer is a generalisation, not a rewrite: `projectToPx(realSize, distance, camera)` lives beside the existing helpers in `volume.ts`; S2/S3 call it with equal distances and must reproduce current `pxPerMetre` behaviour exactly (regression-test this — the 1789 BTC width-clamp case included).
- Per-shot layout config (anchor side, ground-line height, vignette, haze) is data — a `SHOTS` table, not branches scattered through the component.
- Keep per-sprite visible-bbox margin compensation; each new pose ships with its measured `visibleHeightFraction` exactly as the current sprites do.
- Environment layers: absolutely-positioned gradient divs cross-faded per shot. No three.js, no canvas.

## Tests

- `pickShot` canonical edges per band + boundary ± hysteresis.
- Projection invariant: `apparentA / apparentB === (sizeA/distA) / (sizeB/distB)` at 12 canonical slider positions × 3 cube commodities.
- S2 equivalence: equal-distance projection reproduces current canonical cube-edge px values (existing tests keep passing untouched).
- Geometry caption: present whenever cube and dog distances differ; absent in S2/S3.
- Magnifier ladder: chosen magnification always yields 40–120 px inset cube.
- Reduced motion: no interpolated transitions.

## Open items (ask, don't guess)

1. Rigged vs baked Shiba asset (above) — determines pose-render effort.
2. S4 dog orientation (rear three-quarter vs profile) — taste call from test renders.
3. Whether the dolly transition also fires in date-scrub mode (recommend yes — same state change, and the scrubber is where the motion will be most entertaining).
4. Haze/horizon art direction for S4 — needs one mood reference from you before gradients are authored.
