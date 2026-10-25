// Static layers recorded once into Skia pictures: background, jar back, jar front, HUD panels.
// Jar geometry is the canvas design's SVG, in world units.
import {
  BlurStyle,
  PaintStyle,
  Skia,
  StrokeCap,
  TileMode,
  vec,
  type SkCanvas,
  type SkImage,
  type SkPaint,
  type SkPicture,
  type SkShader,
} from '@shopify/react-native-skia';
import { WORLD_H, WORLD_W } from '../game/config';
import type { StageLayout } from './layout';
import type { Resources } from './resources';

const col = (c: string) => Skia.Color(c);

export function linear(x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): SkShader {
  return Skia.Shader.MakeLinearGradient(vec(x0, y0), vec(x1, y1), stops.map(s => col(s[1])), stops.map(s => s[0]), TileMode.Clamp);
}

export function radial(cx: number, cy: number, r: number, stops: [number, string][]): SkShader {
  return Skia.Shader.MakeRadialGradient(vec(cx, cy), r, stops.map(s => col(s[1])), stops.map(s => s[0]), TileMode.Clamp);
}

export function fill(color: string, shader?: SkShader): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  if (shader) p.setShader(shader);
  else p.setColor(col(color));
  return p;
}

export function stroke(color: string, width: number, round = false): SkPaint {
  const p = fill(color);
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(width);
  if (round) p.setStrokeCap(StrokeCap.Round);
  return p;
}

export function shadowPaint(color: string, sigma: number): SkPaint {
  const p = fill(color);
  p.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, sigma, true));
  return p;
}

const path = (d: string) => Skia.Path.MakeFromSVGString(d)!;
const rect = (x: number, y: number, w: number, h: number) => Skia.XYWHRect(x, y, w, h);
const rrect = (x: number, y: number, w: number, h: number, r: number) => Skia.RRectXY(rect(x, y, w, h), r, r);

export function starPath(size: number) {
  const s = size;
  const q = s * 0.18;
  return path(`M0 ${-s} Q${q} ${-q} ${s} 0 Q${q} ${q} 0 ${s} Q${-q} ${q} ${-s} 0 Q${-q} ${-q} 0 ${-s} Z`);
}

function record(draw: (c: SkCanvas) => void, w: number, h: number): SkPicture {
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(rect(0, 0, w, h));
  draw(c);
  return rec.finishRecordingAsPicture();
}

function drawImage(c: SkCanvas, img: SkImage, x: number, y: number, w: number, h: number, paint: SkPaint) {
  c.drawImageRect(img, rect(0, 0, img.width(), img.height()), rect(x, y, w, h), paint);
}

// Screen-space background: the painting (cover), the soft cream wash, then world-space glow and mat.
export function recordBackground(R: Resources, L: StageLayout): SkPicture {
  return record(c => {
    const sprite = fill('#FFFFFF');
    const iw = R.bg.width();
    const ih = R.bg.height();
    const sc = Math.max(L.width / iw, L.height / ih) * 1.02;
    const dw = iw * sc;
    const dh = ih * sc;
    c.drawRect(rect(0, 0, L.width, L.height), fill('#FFF6E9'));
    drawImage(c, R.bg, (L.width - dw) / 2, (L.height - dh) * 0.42, dw, dh, sprite);
    c.drawRect(
      rect(0, 0, L.width, L.height),
      fill('#000', linear(0, 0, 0, L.height, [
        [0, 'rgba(255,246,233,0.44)'], [0.26, 'rgba(255,246,233,0.08)'], [0.6, 'rgba(255,246,233,0)'], [1, 'rgba(255,236,214,0.46)'],
      ])),
    );
    c.save();
    c.translate(L.ox, L.oy);
    c.scale(L.s, L.s);
    c.save();
    c.translate(195, 490);
    c.scale(235 / 290, 1);
    c.drawCircle(0, 0, 290, fill('#000', radial(0, 0, 290, [[0, 'rgba(255,250,240,0.66)'], [1, 'rgba(255,250,240,0)']])));
    c.restore();
    drawImage(c, R.mat, 3, 686, 384, 60, sprite);
    c.restore();
  }, L.width, L.height);
}

export function recordJarBack(): SkPicture {
  return record(c => {
    c.drawOval(rect(27, 707, 336, 22), fill('rgba(90,52,24,0.22)'));
    c.drawPath(
      path('M24 256 V676 A40 40 0 0 0 64 716 H326 A40 40 0 0 0 366 676 V256 Z'),
      fill('#000', linear(24, 0, 366, 0, [[0, 'rgba(230,255,244,0.46)'], [0.5, 'rgba(255,255,255,0.16)'], [1, 'rgba(216,245,233,0.44)']])),
    );
    c.drawPath(
      path('M33 264 V674 A30 30 0 0 0 63 704 H327 A30 30 0 0 0 357 674 V264 Z'),
      fill('#000', linear(0, 264, 0, 704, [[0, 'rgba(255,255,255,0.08)'], [1, 'rgba(201,238,223,0.34)']])),
    );
    c.drawPath(path('M28 258 Q195 246 362 258'), stroke('rgba(255,255,255,0.6)', 2));
    c.drawOval(rect(43, 691, 304, 16), fill('rgba(255,255,255,0.16)'));
    c.drawOval(rect(43, 691, 304, 16), stroke('rgba(255,255,255,0.38)', 1));
    c.drawRRect(rrect(302, 300, 20, 360, 10), fill('rgba(255,255,255,0.1)'));
  }, WORLD_W, WORLD_H);
}

