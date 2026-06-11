#!/usr/bin/env python3
"""
Shot mockups for docs/handoff/10-shiba-scene-direction.md
=========================================================
Composites the four proposed shots (S1 macro sniff / S2 two-shot /
S3 look-up / S4 wide) from the SHIPPED sprite assets, using the spec's
pinhole projection maths: apparentPx = focalPx * realSize / distance.

Mockup-only conventions:
- ILLUSTRATIVE pricing ($100k/BTC, $110/g Au) — labelled on every frame.
- Dog poses are placeholders (the shipped sitting sprite, cropped/placed);
  final sniff-down and look-up poses come from Blender. Labelled on frame.
- DejaVu stands in for Inter/JetBrains Mono.
"""

import math
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

REPO = "/sessions/practical-amazing-shannon/mnt/bitcoinweighin"
OUT = "/sessions/practical-amazing-shannon/mnt/outputs/shot-mockups"

W, H = 1200, 700
FOV_DEG = 28.0
FOCAL = (H / 2) / math.tan(math.radians(FOV_DEG / 2))  # px

BG = (24, 24, 27)          # #18181b site background
GROUND_HI = (39, 39, 44)
AMBER = (251, 191, 36)
GREY = (161, 161, 170)
DIM = (113, 113, 122)

DOG_H_M = 0.40
GOLD_DENSITY = 19.3        # g/cm3 — mirrors commodities.ts
USD_PER_BTC = 100_000.0    # ILLUSTRATIVE
USD_PER_G = 110.0          # ILLUSTRATIVE

import os
os.makedirs(OUT, exist_ok=True)

cube_src = Image.open(f"{REPO}/static/sprites/gold/cube@2x.webp").convert("RGBA")
dog_src = Image.open(f"{REPO}/static/sprites/references/shiba_inu@2x.webp").convert("RGBA")
CUBE_BBOX = cube_src.getbbox()   # (120,163,650,707) on 800
DOG_BBOX = dog_src.getbbox()     # (297,298,620,739) on 980

try:
    F = lambda s: ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", s)
    FB = lambda s: ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", s)
    FM = lambda s: ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", s)
except OSError:
    F = FB = FM = lambda s: ImageFont.load_default()


def cube_edge_m(btc: float) -> float:
    grams = btc * USD_PER_BTC / USD_PER_G
    return (grams / GOLD_DENSITY) ** (1 / 3) / 100.0


def sprite_at(src, bbox, visible_h_px, blur=0, brightness=1.0):
    """Scale sprite so its CONTENT height == visible_h_px; return content crop."""
    content = src.crop(bbox)
    s = visible_h_px / content.height
    im = content.resize((max(1, round(content.width * s)), max(1, round(visible_h_px))), Image.LANCZOS)
    if brightness != 1.0:
        im = ImageEnhance.Brightness(im).enhance(brightness)
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    return im


