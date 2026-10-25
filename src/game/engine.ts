// Game rules on top of the jar physics: drops, merges, combos, discoveries, danger and game over.
// Everything is a worklet and runs on the UI thread; React hears about it through `drainEvents`.
import {
  COMBO_WINDOW_MS,
  DANGER_NEAR,
  DANGER_Y,
  DROP_COOLDOWN_MS,
  FRESH_DROP_MS,
  GAME_OVER_HOLD_MS,
  GROW_MS,
  HANG_Y,
  JACKFRUIT_BONUS,
  JAR,
  JAR_W,
  MAX_TIER,
  MERGE_SLIDE_MS,
  RADII,
  STEP_MS,
  TIERS,
  mergePoints,
} from './config';
import { createFx, spawnBurst, spawnConfetti, spawnPopup, updateFx, type Fx } from './fx';
import {
  addBody,
  createWorld,
  removeBody,
  sameTierContacts,
  setRadiusScale,
  setVelocity,
  stepWorld,
  velocityOf,
  type Body,
  type World,
} from './physics';
import { pickTier, rngNext } from './rng';

export type Fruit = Body & {
  born: number;
  phase: number;
  growing: boolean;
  grow: number;
  rs: number;
  sq: number;
  sqAt: number;
  falling: boolean;
  px: number; // position before the last physics step, for render interpolation
  py: number;
  pa: number;
};

export type Ghost = { tier: number; x0: number; y0: number; a: number; mx: number; my: number; t0: number };

type Timer = { at: number; kind: number; tier: number; x: number; y: number; id: number };
const T_FINISH = 0;
const T_NUDGE = 1;
const T_POPOUT = 2;
const T_OVER = 3;

export type SoundName = 'drop' | 'land' | 'squish' | 'merge' | 'discover' | 'over' | 'shake' | 'pop' | 'beat';
export type HapticLevel = 'light' | 'medium' | 'heavy';

export type GameEvent =
  | { type: 'reset'; score: number; best: number; cur: number; next: number; found: number[]; top: number; shake: number; pop: number }
  | { type: 'score'; score: number }
  | { type: 'hand'; cur: number; next: number }
  | { type: 'discover'; tier: number; celebrate: boolean; x: number; y: number }
  | { type: 'top'; tier: number }
  | { type: 'danger'; on: boolean }
  | { type: 'gold' }
  | { type: 'jarShake' }
  | { type: 'powerups'; shake: number; pop: number }
  | { type: 'over'; score: number; best: number; newBest: boolean; found: number[] }
  | { type: 'haptic'; level: HapticLevel }
  | { type: 'sound'; name: SoundName; tier: number; combo: number; strength: number };

export type Game = {
  world: World;
  fx: Fx;
  ghosts: Ghost[];
  timers: Timer[];
  events: GameEvent[];
  seed: number;
  rs: number; // rng state
  gt: number; // game clock, ms (slows during discoveries)
  acc: number;
  alpha: number;
  slow: number;
  score: number;
  best: number;
  startBest: number;
  cur: number;
  next: number;
  found: boolean[];
  top: number;
  shake: number;
  pop: number;
  combo: number;
  lastMerge: number;
  cool: number;
  hangAt: number;
  aimX: number;
  aimTarget: number;
  paused: boolean;
  over: boolean;
  overT: number;
  dangerOn: boolean;
  beatAt: number;
  landAt: number;
  shakeAmp: number;
  autoplay: boolean;
  autoAt: number;
  autoAim: boolean;
  // presentation state read by the Skia HUD (rt is the real-time clock, unaffected by slow-mo)
  rt: number;
  shown: number;
  bumpAt: number;
  handAt: number;
  burstTier: number;
  burstAt: number;
  revealTier: number;
  revealX: number;
  revealY: number;
  revealAt: number;
  goldAt: number;
  jarShakeAt: number;
  cache: Record<string, unknown>; // UI-thread scratch for the renderer (shaders, wrapped text)
};

export type GameOptions = { seed: number; best: number; autoplay?: boolean };

const emit = (g: Game, e: GameEvent): void => {
  'worklet';
  g.events.push(e);
};

const sound = (g: Game, name: SoundName, tier = 0, combo = 0, strength = 1): void => {
  'worklet';
  g.events.push({ type: 'sound', name, tier, combo, strength });
};