const STREAK: [number, string][] = [
  [0, 'rgba(255,255,255,0)'], [0.16, 'rgba(255,255,255,0.66)'], [0.62, 'rgba(255,255,255,0.26)'], [1, 'rgba(255,255,255,0)'],
];

export function recordJarFront(): SkPicture {
  return record(c => {
    c.drawRect(rect(24, 266, 9, 410), fill('#000', linear(24, 0, 33, 0, [[0, 'rgba(255,255,255,0.62)'], [1, 'rgba(255,255,255,0.05)']])));
    c.drawRect(rect(357, 266, 9, 410), fill('#000', linear(366, 0, 357, 0, [[0, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0.04)']])));
    c.drawPath(
      path('M24 672 V676 A40 40 0 0 0 64 716 H326 A40 40 0 0 0 366 676 V672 H357 V674 A30 30 0 0 1 327 704 H63 A30 30 0 0 1 33 674 V672 Z'),
      fill('#000', linear(0, 672, 0, 716, [[0, 'rgba(255,255,255,0.2)'], [1, 'rgba(184,232,214,0.6)']])),
    );
    const outline = path('M24 262 V676 A40 40 0 0 0 64 716 H326 A40 40 0 0 0 366 676 V262');
    c.drawPath(outline, stroke('rgba(46,107,90,0.22)', 3.5));
    c.drawPath(outline, stroke('rgba(255,255,255,0.9)', 2));
    c.drawRRect(rrect(41, 284, 13, 372, 6.5), fill('#000', linear(0, 284, 0, 656, STREAK)));
    const thin = fill('#000', linear(0, 300, 0, 550, STREAK));
    thin.setAlphaf(0.85);
    c.drawRRect(rrect(60, 300, 5, 250, 2.5), thin);
    const right = fill('#000', linear(0, 318, 0, 638, STREAK));
    right.setAlphaf(0.55);
    c.drawRRect(rrect(337, 318, 6, 320, 3), right);
    c.drawPath(path('M72 698 Q195 710 318 698'), stroke('rgba(255,255,255,0.6)', 2, true));
    c.drawRRect(rrect(16, 240, 358, 26, 13), fill('#000', linear(0, 240, 0, 266, [[0, 'rgba(255,255,255,0.96)'], [0.5, 'rgba(221,245,235,0.62)'], [1, 'rgba(255,255,255,0.88)']])));
    c.drawRRect(rrect(16, 240, 358, 26, 13), stroke('rgba(46,107,90,0.24)', 1.5));
    c.drawRRect(rrect(17, 241, 356, 24, 12), stroke('rgba(255,255,255,0.95)', 1));
    c.drawLine(32, 247, 246, 247, stroke('#FFFFFF', 3, true));
    c.drawLine(270, 247, 296, 247, stroke('rgba(255,255,255,0.85)', 3, true));
    c.drawLine(28, 262, 362, 262, stroke('rgba(46,107,90,0.12)', 2));
    const sparkle = fill('#FFFFFF');
    c.save(); c.translate(352, 302); c.drawPath(starPath(10), sparkle); c.restore();
    c.save(); c.translate(48, 688); c.drawPath(starPath(6), sparkle); c.restore();
  }, WORLD_W, WORLD_H);
}

// A frosted HUD slab: soft coloured shadow, darker 3px bottom edge, cream face, white rim.
export function slab(c: SkCanvas, x: number, y: number, w: number, h: number, r: number) {
  c.drawRRect(rrect(x, y + 8, w, h, r), shadowPaint('rgba(122,62,30,0.17)', 11));
  c.drawRRect(rrect(x, y, w, h, r), fill('rgba(236,214,186,0.92)'));
  c.drawRRect(rrect(x, y, w, h - 3, r), fill('rgba(255,250,242,0.93)'));
  c.drawRRect(rrect(x + 0.75, y + 0.75, w - 1.5, h - 1.5, r - 0.75), stroke('rgba(255,255,255,0.95)', 1.5));
}

export function recordHud(R: Resources): SkPicture {
  return record(c => {
    const sprite = fill('#FFFFFF');
    slab(c, 16, 46, 192, 68, 24);
    const lw = 58;
    const lh = (R.leaf.height() / R.leaf.width()) * lw;
    c.save(); c.rotate(-14, 29, 52); drawImage(c, R.leaf, 0, 30, lw, lh, sprite); c.restore();
    c.save(); c.translate(196, 112); c.scale(-1, 1); c.rotate(-24, 0, 0); drawImage(c, R.leaf, -20, -16, 40, (lh * 40) / lw, sprite); c.restore();
    slab(c, 246, 46, 66, 68, 22);
    slab(c, 16, 124, 358, 36, 18);
  }, WORLD_W, WORLD_H);
}