def soft_shadow(canvas, cx, ground_y, w, strength=110):
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(sh)
    h = max(8, int(w * 0.16))
    d.ellipse([cx - w / 2, ground_y - h / 2, cx + w / 2, ground_y + h / 2], fill=(0, 0, 0, strength))
    canvas.alpha_composite(sh.filter(ImageFilter.GaussianBlur(max(4, w // 24))))


def vertical_gradient(top_rgb, bot_rgb, y0, y1):
    g = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - y0)
        c = tuple(round(a + (b - a) * t) for a, b in zip(top_rgb, bot_rgb))
        d.line([(0, y), (W, y)], fill=c + (255,))
    return g


def vignette(canvas, strength=90):
    v = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(v)
    d.ellipse([-W * 0.25, -H * 0.35, W * 1.25, H * 1.35], fill=255)
    v = v.filter(ImageFilter.GaussianBlur(120))
    dark = Image.new("RGBA", (W, H), (0, 0, 0, strength))
    dark.putalpha(Image.eval(v, lambda p: round((255 - p) * strength / 255)))
    canvas.alpha_composite(dark)


def caption(canvas, shot_label, figures, geometry=None, placeholder=None):
    d = ImageDraw.Draw(canvas)
    d.rectangle([0, H - 64, W, H], fill=(16, 16, 18, 235))
    d.text((24, H - 52), shot_label, font=FB(19), fill=AMBER)
    d.text((24, H - 27), figures, font=FM(14), fill=GREY)
    d.text((W - 24, H - 52), "illustrative: $100k/BTC · $110/g Au", font=F(12), fill=DIM, anchor="ra")
    if geometry:
        d.text((W - 24, H - 27), geometry, font=FM(14), fill=AMBER, anchor="ra")
    if placeholder:
        d.text((W - 24, 20), placeholder, font=F(13), fill=DIM, anchor="ra")


def base_canvas(ground_y, ground_glow=1.0):
    c = Image.new("RGBA", (W, H), BG + (255,))
    c.alpha_composite(vertical_gradient(BG, tuple(round(v * 0.85) for v in BG), 0, ground_y))
    hi = tuple(min(255, round(v * ground_glow)) for v in GROUND_HI)
    c.alpha_composite(vertical_gradient(hi, BG, ground_y, H))
    return c


# ───────────────────────── S1 — Macro sniff ─────────────────────────
def shot_s1():
    btc = 0.05
    edge = cube_edge_m(btc)                       # ~1.33 cm
    cube_dist = max(0.15, FOCAL * edge / (0.32 * H))   # min-focus clamp
    dog_dist = cube_dist + 0.60
    cube_px = FOCAL * edge / cube_dist
    dog_px = FOCAL * DOG_H_M / dog_dist

    ground_y = 560
    c = base_canvas(ground_y, ground_glow=1.25)

    cx = 480
    cube_top = ground_y - cube_px

    # Dog behind focal plane: head crop, blurred, looming from upper right,
    # pitched 14° nose-down as a stand-in for the sniff pose. Nose aimed
    # just above the cube.
    dog = sprite_at(dog_src, DOG_BBOX, dog_px, brightness=0.82)
    head = dog.crop((0, 0, round(dog.width * 0.62), round(dog.height * 0.46)))
    # fade the hard crop edges (bottom + right) so the head reads as
    # entering frame, not as a cut-out
    fade = Image.new("L", head.size, 255)
    fd = ImageDraw.Draw(fade)
    for i in range(90):
        a = round(255 * i / 90)
        fd.line([(0, head.height - 1 - i), (head.width, head.height - 1 - i)], fill=a)
    head.putalpha(Image.composite(head.split()[3], Image.new("L", head.size, 0),
                                  fade.point(lambda p: p)))
    head = head.rotate(-14, expand=True, resample=Image.BICUBIC)
    head = head.filter(ImageFilter.GaussianBlur(5))
    nose_x, nose_y = cx + 80, cube_top - 16
    c.alpha_composite(head, (round(nose_x - 0.10 * head.width),
                             round(nose_y - 0.85 * head.height)))

    cube = sprite_at(cube_src, CUBE_BBOX, cube_px)
    soft_shadow(c, cx, ground_y + 2, cube.width * 1.25, 150)
    c.alpha_composite(cube, (cx - cube.width // 2, round(ground_y - cube.height + 2)))

    vignette(c, 100)
    caption(
        c, "S1 — MACRO SNIFF",
        f"0.05 BTC · 1.5 ozt gold (45 g) · cube edge 0.5 in (1.3 cm)",
        geometry=f"cube {cube_dist*39.37:.0f} in from camera · Shiba {dog_dist*3.281:.1f} ft",
        placeholder="dog pose: PLACEHOLDER (sniff-down comes from Blender)",
    )
    return c


# ───────────────────────── S2 — Two-shot ─────────────────────────
def shot_s2():
    btc = 1_000
    edge = cube_edge_m(btc)                       # ~36 cm
    ppm = 0.62 * H / max(edge, DOG_H_M)           # single px-per-metre
    cube_px, dog_px = edge * ppm, DOG_H_M * ppm

    ground_y = 580
    c = base_canvas(ground_y)
    mid, gap = W // 2, 45

    cube = sprite_at(cube_src, CUBE_BBOX, cube_px)
    dog = sprite_at(dog_src, DOG_BBOX, dog_px)
    soft_shadow(c, mid - gap - cube.width // 2, ground_y + 4, cube.width * 1.3, 120)
    soft_shadow(c, mid + gap + dog.width // 2, ground_y + 4, dog.width * 1.2, 100)
    c.alpha_composite(cube, (mid - gap - cube.width, ground_y - cube.height))
    c.alpha_composite(dog, (mid + gap, ground_y - dog.height))

    vignette(c, 70)
    caption(
        c, "S2 — TWO-SHOT  (current composition, kept)",
        "1,000 BTC · 2,004 lb gold (909 kg) · cube edge 14.2 in (36 cm)",
    )
    return c


# ───────────────────────── S3 — Look-up ─────────────────────────
def shot_s3():
    btc = 100_000
    edge = cube_edge_m(btc)                       # ~1.68 m
    ppm = 0.74 * H / edge
    cube_px, dog_px = edge * ppm, DOG_H_M * ppm

    ground_y = 612
    c = base_canvas(ground_y)
    # low camera: darken sky-side
    c.alpha_composite(vertical_gradient((10, 10, 12), BG, 0, 240))

    cube = sprite_at(cube_src, CUBE_BBOX, cube_px)
    cx = 470
    soft_shadow(c, cx, ground_y + 4, cube.width * 1.35, 140)
    c.alpha_composite(cube, (cx - cube.width // 2, ground_y - cube.height))

    dog = sprite_at(dog_src, DOG_BBOX, dog_px)
    dx = cx + cube.width // 2 + 40
    soft_shadow(c, dx + dog.width // 2, ground_y + 3, dog.width * 1.3, 110)
    c.alpha_composite(dog, (dx, ground_y - dog.height + 2))

    vignette(c, 70)
    caption(
        c, "S3 — LOOK-UP  (camera at dog-eye height)",
        "100,000 BTC · 100 US tons gold (90.9 t) · cube edge 5 ft 6 in (1.68 m)",
        placeholder="PLACEHOLDERS: dog look-up pose + low-angle cube render (top face shouldn't be visible from down here)",
    )
    return c


# ───────────────────────── S4 — Wide ─────────────────────────
def shot_s4():
    btc = 21_000_000
    edge = cube_edge_m(btc)                       # ~10 m
    cam_h = 0.55
    dog_dist = 3.5
    cube_target = 0.50 * H
    cube_dist = FOCAL * edge / cube_target
    cube_px = FOCAL * edge / cube_dist
    dog_px = FOCAL * DOG_H_M / dog_dist

    horizon_y = 380
    c = Image.new("RGBA", (W, H), BG + (255,))
    # sky → horizon glow → ground
    c.alpha_composite(vertical_gradient((14, 14, 17), (45, 44, 50), 0, horizon_y))
    c.alpha_composite(vertical_gradient((52, 50, 56), BG, horizon_y, H))

    # ground-plane convergence hint — kept away from the cube's contact line
    d = ImageDraw.Draw(c)
    for i in range(2, 6):
        y = horizon_y + round((H - horizon_y) * (i / 6) ** 1.8)
        a = 10 + i * 4
        d.line([(0, y), (W, y)], fill=(70, 70, 78, a))

    # cube, distant: ground contact below horizon by focal*camH/dist, hazed
    cube_ground = horizon_y + FOCAL * cam_h / cube_dist
    cube = sprite_at(cube_src, CUBE_BBOX, cube_px, blur=1)
    haze = Image.new("RGBA", cube.size, (52, 50, 56, 64))
    haze.putalpha(Image.eval(cube.split()[3], lambda p: min(p, 64)))
    cube.alpha_composite(haze)
    cx = 430
    # haze pool at the base ties the distant cube to the ground plane
    pool = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pool)
    pd.ellipse([cx - cube.width * 0.9, cube_ground - 18, cx + cube.width * 0.9, cube_ground + 26],
               fill=(60, 58, 66, 70))
    c.alpha_composite(pool.filter(ImageFilter.GaussianBlur(18)))
    soft_shadow(c, cx, cube_ground + 2, cube.width * 1.1, 130)
    c.alpha_composite(cube, (cx - cube.width // 2, round(cube_ground - cube.height + 2)))

    # dog, foreground right, sharp
    dog_ground = horizon_y + FOCAL * cam_h / dog_dist
    dog = sprite_at(dog_src, DOG_BBOX, dog_px)
    dx = 870
    soft_shadow(c, dx + dog.width // 2, dog_ground + 3, dog.width * 1.25, 130)
    c.alpha_composite(dog, (dx, round(dog_ground - dog.height + 2)))

    vignette(c, 80)
    caption(
        c, "S4 — WIDE  (foreground dog, distant cube)",
        "21,000,000 BTC · 19,100 t gold · cube edge 32.7 ft (9.96 m)",
        geometry=f"Shiba {dog_dist*3.281:.0f} ft from camera · cube {cube_dist*3.281:.0f} ft",
        placeholder="PLACEHOLDERS: dog distant-gaze pose + low-angle cube render (a 33 ft cube seen from knee height shows no top face)",
    )
    return c


shots = {"s1-macro-sniff": shot_s1(), "s2-two-shot": shot_s2(),
         "s3-look-up": shot_s3(), "s4-wide": shot_s4()}

for name, im in shots.items():
    im.convert("RGB").save(f"{OUT}/{name}.png")

# contact sheet
sheet = Image.new("RGB", (W, H * 2 + 8), (10, 10, 12))
for i, im in enumerate(shots.values()):
    small = im.convert("RGB").resize((W // 2 - 2, (H * 2 + 8) // 2 - 4), Image.LANCZOS)
    sheet.paste(small, ((i % 2) * (W // 2 + 2), (i // 2) * ((H * 2 + 8) // 2 + 2)))
sheet.save(f"{OUT}/contact-sheet.png")
print("done:", ", ".join(shots), f"\nFOCAL={FOCAL:.0f}px  edges:",
      {k: round(cube_edge_m(b), 4) for k, b in
       [("0.05", 0.05), ("1k", 1e3), ("100k", 1e5), ("21M", 2.1e7)]})
