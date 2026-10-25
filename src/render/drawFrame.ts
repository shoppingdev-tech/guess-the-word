// The per-frame renderer. Helpers are declared before their callers: the worklet transform turns
// declarations into constants, so hoisting does not apply on the UI thread.
// A worklet: it runs on the UI thread inside a derived value and records
// one Skia picture per frame straight from the game state, so no React render is ever involved.
import { ClipOp, FilterMode, MipmapMode, PointMode, Skia, TileMode, type SkCanvas, type SkImage } from '@shopify/react-native-skia';
import { DANGER_Y, HANG_Y, JAR, RADII, TIERS } from '../game/config';
import type { Fruit, Game } from '../game/engine';
import { PART_CONFETTI, PART_DROP, PART_SPARK } from '../game/fx';
import type { Kit } from './kit';
import type { StageLayout } from './layout';
import type { Resources } from './resources';

export type Press = { pause: number; shake: number; pop: number };

const DEG = 180 / Math.PI;

const rr = (x: number, y: number, w: number, h: number, r: number) => {
  'worklet';
  return { rect: { x, y, width: w, height: h }, rx: r, ry: r };
};

export function formatScore(n: number): string {
  'worklet';
  const s = Math.round(n).toString();
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return out;
}

const spring = (k: number, from: number, freq: number, decay: number) => {
  'worklet';
  return k >= 1 ? 1 : 1 - (1 - from) * Math.exp(-decay * k) * Math.cos(freq * k);
};

function sprite(c: SkCanvas, R: Resources, K: Kit, tier: number, x: number, y: number, rot: number, s: number, qx: number, qy: number) {
  'worklet';
  const sp = R.fruitSprites[tier - 1];
  c.save();
  c.translate(x, y);
  if (rot !== 0) c.rotate(rot * DEG, 0, 0);
  if (s !== 1) c.scale(s, s);
  if (qx !== 1 || qy !== 1) {
    const r = RADII[tier - 1];
    c.translate(0, r);
    c.scale(qx, qy);
    c.translate(0, -r);
  }
  c.drawImageRectOptions(R.fruits, sp.src, sp.dst, FilterMode.Linear, MipmapMode.None, K.sprite);
  c.restore();
}

function image(c: SkCanvas, K: Kit, img: SkImage, cx: number, cy: number, box: number) {
  'worklet';
  const iw = img.width();
  const ih = img.height();
  const k = box / Math.max(iw, ih);
  const w = iw * k;
  const h = ih * k;
  c.drawImageRectOptions(img, { x: 0, y: 0, width: iw, height: ih }, { x: cx - w / 2, y: cy - h / 2, width: w, height: h }, FilterMode.Linear, MipmapMode.None, K.sprite);
}

function text(c: SkCanvas, K: Kit, str: string, x: number, y: number, font: Resources['fonts']['score'], color: string, align: number) {
  'worklet';
  const w = font.getTextWidth(str);
  K.text.setColor(K.colors[color]);
  K.text.setAlphaf(1);
  c.drawText(str, x - w * align, y, K.text, font);
}

function spaced(c: SkCanvas, K: Kit, str: string, cx: number, y: number, font: Resources['fonts']['score'], color: string, gap: number, alpha: number) {
  'worklet';
  let total = 0;
  for (let i = 0; i < str.length; i++) total += font.getTextWidth(str[i]) + (i ? gap : 0);
  let x = cx - total / 2;
  K.text.setColor(K.colors[color]);
  K.text.setAlphaf(alpha);
  for (let i = 0; i < str.length; i++) {
    c.drawText(str[i], x, y, K.text, font);
    x += font.getTextWidth(str[i]) + gap;
  }
}