const haptic = (g: Game, level: HapticLevel): void => {
  'worklet';
  g.events.push({ type: 'haptic', level });
};

const clampAim = (x: number, r: number): number => {
  'worklet';
  return Math.max(JAR.left + r + 1, Math.min(JAR.right - r - 1, x));
};

function addFruit(g: Game, tier: number, x: number, y: number, a: number, born: number): Fruit {
  'worklet';
  const b = addBody(g.world, tier, x, y, a) as Fruit;
  b.born = born;
  b.phase = Math.random() * Math.PI * 2;
  b.growing = false;
  b.grow = 0;
  b.rs = 1;
  b.sq = 0;
  b.sqAt = -1e9;
  b.falling = false;
  b.px = x;
  b.py = y;
  b.pa = a;
  return b;
}

function dealHand(g: Game): void {
  'worklet';
  g.cur = pickTier(rngNext(g));
  g.next = pickTier(rngNext(g));
  g.found = [];
  for (let t = 0; t <= MAX_TIER; t++) g.found.push(false);
  g.found[g.cur] = true;
  g.found[g.next] = true;
  g.top = Math.max(g.cur, g.next);
  const found: number[] = [];
  for (let t = 1; t <= MAX_TIER; t++) if (g.found[t]) found.push(t);
  emit(g, { type: 'reset', score: g.score, best: g.best, cur: g.cur, next: g.next, found, top: g.top, shake: g.shake, pop: g.pop });
}

function resetRun(g: Game, seed: number): void {
  'worklet';
  g.world = createWorld();
  g.fx = createFx();
  g.ghosts = [];
  g.timers = [];
  g.seed = seed;
  g.rs = seed >>> 0;
  g.gt = 0;
  g.acc = 0;
  g.alpha = 1;
  g.slow = -1000;
  g.score = 0;
  g.startBest = g.best;
  g.shake = 2;
  g.pop = 3;
  g.combo = 0;
  g.lastMerge = -1e9;
  g.cool = 0;
  g.hangAt = -1e9;
  g.aimX = (JAR.left + JAR.right) / 2;
  g.aimTarget = g.aimX;
  g.paused = false;
  g.over = false;
  g.overT = 0;
  g.dangerOn = false;
  g.beatAt = -1e9;
  g.landAt = -1e9;
  g.shakeAmp = 0;
  g.autoAt = 600;
  g.autoAim = false;
  g.rt = 0;
  g.shown = 0;
  g.bumpAt = -1e9;
  g.handAt = -1e9;
  g.burstTier = 0;
  g.burstAt = -1e9;
  g.revealTier = 0;
  g.revealX = 0;
  g.revealY = 0;
  g.revealAt = -1e9;
  g.goldAt = -1e9;
  g.jarShakeAt = -1e9;
  dealHand(g);
}

export function createGame(o: GameOptions): Game {
  'worklet';
  const g = { events: [], best: o.best, autoplay: !!o.autoplay, cache: {} } as unknown as Game;
  resetRun(g, o.seed);
  return g;
}

export function restartGame(g: Game, seed: number): void {
  'worklet';
  resetRun(g, seed);
}

export function setPaused(g: Game, on: boolean): void {
  'worklet';
  g.paused = on;
}

// Place a settled fruit (presets, tests). It counts for the danger line right away.
export function spawnFruit(g: Game, tier: number, x: number, y: number, a = 0): Fruit {
  'worklet';
  return addFruit(g, tier, x, y, a, g.gt - 5000);
}

export function setAim(g: Game, x: number): void {
  'worklet';
  g.aimTarget = clampAim(x, RADII[g.cur - 1]);
}

export function canDrop(g: Game): boolean {
  'worklet';
  return !g.paused && !g.over && g.gt >= g.cool;
}

