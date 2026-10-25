// Circle-only position-based physics for the jar. Every function is a worklet: the simulation runs
// on the UI thread so React work can never cost a frame. Velocities in the API are px per ms.
import { CORNER_R, GRAVITY, JAR, RADII, STEP_MS } from './config';

export type Body = {
  id: number;
  tier: number;
  r: number; // current radius (shrunk while a merged fruit grows in)
  x: number;
  y: number;
  ox: number; // position one substep ago (velocity is implicit, verlet style)
  oy: number;
  m: number;
  a: number; // rolling angle for rendering
  touching: boolean;
  hit: number; // speed lost during the last step, px/ms (landing impacts)
  merging: boolean;
  mark: number; // last contact stamp that paired this body for a merge
};

// `hits` collects same-tier contacts seen inside the solver during the last step, so fruits that
// touch and bounce apart within one step still merge.
export type World = { bodies: Body[]; sorted: Body[]; hits: Body[][]; nextId: number; stamp: number };

const SUBSTEPS = 4;
const ITERS = 2;
const SUB_DT = STEP_MS / SUBSTEPS;
const G = GRAVITY * SUB_DT * SUB_DT;
const AIR = 0.9993;
const FRICTION = 0.14;
const FLOOR_FRICTION = 0.1;
const MAX_MOVE = 4; // px per substep, keeps deep overlaps from launching fruit
const TOUCH_SLOP = 0.6;
const H = Math.SQRT1_2;
// 45 degree planes standing in for the rounded inner bottom corners: point + inward normal
const CHAMFERS = [
  { px: JAR.left + CORNER_R - CORNER_R * H, py: JAR.floor - CORNER_R + CORNER_R * H, nx: H, ny: -H },
  { px: JAR.right - CORNER_R + CORNER_R * H, py: JAR.floor - CORNER_R + CORNER_R * H, nx: -H, ny: -H },
];

const massOf = (tier: number, r: number): number => {
  'worklet';
  return r * r * (1 + 0.14 * (tier - 1));
};

export function createWorld(): World {
  'worklet';
  return { bodies: [], sorted: [], hits: [], nextId: 1, stamp: 0 };
}

export function addBody(w: World, tier: number, x: number, y: number, a = 0): Body {
  'worklet';
  const r = RADII[tier - 1];
  const b: Body = { id: w.nextId++, tier, r, x, y, ox: x, oy: y, m: massOf(tier, r), a, touching: false, hit: 0, merging: false, mark: 0 };
  w.bodies.push(b);
  w.sorted.push(b);
  return b;
}

export function removeBody(w: World, b: Body): void {
  'worklet';
  const i = w.bodies.indexOf(b);
  if (i >= 0) w.bodies.splice(i, 1);
  const j = w.sorted.indexOf(b);
  if (j >= 0) w.sorted.splice(j, 1);
}

export function setVelocity(b: Body, vx: number, vy: number): void {
  'worklet';
  b.ox = b.x - vx * SUB_DT;
  b.oy = b.y - vy * SUB_DT;
}

export function velocityOf(b: Body): { vx: number; vy: number } {
  'worklet';
  return { vx: (b.x - b.ox) / SUB_DT, vy: (b.y - b.oy) / SUB_DT };
}

export function speedOf(b: Body): number {
  'worklet';
  return Math.sqrt((b.x - b.ox) * (b.x - b.ox) + (b.y - b.oy) * (b.y - b.oy)) / SUB_DT;
}

export function setRadiusScale(b: Body, s: number): void {
  'worklet';
  b.r = RADII[b.tier - 1] * s;
  b.m = massOf(b.tier, b.r);
}

function sortByLeftEdge(list: Body[]): void {
  'worklet';
  for (let i = 1; i < list.length; i++) {
    const b = list[i];
    const key = b.x - b.r;
    let j = i - 1;
    while (j >= 0 && list[j].x - list[j].r > key) {
      list[j + 1] = list[j];
      j--;
    }
    list[j + 1] = b;
  }
}