function drawFruits(c: SkCanvas, g: Game, R: Resources, K: Kit) {
  'worklet';
  const a = g.alpha;
  const bodies = g.world.bodies as Fruit[];
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    const x = b.px + (b.x - b.px) * a;
    const y = b.py + (b.y - b.py) * a;
    const ang = b.pa + (b.a - b.pa) * a;
    let s = 1 + 0.011 * Math.sin(g.gt * 0.0025 + b.phase);
    if (b.growing) s *= spring((g.gt - b.grow) / 230, 0.4, 9, 3.6);
    const q = g.gt - b.sqAt;
    const sq = q < 320 ? b.sq * Math.exp(-q / 95) * Math.cos(q / 46) : 0;
    let qx = 1 + 0.15 * sq;
    let qy = 1 - 0.15 * sq;
    if (b.falling) {
      qx *= 0.95;
      qy *= 1.07;
    }
    // faces stay readable: only 30% of the body's spin is drawn
    sprite(c, R, K, b.tier, x, y, ang * 0.3, s, qx, qy);
  }
}

function drawGhosts(c: SkCanvas, g: Game, R: Resources, K: Kit) {
  'worklet';
  for (let i = 0; i < g.ghosts.length; i++) {
    const gh = g.ghosts[i];
    const k = Math.min(1, (g.gt - gh.t0) / 90);
    const e = k * k;
    const x = gh.x0 + (gh.mx - gh.x0) * e;
    const y = gh.y0 + (gh.my - gh.y0) * e;
    const s = 1 - 0.3 * e;
    sprite(c, R, K, gh.tier, x, y, gh.a * 0.3, s, 1, 1);
    if (k > 0.5) {
      K.solid.setColor(K.colors['#FFFFFF']);
      K.solid.setAlphaf(((k - 0.5) / 0.5) * 0.75);
      c.drawCircle(x, y, RADII[gh.tier - 1] * s * 0.98, K.solid);
    }
  }
}

function drawParticles(c: SkCanvas, g: Game, K: Kit, confetti: boolean) {
  'worklet';
  const P = g.fx.parts;
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    if ((p.kind === PART_CONFETTI) !== confetti) continue;
    const k = (g.gt - p.t0) / p.life;
    if (k < 0 || k >= 1) continue;
    K.solid.setColor(K.colors[p.color] || K.colors['#FFFFFF']);
    c.save();
    c.translate(p.x, p.y);
    if (p.kind === PART_DROP) {
      const alpha = 1 - k * k;
      K.solid.setAlphaf(alpha);
      c.rotate(Math.atan2(p.vy, p.vx) * DEG, 0, 0);
      c.drawOval({ x: -p.size * 1.45, y: -p.size, width: p.size * 2.9, height: p.size * 2 }, K.solid);
      K.solid.setColor(K.colors['#FFFFFF']);
      K.solid.setAlphaf(0.7 * alpha);
      c.drawCircle(p.size * 0.35, -p.size * 0.35, p.size * 0.32, K.solid);
    } else if (p.kind === PART_SPARK) {
      K.solid.setAlphaf(1 - k);
      c.rotate(p.rot * DEG, 0, 0);
      const sz = p.size * (k < 0.3 ? k / 0.3 : 1 - ((k - 0.3) / 0.7) * 0.6);
      c.scale(sz, sz);
      c.drawPath(K.star, K.solid);
    } else {
      K.solid.setAlphaf(k > 0.75 ? (1 - k) / 0.25 : 1);
      c.rotate(p.rot * DEG, 0, 0);
      c.scale(1, Math.cos(p.flip + g.gt * p.vf));
      c.drawRect({ x: -p.size, y: -p.size * 0.45, width: p.size * 2, height: p.size * 0.9 }, K.solid);
    }
    c.restore();
  }
  if (confetti) return;
  for (let i = 0; i < g.fx.rings.length; i++) {
    const r = g.fx.rings[i];
    const k = (g.gt - r.t0) / r.life;
    if (k < 0 || k >= 1) continue;
    K.line.setColor(K.colors['#FFFFFF']);
    K.line.setAlphaf(0.85 * (1 - k));
    K.line.setStrokeWidth(4 * (1 - k) + 1);
    c.drawCircle(r.x, r.y, r.r * (0.5 + 1.5 * k), K.line);
    K.line.setColor(K.colors[r.color] || K.colors['#FFFFFF']);
    K.line.setAlphaf(0.5 * (1 - k));
    K.line.setStrokeWidth(2);
    c.drawCircle(r.x, r.y, r.r * (0.45 + 1.4 * k), K.line);
  }
  for (let i = 0; i < g.fx.flashes.length; i++) {
    const f = g.fx.flashes[i];
    const k = (g.gt - f.t0) / f.life;
    if (k < 0 || k >= 1) continue;
    K.flash.setAlphaf(0.9 * (1 - k));
    c.drawCircle(f.x, f.y, f.r * (0.9 + 0.2 * k), K.flash);
  }
}

