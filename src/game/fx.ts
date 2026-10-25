// Juice: droplets, sparks, confetti, rings, flashes and floating labels. Worklets, UI thread.
import { TIERS } from './config';

export const PART_DROP = 0;
export const PART_SPARK = 1;
export const PART_CONFETTI = 2;

export type Particle = {
  kind: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  drag: number;
  rot: number;
  vr: number;
  flip: number;
  vf: number;
  size: number;
  color: string;
  t0: number;
  life: number;
};
export type Ring = { x: number; y: number; r: number; color: string; t0: number; life: number };
export type Flash = { x: number; y: number; r: number; t0: number; life: number };
export type Popup = { combo: boolean; x: number; y: number; text: string; t0: number; life: number };
export type Fx = { parts: Particle[]; rings: Ring[]; flashes: Flash[]; popups: Popup[] };

const MAX_PARTS = 320;
const CONFETTI_COLORS = ['#FFD36B', '#FFFFFF', '#9C7CFF', '#FF7A9C'];

export function createFx(): Fx {
  'worklet';
  return { parts: [], rings: [], flashes: [], popups: [] };
}

function push(fx: Fx, p: Particle): void {
  'worklet';
  if (fx.parts.length >= MAX_PARTS) fx.parts.shift();
  fx.parts.push(p);
}

// merge splash: flash + ring + 12-24 droplets (more with combos) + a few sparks
export function spawnBurst(fx: Fx, gt: number, x: number, y: number, tier: number, r: number, mult: number): void {
  'worklet';
  const info = TIERS[tier - 1];
  fx.flashes.push({ x, y, r, t0: gt, life: 70 });
  fx.rings.push({ x, y, r, color: info.color, t0: gt, life: 320 });
  const n = Math.min(42, Math.round((12 + tier * 1.1) * mult));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const sp = (0.1 + Math.random() * 0.24) * (0.85 + r / 70);
    push(fx, {
      kind: PART_DROP, x: x + Math.cos(a) * r * 0.45, y: y + Math.sin(a) * r * 0.45,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.1, g: 0.0011, drag: 1, rot: 0, vr: 0, flip: 0, vf: 0,
      size: 2 + Math.random() * (2.2 + r / 22), color: Math.random() < 0.72 ? info.juice : info.color,
      t0: gt, life: 360 + Math.random() * 200,
    });
  }
  for (let i = 0, m = 4 + Math.round(tier / 2); i < m; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 0.05 + Math.random() * 0.12;
    push(fx, {
      kind: PART_SPARK, x: x + Math.cos(a) * r * 0.7, y: y + Math.sin(a) * r * 0.7,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, drag: 1, rot: Math.random() * 3, vr: 0.004, flip: 0, vf: 0,
      size: 4 + Math.random() * 5, color: Math.random() < 0.5 ? '#FFFFFF' : '#FFE27A', t0: gt, life: 420 + Math.random() * 200,
    });
  }
}

export function spawnConfetti(fx: Fx, gt: number, x: number, y: number, color: string, n: number): void {
  'worklet';
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
    const sp = 0.25 + Math.random() * 0.45;
    push(fx, {
      kind: PART_CONFETTI, x: x + (Math.random() - 0.5) * 60, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      g: 0.0009, drag: 0.965, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.02,
      flip: Math.random() * 6.28, vf: 0.01 + Math.random() * 0.012, size: 3.5 + Math.random() * 3,
      color: i % 5 === 0 ? color : CONFETTI_COLORS[i % CONFETTI_COLORS.length], t0: gt, life: 1400 + Math.random() * 600,
    });
  }
}

export function spawnPopup(fx: Fx, gt: number, x: number, y: number, text: string, combo: boolean): void {
  'worklet';
  // a new combo label replaces the previous one so they never stack up
  if (combo) fx.popups = fx.popups.filter(p => !p.combo);
  fx.popups.push({ combo, x, y, text, t0: gt, life: combo ? 900 : 720 });
}

export function updateFx(fx: Fx, gt: number, dt: number): void {
  'worklet';
  const P = fx.parts;
  let j = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    if (gt - p.t0 >= p.life) continue;
    if (p.drag !== 1) {
      const k = Math.pow(p.drag, dt / 16.7);
      p.vx *= k;
      p.vy *= k;
    }
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    P[j++] = p;
  }
  P.length = j;
  fx.rings = fx.rings.filter(r => gt - r.t0 < r.life);
  fx.flashes = fx.flashes.filter(f => gt - f.t0 < f.life);
  fx.popups = fx.popups.filter(p => gt - p.t0 < p.life);
}