export function dropFruit(g: Game): boolean {
  'worklet';
  if (!canDrop(g)) return false;
  // drop from where the fruit is drawn, so it never jumps
  const x = clampAim(g.aimX, RADII[g.cur - 1]);
  const b = addFruit(g, g.cur, x, HANG_Y, 0, g.gt);
  b.falling = true;
  setVelocity(b, 0, 0.13);
  g.cool = g.gt + DROP_COOLDOWN_MS;
  g.hangAt = g.cool;
  g.cur = g.next;
  g.next = pickTier(rngNext(g));
  g.aimTarget = clampAim(g.aimTarget, RADII[g.cur - 1]);
  g.handAt = g.rt;
  emit(g, { type: 'hand', cur: g.cur, next: g.next });
  if (!g.found[g.next]) {
    g.found[g.next] = true;
    g.burstTier = g.next;
    g.burstAt = g.rt;
    emit(g, { type: 'discover', tier: g.next, celebrate: false, x: 0, y: 0 });
  }
  sound(g, 'drop');
  haptic(g, 'light');
  return true;
}

export function applyPop(g: Game): boolean {
  'worklet';
  if (g.paused || g.over || g.pop <= 0) return false;
  let tgt: Fruit | null = null;
  for (const b of g.world.bodies as Fruit[]) {
    if (b.growing) continue;
    if (!tgt || b.tier < tgt.tier || (b.tier === tgt.tier && b.y < tgt.y)) tgt = b;
  }
  if (!tgt) return false;
  g.pop -= 1;
  removeBody(g.world, tgt);
  spawnBurst(g.fx, g.gt, tgt.x, tgt.y, tgt.tier, RADII[tgt.tier - 1], 1.4);
  emit(g, { type: 'powerups', shake: g.shake, pop: g.pop });
  sound(g, 'pop');
  haptic(g, 'light');
  return true;
}

export function applyShake(g: Game): boolean {
  'worklet';
  if (g.paused || g.over || g.shake <= 0) return false;
  g.shake -= 1;
  for (const b of g.world.bodies) {
    const v = velocityOf(b);
    setVelocity(b, v.vx + (Math.random() - 0.5) * 0.42, v.vy - (0.15 + Math.random() * 0.27) * (10 / (7 + b.tier)));
  }
  g.jarShakeAt = g.rt;
  emit(g, { type: 'powerups', shake: g.shake, pop: g.pop });
  emit(g, { type: 'jarShake' });
  sound(g, 'shake');
  haptic(g, 'medium');
  return true;
}

export function drainEvents(g: Game): GameEvent[] {
  'worklet';
  const out = g.events;
  g.events = [];
  return out;
}

function handleImpacts(g: Game): void {
  'worklet';
  for (const b of g.world.bodies as Fruit[]) {
    if (b.falling && b.touching) b.falling = false;
    if (b.hit < 0.09 || g.gt - b.sqAt < 150) continue;
    b.sqAt = g.gt;
    b.sq = Math.min(1, b.hit / 0.4);
    if (b.hit > 0.13 && g.gt - g.landAt > 60) {
      g.landAt = g.gt;
      sound(g, 'land', b.tier, 0, Math.min(1, b.hit / 0.48));
    }
  }
}

function collectMerges(g: Game): void {
  'worklet';
  const pairs = sameTierContacts(g.world);
  for (let i = 0; i < pairs.length; i++) {
    const a = pairs[i][0];
    const b = pairs[i][1];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    a.merging = true;
    b.merging = true;
    removeBody(g.world, a);
    removeBody(g.world, b);
    g.ghosts.push({ tier: a.tier, x0: a.x, y0: a.y, a: a.a, mx, my, t0: g.gt });
    g.ghosts.push({ tier: b.tier, x0: b.x, y0: b.y, a: b.a, mx, my, t0: g.gt });
    g.timers.push({ at: g.gt + MERGE_SLIDE_MS, kind: T_FINISH, tier: a.tier, x: mx, y: my, id: 0 });
    sound(g, 'squish', a.tier);
  }
}