function solveWalls(b: Body, last: boolean): void {
  'worklet';
  if (b.x < JAR.left + b.r) { b.x = JAR.left + b.r; b.touching = true; }
  else if (b.x > JAR.right - b.r) { b.x = JAR.right - b.r; b.touching = true; }
  let floor = false;
  if (b.y > JAR.floor - b.r) { b.y = JAR.floor - b.r; b.touching = true; floor = true; }
  for (let k = 0; k < CHAMFERS.length; k++) {
    const c = CHAMFERS[k];
    const s = (b.x - c.px) * c.nx + (b.y - c.py) * c.ny - b.r;
    if (s < 0) { b.x -= s * c.nx; b.y -= s * c.ny; b.touching = true; floor = true; }
  }
  if (last && floor) b.ox += (b.x - b.ox) * FLOOR_FRICTION;
}

function solvePairs(w: World, last: boolean): void {
  'worklet';
  const list = w.sorted;
  const n = list.length;
  for (let i = 0; i < n; i++) {
    const a = list[i];
    const reach = a.x + a.r;
    for (let j = i + 1; j < n; j++) {
      const b = list[j];
      if (b.x - b.r > reach) break;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const rr = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 < 1e-9) continue;
      if (a.tier === b.tier && !a.merging && !b.merging && a.mark !== w.stamp && b.mark !== w.stamp) {
        a.mark = w.stamp;
        b.mark = w.stamp;
        w.hits.push([a, b]);
      }
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const pen = rr - d;
      const wa = b.m / (a.m + b.m);
      const wb = 1 - wa;
      a.x -= nx * pen * wa; a.y -= ny * pen * wa;
      b.x += nx * pen * wb; b.y += ny * pen * wb;
      a.touching = true; b.touching = true;
      if (last) {
        // damp the relative sliding so piles grip instead of skating
        const rvx = (b.x - b.ox) - (a.x - a.ox);
        const rvy = (b.y - b.oy) - (a.y - a.oy);
        const vn = rvx * nx + rvy * ny;
        const tx = (rvx - vn * nx) * FRICTION;
        const ty = (rvy - vn * ny) * FRICTION;
        b.ox += tx * wb; b.oy += ty * wb;
        a.ox -= tx * wa; a.oy -= ty * wa;
      }
    }
  }
}

// Advance the world by one fixed STEP_MS.
export function stepWorld(w: World): void {
  'worklet';
  const bodies = w.bodies;
  const n = bodies.length;
  w.stamp++;
  w.hits = [];
  const before = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const b = bodies[i];
    before[i] = Math.sqrt((b.x - b.ox) * (b.x - b.ox) + (b.y - b.oy) * (b.y - b.oy));
  }
  for (let s = 0; s < SUBSTEPS; s++) {
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      let vx = (b.x - b.ox) * AIR;
      let vy = (b.y - b.oy) * AIR;
      const v = Math.sqrt(vx * vx + vy * vy);
      if (v > MAX_MOVE) { vx *= MAX_MOVE / v; vy *= MAX_MOVE / v; }
      if (b.touching) b.a += vx / b.r;
      b.ox = b.x; b.oy = b.y;
      b.x += vx; b.y += vy + G;
      b.touching = false;
    }
    sortByLeftEdge(w.sorted);
    for (let it = 0; it < ITERS; it++) {
      const last = it === ITERS - 1;
      solvePairs(w, last);
      for (let i = 0; i < n; i++) solveWalls(bodies[i], last);
    }
  }
  for (let i = 0; i < n; i++) {
    const b = bodies[i];
    const after = Math.sqrt((b.x - b.ox) * (b.x - b.ox) + (b.y - b.oy) * (b.y - b.oy));
    b.hit = Math.max(0, before[i] - after) / SUB_DT;
  }
}

// Same-tier fruits that touched during the last step or rest touching now; each fruit appears at
// most once per step.
export function sameTierContacts(w: World): Body[][] {
  'worklet';
  const out: Body[][] = [];
  for (let i = 0; i < w.hits.length; i++) {
    const pair = w.hits[i];
    if (!pair[0].merging && !pair[1].merging) out.push(pair);
  }
  w.hits = [];
  const list = w.sorted;
  const stamp = w.stamp;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.merging || a.mark === stamp) continue;
    const reach = a.x + a.r + TOUCH_SLOP;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.x - b.r > reach) break;
      if (b.tier !== a.tier || b.merging || b.mark === stamp) continue;
      const rr = a.r + b.r + TOUCH_SLOP;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (dx * dx + dy * dy < rr * rr) {
        a.mark = stamp;
        b.mark = stamp;
        out.push([a, b]);
        break;
      }
    }
  }
  return out;
}
