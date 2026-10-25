import { CORNER_R, JAR, RADII, STEP_MS } from '../config';
import { rngNext } from '../rng';
import { addBody, createWorld, sameTierContacts, setVelocity, speedOf, stepWorld, type World } from '../physics';

const run = (w: World, ms: number) => {
  for (let t = 0; t < ms; t += STEP_MS) stepWorld(w);
};

const maxOverlap = (w: World) => {
  let worst = 0;
  const b = w.bodies;
  for (let i = 0; i < b.length; i++) {
    for (let j = i + 1; j < b.length; j++) {
      const d = Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y);
      worst = Math.max(worst, b[i].r + b[j].r - d);
    }
  }
  return worst;
};

const dropPile = (seed: number, count: number) => {
  const w = createWorld();
  const st = { rs: seed };
  const rand = () => rngNext(st);
  for (let i = 0; i < count; i++) {
    const tier = 1 + Math.floor(rand() * 6);
    const r = RADII[tier - 1];
    addBody(w, tier, JAR.left + r + rand() * (JAR.right - JAR.left - 2 * r), 205);
    run(w, 300);
  }
  return w;
};

describe('circle physics in the jar', () => {
  test('a dropped fruit falls and rests on the floor', () => {
    const w = createWorld();
    const b = addBody(w, 3, 195, 260);
    run(w, 3000);
    expect(b.y).toBeCloseTo(JAR.floor - b.r, 0);
    expect(speedOf(b)).toBeLessThan(0.005);
  });

  test('20 drops settle with no visible overlap and nothing outside the glass', () => {
    const w = dropPile(7, 20);
    run(w, 4000);
    expect(maxOverlap(w)).toBeLessThan(1.5);
    for (const b of w.bodies) {
      expect(b.x).toBeGreaterThanOrEqual(JAR.left + b.r - 0.5);
      expect(b.x).toBeLessThanOrEqual(JAR.right - b.r + 0.5);
      expect(b.y).toBeLessThanOrEqual(JAR.floor - b.r + 0.5);
    }
  });

  test('a settled pile is calm, with no resting jitter', () => {
    const w = dropPile(11, 24);
    run(w, 6000);
    const fastest = Math.max(...w.bodies.map(speedOf));
    expect(fastest).toBeLessThan(0.02);
  });

  test('a fruit thrown at the wall never escapes the jar', () => {
    const w = createWorld();
    const b = addBody(w, 2, 60, 600);
    setVelocity(b, -6, -2);
    run(w, 1500);
    expect(b.x).toBeGreaterThanOrEqual(JAR.left + b.r - 0.5);
  });

  test('a small fruit sliding down the corner never pokes through the rounded glass', () => {
    const w = createWorld();
    const b = addBody(w, 1, JAR.left + RADII[0] + 0.5, 600);
    const ax = JAR.left + CORNER_R, ay = JAR.floor - CORNER_R;
    let worst = 0;
    for (let t = 0; t < 3000; t += STEP_MS) {
      stepWorld(w);
      if (b.x < ax && b.y > ay) worst = Math.max(worst, Math.hypot(b.x - ax, b.y - ay) + b.r - CORNER_R);
    }
    expect(worst).toBeLessThanOrEqual(2);
  });

  test('three touching fruits of one tier make exactly one merge pair', () => {
    const w = createWorld();
    const r = RADII[1];
    addBody(w, 2, 150, JAR.floor - r);
    addBody(w, 2, 150 + 2 * r, JAR.floor - r);
    addBody(w, 2, 150 + r, JAR.floor - r - 1.73 * r);
    run(w, STEP_MS);
    const pairs = sameTierContacts(w);
    expect(pairs).toHaveLength(1);
    expect(pairs[0][0]).not.toBe(pairs[0][1]);
  });

  test('fruits of different tiers never pair', () => {
    const w = createWorld();
    addBody(w, 2, 150, JAR.floor - RADII[1]);
    addBody(w, 3, 150 + RADII[1] + RADII[2], JAR.floor - RADII[2]);
    run(w, STEP_MS);
    expect(sameTierContacts(w)).toHaveLength(0);
  });
});
