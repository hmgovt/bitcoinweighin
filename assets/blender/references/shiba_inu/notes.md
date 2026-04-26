# Shiba Inu — render notes

*First animal reference for the cube-mode library. Static sprite +
animated gltf for the easter egg.*

## Source

- Animated Dog, Shiba Inu — by [quander on Sketchfab](https://sketchfab.com/3d-models/animated-dog-shiba-inu-9abfce885a834399b2c3ccaed51cd474)
- License: CC-BY-4.0 — attribution required, commercial use allowed.
- Five baked animation clips: `play_dead`, `rollover`, `shake`,
  `sitting`, `standing`. The static sprite is rendered from the
  `sitting` clip; the animated gltf served at `/models/references/shiba_inu/scene.gltf`
  loops `sitting` continuously when the easter egg is active.

## Static-sprite frame

- **Clip:** `sitting_0`
- **Frame:** `60` (≈2.5 s into the 12 s loop at 24 fps)
- **Pose intent:** sitting upright, head tilted slightly up and to the
  right, soft mouth, alert eyes. Picked frame 60 to avoid any settling
  motion at the start of the loop.

If the chosen frame lands on the wrong pose, edit `ANIMATION_FRAME` at
the top of `scripts/blender/shiba_inu.py` and re-run. The static sprite
is the only output that depends on this number; the animated gltf does
not (it loops the whole clip at runtime).

## Sizing convention

- **Real-world height:** 0.4 m (Japanese Shiba Inu breed standard,
  shoulder height ~38–41 cm). Tagged in `src/lib/scale-references.json`
  via `realSizeMetres: 0.4` and `measurementAxis: "height"`.
- **Blender render size:** 0.5 m on the configured measurement axis.
  The lighting rig in `assets/materials-reference.md` is calibrated for
  a subject of that longest dimension. Runtime renderer applies the
  cube-relative scale based on `realSizeMetres`, not the Blender size.
  This separation matches `gold_cube.py` (cube authored at 0.5 m edge,
  CSS-scaled at runtime).

## Outputs

- Static sprite: `static/sprites/references/shiba_inu.webp` (1600×1600 RGBA, transparent)
- Contact shadow: `static/sprites/references/shiba_inu-shadow.png`
- Source `.blend`: `assets/blender/references/shiba_inu/render.blend`
- Animated gltf for the easter egg: `static/models/references/shiba_inu/scene.gltf`

The static sprite includes intrinsic transparent margin (camera
distance 1.55 — same value the gold cube re-render landed on per
DECISIONS.md 2026-04-26). No CSS padding is added at runtime; if the
margin reads wrong, fix it in the Blender script's `dist`, not in CSS.
