"""Build the game's sprite atlases from the generated art.

Usage: python3 tools/build_atlas.py
Reads assets/raw/*.png, writes src/assets/sprites/{fruits.png,fruits.json,particles.png,particles.json,ui/*}.
Fruit sprites are rendered at SCALE x their on-screen size with the soft drop shadow baked in, so the
game only blits them. Needs Pillow.
"""
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets/raw"
OUT = ROOT / "src/assets/sprites"
SCALE = 3
JAR_W = 324
RADII = [f * JAR_W for f in (0.045, 0.06, 0.075, 0.09, 0.11, 0.13, 0.155, 0.18, 0.21, 0.245, 0.29)]
FRUITS = ["t01_blueberry", "t02_lychee", "t03_kiwi", "t04_passionfruit", "t05_pomegranate",
          "t06_dragonfruit", "t07_mango", "t08_coconut", "t09_pineapple", "t10_watermelon", "t11_jackfruit"]
BODY_FIT = 1.04  # sprite body radius / physics radius (felt edges overlap a touch)
PAD = 8  # design px around each sprite for the shadow


def trim(im):
    return im.crop(im.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox())


def body_circle(im):
    """Robust fit of the round body: centroid, radial edge distances, refit on inliers."""
    w, h = im.size
    a = im.getchannel("A").load()
    pts = [(x, y) for y in range(0, h, 3) for x in range(0, w, 3) if a[x, y] > 128]
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    r = 0.0
    for _ in range(3):
        dists = []
        for i in range(180):
            t = 2 * math.pi * i / 180
            dx, dy, d, last = math.cos(t), math.sin(t), 0.0, 0.0
            while True:
                x, y = int(cx + dx * d), int(cy + dy * d)
                if not (0 <= x < w and 0 <= y < h):
                    break
                if a[x, y] > 128:
                    last = d
                d += 1.5
            dists.append((t, last))
        r = sorted(d for _, d in dists)[len(dists) // 2]
        inl = [(t, d) for t, d in dists if abs(d - r) < 0.07 * r]
        cx += sum((d - r) * math.cos(t) for t, d in inl) / max(1, len(inl))
        cy += sum((d - r) * math.sin(t) for t, d in inl) / max(1, len(inl))
    return cx, cy, r


def with_shadow(im, blur, dy, color=(70, 32, 60), alpha=0.30):
    pad = PAD * SCALE
    canvas = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    shadow_a = Image.new("L", canvas.size, 0)
    shadow_a.paste(im.getchannel("A"), (pad, pad + dy))
    shadow_a = shadow_a.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * alpha))
    shadow = Image.new("RGBA", canvas.size, color + (0,))
    shadow.putalpha(shadow_a)
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(im, (pad, pad))
    return canvas


def pack(images, width):
    """Shelf packing, tallest first. Returns rects keyed like images and the atlas height."""
    order = sorted(images, key=lambda k: -images[k].height)
    x = y = shelf = 0
    rects = {}
    for k in order:
        im = images[k]
        if x + im.width > width:
            x, y, shelf = 0, y + shelf + 2, 0
        rects[k] = (x, y, im.width, im.height)
        x += im.width + 2
        shelf = max(shelf, im.height)
    return rects, y + shelf


def build_fruits():
    sprites, meta = {}, {}
    for i, name in enumerate(FRUITS):
        src = trim(Image.open(RAW / f"{name}.png").convert("RGBA"))
        cx, cy, r = body_circle(src)
        k = RADII[i] * BODY_FIT / r * SCALE  # raw px -> atlas px
        im = src.resize((max(1, round(src.width * k)), max(1, round(src.height * k))), Image.LANCZOS)
        sprites[name] = with_shadow(im, blur=3.5 * SCALE, dy=3 * SCALE)
        meta[name] = {"ax": cx * k + PAD * SCALE, "ay": cy * k + PAD * SCALE}
    rects, height = pack(sprites, 1400)
    atlas = Image.new("RGBA", (1400, height), (0, 0, 0, 0))
    out = []
    for i, name in enumerate(FRUITS):
        x, y, w, h = rects[name]
        atlas.alpha_composite(sprites[name], (x, y))
        out.append({"tier": i + 1, "x": x, "y": y, "w": w, "h": h,
                    "ax": round(meta[name]["ax"], 2), "ay": round(meta[name]["ay"], 2)})
    atlas.save(OUT / "fruits.png", optimize=True)
    (OUT / "fruits.json").write_text(json.dumps({"scale": SCALE, "sprites": out}, indent=1))
    print("fruits atlas", atlas.size)