function drawAim(c: SkCanvas, g: Game, K: Kit) {
  'worklet';
  const rc = RADII[g.cur - 1];
  const x = g.aimX;
  let yEnd: number = JAR.floor;
  const bodies = g.world.bodies;
  for (let i = 0; i < bodies.length; i++) {
    const f = bodies[i];
    const dx = Math.abs(f.x - x);
    if (dx < f.r) {
      const yy = f.y - Math.sqrt(f.r * f.r - dx * dx);
      if (yy < yEnd) yEnd = yy;
    }
  }
  const pts: { x: number; y: number }[] = [];
  const off = (g.gt * 0.03) % 12;
  for (let y = HANG_Y + rc + 10 + off; y < yEnd - 5; y += 12) pts.push({ x, y });
  if (pts.length === 0) return;
  c.drawPoints(PointMode.Points, pts, K.dotShade);
  c.drawPoints(PointMode.Points, pts, K.dotWhite);
}

function drawHang(c: SkCanvas, g: Game, R: Resources, K: Kit) {
  'worklet';
  const k = (g.gt - g.hangAt) / 300;
  const s = k <= 0 ? 0.3 : spring(k, 0.3, 10, 4);
  sprite(c, R, K, g.cur, g.aimX, HANG_Y + Math.sin(g.gt / 520) * 2, Math.sin(g.gt / 430) * 0.07, s, 1, 1);
}

function drawGlassEffects(c: SkCanvas, g: Game, K: Kit) {
  'worklet';
  const gk = (g.rt - g.goldAt) / 1100;
  if (gk >= 0 && gk < 1) {
    K.glow.setColor(K.colors['#FFC440']);
    K.glow.setAlphaf(0.95 * (gk < 0.25 ? gk / 0.25 : 1 - (gk - 0.25) / 0.75));
    K.glow.setStrokeWidth(6);
    c.drawRRect(rr(16, 240, 358, 26, 13), K.glow);
    c.drawPath(K.jarOutline, K.glow);
  }
  if (g.dangerOn) {
    const pulse = 0.5 + 0.5 * Math.sin((g.rt / 900) * Math.PI * 2);
    K.glow.setColor(K.colors['#FF4D5E']);
    K.glow.setAlphaf(0.35 + 0.45 * pulse);
    K.glow.setStrokeWidth(5);
    c.drawLine(40, DANGER_Y, 350, DANGER_Y, K.glow);
    K.dash.setColor(K.colors['#FF4D5E']);
    K.dash.setAlphaf(0.75 + 0.25 * pulse);
  } else {
    K.dash.setColor(K.colors['#FFFFFF']);
    K.dash.setAlphaf(0.3);
  }
  c.drawLine(40, DANGER_Y, 350, DANGER_Y, K.dash);
}