function finishMerge(g: Game, t: number, x: number, y: number): void {
  'worklet';
  const made = t < MAX_TIER;
  const nt = made ? t + 1 : MAX_TIER;
  const r = RADII[nt - 1];
  g.combo = g.gt - g.lastMerge < COMBO_WINDOW_MS ? g.combo + 1 : 1;
  g.lastMerge = g.gt;
  const pts = Math.round((made ? mergePoints(nt) : JACKFRUIT_BONUS) * (g.combo >= 4 ? 1.5 : 1));
  g.score += pts;
  g.bumpAt = g.rt;
  emit(g, { type: 'score', score: g.score });
  if (made) {
    const b = addFruit(g, nt, x, y, 0, g.gt);
    b.growing = true;
    b.grow = g.gt;
    b.rs = 0.4;
    setRadiusScale(b, 0.4);
    setVelocity(b, 0, -0.14);
  }
  spawnBurst(g.fx, g.gt, x, y, nt, r, 1 + 0.3 * Math.min(6, g.combo - 1));
  spawnPopup(g.fx, g.gt, x, y - r * 0.5, '+' + pts, false);
  if (g.combo >= 2) {
    const cx = Math.max(64, Math.min(326, x + (x < 195 ? r + 26 : -r - 26)));
    spawnPopup(g.fx, g.gt, cx, Math.max(214, y - r - 18), 'x' + g.combo, true);
  }
  g.timers.push({ at: g.gt + 30, kind: T_NUDGE, tier: nt, x, y, id: 0 });
  g.shakeAmp = Math.max(g.shakeAmp, 1 + 4 * (nt / MAX_TIER));
  sound(g, 'merge', t, g.combo);
  haptic(g, nt >= 10 ? 'heavy' : g.combo >= 3 ? 'medium' : 'light');
  if (g.combo >= 4) {
    g.goldAt = g.rt;
    emit(g, { type: 'gold' });
  }
  if (made && nt > g.top) {
    g.top = nt;
    emit(g, { type: 'top', tier: nt });
  }
  if (made && !g.found[nt]) {
    g.found[nt] = true;
    g.slow = 400;
    g.burstTier = nt;
    g.burstAt = g.rt;
    g.revealTier = nt;
    g.revealX = x;
    g.revealY = y;
    g.revealAt = g.rt;
    spawnConfetti(g.fx, g.gt, 195, (y > 470 ? 192 : 476) + 24, TIERS[nt - 1].color, nt === MAX_TIER ? 110 : 48);
    emit(g, { type: 'discover', tier: nt, celebrate: true, x, y });
    sound(g, 'discover', nt);
    haptic(g, 'medium');
  }
}

function nudge(g: Game, x: number, y: number, r: number): void {
  'worklet';
  for (const b of g.world.bodies as Fruit[]) {
    if (b.growing) continue;
    const dx = b.x - x;
    const dy = b.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const range = r + b.r + 24;
    if (dist > range) continue;
    const k = 0.09 * (1 - dist / range);
    const v = velocityOf(b);
    setVelocity(b, v.vx + (dx / dist) * k, v.vy + (dy / dist) * k - 0.35 * k);
  }
}

function startGameOver(g: Game): void {
  'worklet';
  g.over = true;
  g.dangerOn = false;
  g.jarShakeAt = g.rt;
  g.shakeAmp = Math.max(g.shakeAmp, 4);
  emit(g, { type: 'danger', on: false });
  sound(g, 'over');
  haptic(g, 'heavy');
  const order = (g.world.bodies as Fruit[]).slice().sort((a, b) => a.y - b.y);
  for (let i = 0; i < order.length; i++) {
    g.timers.push({ at: g.gt + 260 + i * 40, kind: T_POPOUT, tier: 0, x: 0, y: 0, id: order[i].id });
  }
  g.timers.push({ at: g.gt + 600 + order.length * 40, kind: T_OVER, tier: 0, x: 0, y: 0, id: 0 });
}

function popOut(g: Game, id: number, n: number): void {
  'worklet';
  const b = g.world.bodies.find(x => x.id === id);
  if (!b) return;
  removeBody(g.world, b);
  spawnBurst(g.fx, g.gt, b.x, b.y, b.tier, RADII[b.tier - 1], 0.5);
  g.score += b.tier * 2;
  g.bumpAt = g.rt;
  emit(g, { type: 'score', score: g.score });
  if (n % 3 === 0) sound(g, 'pop');
}

function runTimers(g: Game): void {
  'worklet';
  if (g.timers.length === 0) return;
  const due: Timer[] = [];
  const keep: Timer[] = [];
  for (const tm of g.timers) (tm.at <= g.gt ? due : keep).push(tm);
  if (due.length === 0) return;
  g.timers = keep;
  due.sort((a, b) => a.at - b.at);
  for (let i = 0; i < due.length; i++) {
    const tm = due[i];
    if (tm.kind === T_FINISH) finishMerge(g, tm.tier, tm.x, tm.y);
    else if (tm.kind === T_NUDGE) nudge(g, tm.x, tm.y, RADII[tm.tier - 1]);
    else if (tm.kind === T_POPOUT) popOut(g, tm.id, i);
    else if (tm.kind === T_OVER) {
      const newBest = g.score > g.startBest;
      g.best = Math.max(g.best, g.score);
      const found: number[] = [];
      for (let t = 1; t <= MAX_TIER; t++) if (g.found[t]) found.push(t);
      emit(g, { type: 'over', score: g.score, best: g.best, newBest, found });
    }
  }
}

