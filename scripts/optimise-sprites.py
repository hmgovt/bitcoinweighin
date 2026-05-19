#!/usr/bin/env python3
"""
Sprite optimisation pass — resize + re-encode WebP via Pillow.

Rationale: Lighthouse flagged the largest contentful image (Shiba sprite)
and several cube/shadow sprites as oversized for their displayed dimensions
on mobile. This script downsizes the source canvas to a sane retina-safe
maximum (2× the largest realistic CSS slot) and re-encodes at a quality
floor that is visually indistinguishable from the original at typical
viewing distance.

Targets — derived from CubeRenderer slot calculations:
  - Desktop row cap        = 540 px
  - Mobile row cap         = 360 px
  - Cube  visible fraction = 0.674   (bbox 1078 / 1600)
  - Shiba visible fraction = 0.446   (bbox 713  / 1600)
  - Cube slot max  CSS px  = 540 / 1.1 / 0.674  ≈ 733
  - Shiba slot max CSS px  = 540 / 1.1 / 0.446  ≈ 1102

So a 2× source canvas of:
  - Cube  : 1466 → use 1024 (already at 800; bump down further on shadows)
  - Shiba : 2204 → use 1200 (current 1600 over-spec'd for ≤ desktop max)

Shadow assets are soft (blurred drop-shadows) and tolerate aggressive
downsampling — drop those to 400 px at quality 72.
"""
from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[1]
SPRITES = REPO / "static" / "sprites"
STATIC = REPO / "static"


@dataclass(frozen=True)
class Job:
    src: Path
    dst: Path
    max_dim: int      # longest side (preserves aspect ratio)
    quality: int      # WebP lossy quality 0–100


def jobs() -> list[Job]:
    out: list[Job] = []

    # ── Shiba (LCP element) ──────────────────────────────────────
    shiba = SPRITES / "references" / "shiba_inu.webp"
    out.append(Job(shiba, shiba, max_dim=1200, quality=82))
    out.append(Job(shiba, shiba.with_name("shiba_inu@1x.webp"),
                   max_dim=600, quality=80))

    # ── Cube sprites (gold, silver, pu238) ───────────────────────
    for material in ("gold", "silver", "pu238"):
        cube = SPRITES / material / "cube@2x.webp"
        out.append(Job(cube, cube, max_dim=800, quality=82))
        out.append(Job(cube, cube.with_name("cube@1x.webp"),
                       max_dim=400, quality=80))

        shadow = SPRITES / material / "cube-shadow@2x.webp"
        out.append(Job(shadow, shadow, max_dim=400, quality=72))
        out.append(Job(shadow, shadow.with_name("cube-shadow@1x.webp"),
                       max_dim=200, quality=72))

    # ── Cocaine-lab still ────────────────────────────────────────
    coke = SPRITES / "cocaine" / "cocaine-lab.webp"
    out.append(Job(coke, coke, max_dim=700, quality=82))
    out.append(Job(coke, coke.with_name("cocaine-lab@1x.webp"),
                   max_dim=350, quality=80))

    # ── Brand mark (header.webp) ─────────────────────────────────
    header = STATIC / "header.webp"
    out.append(Job(header, header, max_dim=960, quality=82))
    out.append(Job(header, header.with_name("header@1x.webp"),
                   max_dim=480, quality=80))

    return out


def process(job: Job) -> tuple[int, int]:
    before = job.src.stat().st_size
    img = Image.open(job.src)
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    w, h = img.size
    longest = max(w, h)
    if longest > job.max_dim:
        scale = job.max_dim / longest
        new_size = (round(w * scale), round(h * scale))
        img = img.resize(new_size, Image.LANCZOS)
    img.save(job.dst, "WEBP", quality=job.quality, method=6)
    after = job.dst.stat().st_size
    return before, after


def main() -> int:
    total_before = total_after = 0
    for j in jobs():
        if not j.src.exists():
            print(f"  ✗ missing: {j.src}")
            continue
        before, after = process(j)
        rel = j.dst.relative_to(REPO)
        delta = after - before if j.src == j.dst else after
        sign = "−" if delta <= 0 else "+"
        # When src==dst we report delta vs old; otherwise we report new file size
        if j.src == j.dst:
            total_before += before
            total_after += after
            pct = (1 - after / before) * 100 if before else 0
            print(f"  {rel}: {before:>7} → {after:>7} B ({sign}{abs(delta):>6} B, {pct:5.1f}%)")
        else:
            total_after += after
            print(f"  {rel}: NEW          → {after:>7} B  (1x variant)")
    print()
    print(f"In-place total: {total_before:>7} → {total_after:>7} B")
    return 0


if __name__ == "__main__":
    sys.exit(main())