function button3D(c: SkCanvas, R: Resources, K: Kit, x: number, w: number, face: 'shakeFace' | 'popFace', edge: string, icon: SkImage, label: string, count: number, press: number, disabled: boolean) {
  'worklet';
  const y = 748;
  const h = 54;
  const dy = 3 * press;
  if (disabled) {
    K.layer.setAlphaf(0.55);
    c.saveLayer(K.layer);
  }
  K.solid.setColor(K.colors[edge]);
  K.solid.setAlphaf(1);
  c.drawRRect(rr(x, y + 5, w, h, 27), K.solid);
  c.save();
  c.translate(x, y + dy);
  K.shaded.setShader(K.shaders[face]);
  c.drawRRect(rr(0, 0, w, h, 27), K.shaded);
  K.line.setColor(K.colors['#FFFFFF']);
  K.line.setAlphaf(0.35);
  K.line.setStrokeWidth(2);
  c.drawLine(24, 2.5, w - 24, 2.5, K.line);
  image(c, K, icon, 27, 19, 50);
  const lw = R.fonts.button.getTextWidth(label);
  const lx = 52 + (w - 52 - 14 - lw) / 2;
  K.text.setColor(K.colors['#2B1D3A']);
  K.text.setAlphaf(0.28);
  c.drawText(label, lx, 37, K.text, R.fonts.button);
  text(c, K, label, lx, 35, R.fonts.button, '#FFFFFF', 0);
  K.solid.setColor(K.colors['#FFF6E9']);
  K.solid.setAlphaf(1);
  c.drawCircle(w - 17, 4, 13, K.solid);
  K.line.setColor(K.colors['#FFFFFF']);
  K.line.setAlphaf(1);
  c.drawCircle(w - 17, 4, 13, K.line);
  text(c, K, String(count), w - 17, 9, R.fonts.count, '#2B1D3A', 0.5);
  c.restore();
  if (disabled) c.restore();
}

function drawHud(c: SkCanvas, g: Game, R: Resources, K: Kit, press: Press) {
  'worklet';
  c.drawPicture(K.hud);
  // score with a bump on every change
  const bk = (g.rt - g.bumpAt) / 320;
  const bump = bk >= 0 && bk < 1 ? 1 + 0.14 * Math.sin(Math.PI * bk) : 1;
  c.save();
  c.translate(112, 70);
  c.scale(bump, bump);
  text(c, K, formatScore(g.shown), 0, 12, R.fonts.score, '#2B1D3A', 0.5);
  c.restore();
  // BEST pill
  const best = formatScore(Math.max(g.best, 0));
  const tw = R.fonts.pill.getTextWidth('BEST ' + best);
  const pw = 8 + 13 + 5 + tw + 10;
  c.save();
  c.translate(112 - pw / 2, 88);
  K.shaded.setShader(K.shaders.bestPill);
  c.drawRRect(rr(0, 0, pw, 19, 9.5), K.shaded);
  c.save();
  c.translate(8, 4);
  K.solid.setColor(K.colors['#FFD36B']);
  K.solid.setAlphaf(1);
  c.drawPath(K.crown, K.solid);
  c.restore();
  text(c, K, 'BEST ' + best, 26, 13.5, R.fonts.pill, '#FFFFFF', 0);
  c.restore();
  // NEXT bubble
  spaced(c, K, 'NEXT', 279, 64, R.fonts.label, '#5A3BD0', 1.6, 1);
  const hk = (g.rt - g.handAt) / 400;
  const hs = hk >= 0 && hk < 1 ? spring(hk, 0.3, 9, 4) : 1;
  c.save();
  c.translate(279, 90);
  c.scale(hs, hs);
  if (hk >= 0 && hk < 1) c.rotate(-20 * (1 - Math.min(1, hk * 2)), 0, 0);
  image(c, K, R.ui[g.next - 1], 0, 0, 42);
  c.restore();
  // pause button
  const pdy = 3 * press.pause;
  K.solid.setColor(K.colors['#4A2F9F']);
  K.solid.setAlphaf(1);
  c.drawCircle(349, 82, 25, K.solid);
  c.save();
  c.translate(349, 77 + pdy);
  K.shaded.setShader(K.shaders.pause);
  c.drawCircle(0, 0, 25, K.shaded);
  K.line.setColor(K.colors['#FFF6E9']);
  K.line.setAlphaf(1);
  K.line.setStrokeWidth(3);
  c.drawCircle(0, 0, 23.5, K.line);
  K.solid.setColor(K.colors['#FFFFFF']);
  c.drawRRect(rr(-7, -8, 5, 16, 2.5), K.solid);
  c.drawRRect(rr(2, -8, 5, 16, 2.5), K.solid);
  c.restore();
  // chain strip
  for (let t = 1; t <= 11; t++) {
    const cx = 35.5 + (t - 1) * 31.9;
    const cy = 142;
    const found = g.found[t];
    const bt = g.burstTier === t ? (g.rt - g.burstAt) / 700 : 2;
    c.save();
    c.translate(cx, cy);
    if (bt >= 0 && bt < 1) {
      const s = spring(bt, 0.2, 10, 4.5);
      c.scale(s, s);
      c.rotate(-30 * (1 - Math.min(1, bt * 1.6)), 0, 0);
    }
    if (found) {
      K.shaded.setShader(K.shaders.slotFound);
      c.drawCircle(0, 0, 13.5, K.shaded);
      image(c, K, R.ui[t - 1], 0, 0, 25);
    } else {
      K.shaded.setShader(K.shaders.slotMystery);
      c.drawCircle(0, 0, 13.5, K.shaded);
      text(c, K, '?', 0, 5.5, R.fonts.mystery, '#FFFFFF', 0.5);
      const ph = ((g.rt + t * 140) % 3400) / 3400;
      if (ph > 0.52 && ph < 0.82) {
        c.save();
        c.clipRRect(rr(-13.5, -13.5, 27, 27, 13.5), ClipOp.Intersect, true);
        c.translate(-22 + ((ph - 0.52) / 0.3) * 44, 0);
        c.rotate(25, 0, 0);
        K.shaded.setShader(K.shaders.shimmer);
        c.drawRect({ x: -5, y: -24, width: 10, height: 48 }, K.shaded);
        c.restore();
      }
    }
    if (found && t === g.top) {
      const pulse = 0.5 + 0.5 * Math.sin((g.rt / 1800) * Math.PI * 2);
      K.glow.setColor(K.colors['#FFB547']);
      K.glow.setAlphaf(0.45 + 0.45 * pulse);
      K.glow.setStrokeWidth(3);
      c.drawCircle(0, 0, 14.5, K.glow);
      K.line.setColor(K.colors['#FFB547']);
      K.line.setAlphaf(1);
      K.line.setStrokeWidth(2);
      c.drawCircle(0, 0, 14.5, K.line);
    }
    c.restore();
    if (bt >= 0 && bt < 1) {
      K.line.setColor(K.colors['#B79CFF']);
      K.line.setAlphaf(1 - bt);
      K.line.setStrokeWidth(2);
      c.drawCircle(cx, cy, 13.5 * (0.4 + 1.6 * bt), K.line);
    }
  }
  // power-ups
  button3D(c, R, K, 20, 168, 'shakeFace', '#4A2F9F', R.shakeIcon, 'SHAKE', g.shake, press.shake, g.shake <= 0 || g.over);
  button3D(c, R, K, 202, 168, 'popFace', '#B8460F', R.popIcon, 'POP', g.pop, press.pop, g.pop <= 0 || g.over);
}