def build_particles():
    s = SCALE * 4  # draw big, downsample for smooth edges
    shapes = {}
    drop = Image.new("RGBA", (16 * s, 11 * s), (0, 0, 0, 0))
    ImageDraw.Draw(drop).ellipse((0, 0, 16 * s - 1, 11 * s - 1), fill=(255, 255, 255, 255))
    ImageDraw.Draw(drop).ellipse((9 * s, 2 * s, 12 * s, 5 * s), fill=(255, 255, 255, 255))
    shapes["drop"] = drop
    star = Image.new("RGBA", (16 * s, 16 * s), (0, 0, 0, 0))
    c, pts = 8 * s, []
    for j in range(8):
        rr = 8 * s if j % 2 == 0 else 1.6 * s
        t = math.pi / 4 * j - math.pi / 2
        pts.append((c + rr * math.cos(t), c + rr * math.sin(t)))
    ImageDraw.Draw(star).polygon(pts, fill=(255, 255, 255, 255))
    shapes["spark"] = star
    conf = Image.new("RGBA", (14 * s, 7 * s), (0, 0, 0, 0))
    ImageDraw.Draw(conf).rounded_rectangle((0, 0, 14 * s - 1, 7 * s - 1), radius=2 * s, fill=(255, 255, 255, 255))
    shapes["confetti"] = conf
    dot = Image.new("RGBA", (8 * s, 8 * s), (0, 0, 0, 0))
    ImageDraw.Draw(dot).ellipse((1 * s, 1.5 * s, 7 * s, 7.5 * s), fill=(90, 59, 208, 90))
    ImageDraw.Draw(dot).ellipse((1.8 * s, 1.8 * s, 6.2 * s, 6.2 * s), fill=(255, 255, 255, 255))
    shapes["dot"] = dot
    small = {k: v.resize((v.width // 4, v.height // 4), Image.LANCZOS) for k, v in shapes.items()}
    rects, height = pack(small, 160)
    atlas = Image.new("RGBA", (160, height), (0, 0, 0, 0))
    out = {}
    for k, im in small.items():
        x, y, w, h = rects[k]
        atlas.alpha_composite(im, (x, y))
        out[k] = {"x": x, "y": y, "w": w, "h": h}
    atlas.save(OUT / "particles.png", optimize=True)
    (OUT / "particles.json").write_text(json.dumps({"scale": SCALE, "sprites": out}, indent=1))
    print("particles atlas", atlas.size)


def build_ui():
    ui = OUT / "ui"
    ui.mkdir(exist_ok=True)
    for name in FRUITS + ["ui_mystery_orb", "ui_leaf_cluster", "ui_shake", "ui_pop"]:
        im = trim(Image.open(RAW / f"{name}.png").convert("RGBA"))
        im.thumbnail((360, 360), Image.LANCZOS)
        im.save(ui / f"{name}.png", optimize=True)
    mat = trim(Image.open(RAW / "jar_mat.png").convert("RGBA"))
    mat.thumbnail((1170, 1170), Image.LANCZOS)
    mat.save(OUT / "jar_mat.png", optimize=True)
    bg = Image.open(RAW / "bg_gameplay.png").convert("RGB").filter(ImageFilter.GaussianBlur(2.2))
    bg.save(OUT / "bg_gameplay.jpg", quality=88, optimize=True)
    print("ui sprites, mat, background written")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    build_fruits()
    build_particles()
    build_ui()
