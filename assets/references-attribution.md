# Reference Library Attribution

This document records the source, license, and canonical sizing for every entry in the scale reference library used by Bitcoin Weigh-In's cube-mode rendering. Each animal listed below is rendered through the standard Blender pipeline (see `scripts/blender/` and `assets/materials-reference.md`) and stored at `assets/blender/references/{id}/`.

Where a reference uses a CC-BY licensed model, the required attribution string is recorded under "Required attribution" and must be reproduced on the methodology page or footer of the published site.

Sizing values are sourced from authoritative references (Wikipedia, breed standards, biological literature). Where breed or species variation is significant, the chosen value is noted alongside its rationale.

---

## Sourced

### Shiba Inu

- **id:** `shiba_inu`
- **realSizeMetres:** 0.4
- **measurementAxis:** height
- **Sizing source:** Japanese Shiba Inu breed standard, shoulder height 38–41 cm. 0.4 m chosen as canonical mid-range value.
- **Model source:** [TBD — pending user confirmation of Sketchfab page]
- **License:** CC BY 4.0
- **Required attribution:** [TBD]
- **Local path:** `assets/blender/references/shiba_inu/`
- **Format:** glTF (animated)
- **Notes:** Animated source; static sprite rendered from a specific frame chosen for the alert sitting pose. Same `.gltf` is also served at `static/models/references/shiba_inu/scene.gltf` for the easter egg playback (hover, sustained tap, or `?easter=doge` URL parameter).
- **Downloaded:** 2026-04-26

---

## To be sourced

The following 11 animals complete the reference library. Each one needs to be located on Sketchfab (or Quaternius / BlenderKit / Poly Haven where available), downloaded as glTF or glb, placed at `assets/blender/references/{id}/`, and recorded with a complete entry in this file before the asset session can render it.

Look for: pose neutrality (side or three-quarter, no action poses), naturalistic colouration, PBR materials, triangle count between 5k and 200k, and CC-BY 4.0 or CC0 licensing only. Skip CC-BY-NC and CC-BY-SA — these aren't compatible with the project's c