function drawPopups(c: SkCanvas, g: Game, R: Resources, K: Kit) {
  'worklet';
  for (let i = 0; i < g.fx.popups.length; i++) {
    const p = g.fx.popups[i];
    const k = (g.gt - p.t0) / p.life;
    if (k < 0 || k >= 1) continue;
    c.save();
    if (!p.combo) {
      const y = p.y - 42 * (1 - Math.pow(1 - Math.min(1, k / 0.7), 3));
      const s = k < 0.12 ? 0.7 + 3.5 * k : 1.12 - Math.min(0.12, (k - 0.12) * 0.6);
      const alpha = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
      c.translate(p.x, y);
      c.scale(s, s);
      const w = R.fonts.popup.getTextWidth(p.text);
      K.textStroke.setStrokeWidth(5);
      K.textStroke.setAlphaf(alpha);
      c.drawText(p.text, -w / 2, 8, K.textStroke, R.fonts.popup);
      K.text.setColor(K.colors['#FFFFFF']);
      K.text.setAlphaf(alpha);
      c.drawText(p.text, -w / 2, 8, K.text, R.fonts.popup);
    } else {
      const s = spring(k, 0.4, 12, 5);
      const alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      c.translate(p.x, p.y - 10 * k);
      c.rotate(-7, 0, 0);
      c.scale(s, s);
      const w = R.fonts.combo.getTextWidth(p.text);
      K.textStroke.setStrokeWidth(7);
      K.textStroke.setAlphaf(alpha);
      c.drawText(p.text, -w / 2, 12, K.textStroke, R.fonts.combo);
      K.shaded.setShader(K.shaders.comboFill);
      K.shaded.setAlphaf(alpha);
      c.drawText(p.text, -w / 2, 12, K.shaded, R.fonts.combo);
      K.shaded.setAlphaf(1);
      const cw = R.fonts.comboSmall.getTextWidth('COMBO');
      K.textStroke.setStrokeWidth(4);
      c.drawText('COMBO', -cw / 2, 30, K.textStroke, R.fonts.comboSmall);
      K.text.setColor(K.colors['#FFFFFF']);
      K.text.setAlphaf(alpha);
      c.drawText('COMBO', -cw / 2, 30, K.text, R.fonts.comboSmall);
    }
    c.restore();
  }
}