function updateFruits(g: Game): void {
  'worklet';
  for (const b of g.world.bodies as Fruit[]) {
    if (b.growing) {
      const k = (g.gt - b.grow) / GROW_MS;
      // the body grows smoothly so neighbours are pushed aside, not launched
      const want = k >= 1 ? 1 : Math.min(1, 0.4 + 0.6 * (1 - Math.pow(1 - Math.min(1, k / 0.6), 3)));
      if (Math.abs(want - b.rs) > 0.003 || k >= 1) {
        b.rs = want;
        setRadiusScale(b, want);
      }
      if (k >= 1) b.growing = false;
    }
    if (b.falling && g.gt - b.born > 1500) b.falling = false;
  }
}

function checkDanger(g: Game, dt: number): void {
  'worklet';
  let top = 1e9;
  for (const b of g.world.bodies as Fruit[]) {
    if (g.gt - b.born < FRESH_DROP_MS || b.growing) continue;
    if (b.y - b.r < top) top = b.y - b.r;
  }
  const near = top < DANGER_NEAR;
  if (near !== g.dangerOn) {
    g.dangerOn = near;
    emit(g, { type: 'danger', on: near });
  }
  if (top < DANGER_Y) {
    g.overT += dt;
    if (g.gt - g.beatAt > 820) {
      g.beatAt = g.gt;
      sound(g, 'beat');
      haptic(g, 'light');
    }
    if (g.overT > GAME_OVER_HOLD_MS) startGameOver(g);
  } else {
    g.overT = 0;
  }
}

function autoPlay(g: Game): void {
  'worklet';
  if (g.over || g.gt < g.autoAt) return;
  if (!g.autoAim) {
    g.aimTarget = clampAim(JAR.left + Math.random() * JAR_W, RADII[g.cur - 1]);
    g.autoAim = true;
    g.autoAt = g.gt + 320;
  } else if (dropFruit(g)) {
    g.autoAim = false;
    g.autoAt = g.gt + 260;
  }
}

export function tickGame(g: Game, dtIn: number): void {
  'worklet';
  if (g.paused) return;
  const real = Math.min(50, Math.max(0, dtIn));
  g.rt += real;
  if (g.shown !== g.score) {
    const d = g.score - g.shown;
    g.shown = d > 0 ? Math.min(g.score, g.shown + Math.max(1, Math.ceil(d * Math.min(1, real / 110)))) : g.score;
  }
  if (g.revealTier && g.rt - g.revealAt > 1950) g.revealTier = 0;
  let ts = 1;
  if (g.slow > 0) ts = 0.3;
  else if (g.slow > -240) ts = 0.3 + 0.7 * (-g.slow / 240);
  if (g.slow > -240) g.slow -= real;
  const dt = real * ts;
  g.gt += dt;
  if (!g.over) {
    g.acc += dt;
    let n = 0;
    while (g.acc >= STEP_MS && n < 6) {
      for (const b of g.world.bodies as Fruit[]) {
        b.px = b.x;
        b.py = b.y;
        b.pa = b.a;
      }
      stepWorld(g.world);
      handleImpacts(g);
      collectMerges(g);
      g.acc -= STEP_MS;
      n++;
    }
    if (n === 6) g.acc = 0;
  }
  g.alpha = g.over ? 1 : g.acc / STEP_MS;
  runTimers(g);
  updateFruits(g);
  updateFx(g.fx, g.gt, dt);
  if (g.ghosts.length) g.ghosts = g.ghosts.filter(x => g.gt - x.t0 < MERGE_SLIDE_MS + 2);
  if (!g.over) checkDanger(g, dt);
  g.aimX += (g.aimTarget - g.aimX) * (1 - Math.exp(-real / 45));
  g.shakeAmp *= Math.pow(0.85, real / 16.7);
  if (g.autoplay) autoPlay(g);
}