function wrapFact(g: Game, R: Resources, tier: number): string[] {
  'worklet';
  const key = 'fact' + tier;
  const cached = g.cache[key] as string[] | undefined;
  if (cached) return cached;
  const words = TIERS[tier - 1].fact.split(' ');
  const lines: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const next = line ? line + ' ' + words[i] : words[i];
    if (R.fonts.cardFact.getTextWidth(next) > 226 && line) {
      lines.push(line);
      line = words[i];
    } else line = next;
  }
  if (line) lines.push(line);
  g.cache[key] = lines;
  return lines;
}

function makeDimShader(sx: number, sy: number, hole: number, far: number) {
  'worklet';
  return Skia.Shader.MakeRadialGradient({ x: sx, y: sy }, far, [
    Skia.Color('rgba(43,29,58,0)'), Skia.Color('rgba(43,29,58,0)'), Skia.Color('rgba(43,29,58,0.48)'), Skia.Color('rgba(43,29,58,0.48)'),
  ], [0, hole / far, (hole + 30) / far, 1], TileMode.Clamp);
}

function drawReveal(c: SkCanvas, g: Game, R: Resources, K: Kit, L: StageLayout) {
  'worklet';
  const t = g.revealTier;
  const k = g.rt - g.revealAt;
  if (!t || k < 0 || k > 1850) return;
  // dim everything but the new fruit
  const dimA = Math.min(1, k / 200) * (k > 1500 ? Math.max(0, 1 - (k - 1500) / 300) : 1);
  if (g.cache.dimKey !== g.revealAt) {
    const sx = L.ox + g.revealX * L.s;
    const sy = L.oy + g.revealY * L.s;
    const hole = RADII[t - 1] * 1.3 * L.s;
    const far = Math.hypot(L.width, L.height);
    g.cache.dimKey = g.revealAt;
    g.cache.dimShader = makeDimShader(sx, sy, hole, far);
  }
  K.dim.setShader(g.cache.dimShader as ReturnType<typeof makeDimShader>);
  K.dim.setAlphaf(dimA);
  c.drawRect({ x: 0, y: 0, width: L.width, height: L.height }, K.dim);
}

function drawCard(c: SkCanvas, g: Game, R: Resources, K: Kit) {
  'worklet';
  const t = g.revealTier;
  const k = g.rt - g.revealAt;
  if (!t || k < 0 || k > 1850) return;
  const p = Math.min(1, k / 340);
  const back = 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2);
  const out = k > 1550 ? (k - 1550) / 280 : 0;
  const alpha = Math.max(0, Math.min(1, p * 1.6) * (1 - out));
  const flipX = Math.max(0.02, Math.cos(((90 * (1 - back)) / DEG)));
  const lines = wrapFact(g, R, t);
  const H = 192 + (lines.length - 1) * 19 + 22;
  const top = (g.revealY > 470 ? 192 : 476) - 10 * out;
  const scale = 0.85 + 0.15 * Math.min(1.08, back);
  K.layer.setAlphaf(alpha);
  c.saveLayer(K.layer);
  c.translate(195, top + H / 2);
  c.scale(flipX * scale, scale);
  c.translate(-136, -H / 2);
  K.solid.setColor(K.colors['#9C7CFF']);
  K.solid.setAlphaf(0.35);
  c.drawRRect(rr(-6, -6, 284, H + 12, 36), K.solid);
  c.drawRRect(rr(0, 16, 272, H, 30), K.shadow);
  K.shaded.setShader(K.shaders.cardBody);
  c.drawRRect(rr(0, 0, 272, H, 30), K.shaded);
  c.save();
  c.clipRRect(rr(0, 0, 272, H, 30), ClipOp.Intersect, true);
  K.shaded.setShader(K.shaders.cardHeader);
  c.drawRect({ x: 0, y: 0, width: 272, height: 70 }, K.shaded);
  c.restore();
  K.line.setColor(K.colors['#FFFFFF']);
  K.line.setAlphaf(1);
  K.line.setStrokeWidth(3);
  c.drawRRect(rr(1.5, 1.5, 269, H - 3, 28.5), K.line);
  spaced(c, K, t === 11 ? 'FINAL TIER' : 'NEW DISCOVERY', 136, 26, R.fonts.pill, '#FFE7A3', 2.4, 1);
  image(c, K, R.ui[t - 1], 136, 84, 112);
  text(c, K, t === 11 ? 'Jackfruit reached!' : TIERS[t - 1].name + '!', 136, 168, R.fonts.cardTitle, '#2B1D3A', 0.5);
  for (let i = 0; i < lines.length; i++) text(c, K, lines[i], 136, 192 + i * 19, R.fonts.cardFact, '#6E6180', 0.5);
  c.save();
  c.translate(287, 13);
  K.shaded.setShader(K.shaders.badge);
  c.drawCircle(0, 0, 27, K.shaded);
  c.drawCircle(0, 0, 25.5, K.line);
  text(c, K, t + '/11', 0, 5.5, R.fonts.badge, '#2B1D3A', 0.5);
  c.restore();
  c.restore();
}

export function drawFrame(c: SkCanvas, g: Game, R: Resources, K: Kit, L: StageLayout, press: Press): void {
  'worklet';
  c.drawPicture(K.background);
  c.save();
  c.translate(L.ox, L.oy);
  c.scale(L.s, L.s);
  // the jar and everything in it shake together
  c.save();
  const js = (g.rt - g.jarShakeAt) / 560;
  if (js >= 0 && js < 1) {
    const a = Math.sin(js * Math.PI * 7) * (1 - js);
    c.translate(a * 7, 0);
    c.rotate(a * 1.6, 195, 740);
  }
  if (g.shakeAmp > 0.2) c.translate((Math.random() - 0.5) * 2 * g.shakeAmp, (Math.random() - 0.5) * 2 * g.shakeAmp);
  c.drawPicture(K.jarBack);
  drawFruits(c, g, R, K);
  drawGhosts(c, g, R, K);
  drawParticles(c, g, K, false);
  if (!g.over && g.gt >= g.cool) {
    drawAim(c, g, K);
    drawHang(c, g, R, K);
  }
  c.drawPicture(K.jarFront);
  drawGlassEffects(c, g, K);
  c.restore();
  c.restore();
  if (g.dangerOn) {
    const beat = (g.rt % 900) / 900;
    K.vignette.setAlphaf(beat < 0.14 ? 0.55 + 0.45 * (beat / 0.14) : beat < 0.28 ? 1 - 0.38 * ((beat - 0.14) / 0.14) : 0.62 + 0.3 * Math.sin(((beat - 0.28) / 0.72) * Math.PI));
    c.drawRect({ x: 0, y: 0, width: L.width, height: L.height }, K.vignette);
  }
  c.save();
  c.translate(L.ox, L.oy);
  c.scale(L.s, L.s);
  drawHud(c, g, R, K, press);
  c.restore();
  drawReveal(c, g, R, K, L);
  c.save();
  c.translate(L.ox, L.oy);
  c.scale(L.s, L.s);
  drawParticles(c, g, K, true);
  drawPopups(c, g, R, K);
  drawCard(c, g, R, K);
  c.restore();
}
