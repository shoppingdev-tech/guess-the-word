import { JAR, RADII } from '../config';
import {
  createGame,
  dropFruit,
  drainEvents,
  restartGame,
  setPaused,
  spawnFruit,
  tickGame,
  applyPop,
  type Game,
  type GameEvent,
} from '../engine';

const SEED = 20261025;
const tick = (g: Game, ms: number) => {
  for (let t = 0; t < ms; t += 16) tickGame(g, 16);
};
const tiersOf = (g: Game) => g.world.bodies.map(b => b.tier).sort((a, b) => a - b);
const floorY = (tier: number) => JAR.floor - RADII[tier - 1];
const ofType = (events: GameEvent[], type: GameEvent['type']) => events.filter(e => e.type === type);

describe('merge rules', () => {
  test('two touching tier-3 fruits become one tier-4 worth 20 points', () => {
    const g = createGame({ seed: SEED, best: 0 });
    const r = RADII[2];
    spawnFruit(g, 3, 150, floorY(3));
    spawnFruit(g, 3, 150 + 2 * r - 0.5, floorY(3));
    tick(g, 400);
    expect(tiersOf(g)).toEqual([4]);
    expect(g.score).toBe(20);
  });

  test('four merges inside the combo window reach combo 4 and pay x1.5 on the fourth', () => {
    const g = createGame({ seed: SEED, best: 0 });
    const r = RADII[0];
    for (const x of [60, 140, 220, 300]) {
      spawnFruit(g, 1, x - r + 0.25, floorY(1));
      spawnFruit(g, 1, x + r - 0.25, floorY(1));
    }
    tick(g, 300);
    expect(tiersOf(g)).toEqual([2, 2, 2, 2]);
    expect(g.combo).toBe(4);
    expect(g.score).toBe(6 + 6 + 6 + 9);
  });

  test('only the newest combo label is on screen, so labels never pile up', () => {
    const g = createGame({ seed: SEED, best: 0 });
    const r = RADII[0];
    for (const x of [60, 140, 220, 300]) {
      spawnFruit(g, 1, x - r + 0.25, floorY(1));
      spawnFruit(g, 1, x + r - 0.25, floorY(1));
    }
    tick(g, 120);
    const labels = g.fx.popups.filter(p => p.combo);
    expect(labels.map(p => p.text)).toEqual(['x4']);
  });

  test('the first tier-6 merge is a celebrated discovery, the second is not', () => {
    const g = createGame({ seed: SEED, best: 0 });
    const r = RADII[4];
    spawnFruit(g, 5, 100 - r + 0.3, floorY(5));
    spawnFruit(g, 5, 100 + r - 0.3, floorY(5));
    tick(g, 1500);
    const first = drainEvents(g);
    expect(ofType(first, 'discover')).toEqual([expect.objectContaining({ tier: 6, celebrate: true })]);
    spawnFruit(g, 5, 270 - r + 0.3, floorY(5));
    spawnFruit(g, 5, 270 + r - 0.3, floorY(5));
    tick(g, 1500);
    expect(ofType(drainEvents(g), 'discover')).toEqual([]);
    expect(tiersOf(g)).toEqual([6, 6]);
  });

  test('two jackfruits vanish for a 500 point bonus', () => {
    const g = createGame({ seed: SEED, best: 0 });
    const r = RADII[10];
    spawnFruit(g, 11, 195, floorY(11));
    spawnFruit(g, 11, 195, floorY(11) - 2 * r + 0.3);
    tick(g, 400);
    expect(tiersOf(g)).toEqual([]);
    expect(g.score).toBe(500);
  });
});

describe('dropping', () => {
  test('a second drop inside the 480ms cooldown is rejected', () => {
    const g = createGame({ seed: SEED, best: 0 });
    tick(g, 16);
    expect(dropFruit(g)).toBe(true);
    tick(g, 200);
    expect(dropFruit(g)).toBe(false);
    tick(g, 320);
    expect(dropFruit(g)).toBe(true);
  });

  test('everyone gets the same hand sequence for the day, including after a restart', () => {
    const play = (g: Game) => {
      const hands: number[] = [];
      for (let i = 0; i < 6; i++) {
        hands.push(g.cur);
        tick(g, 16);
        dropFruit(g);
        tick(g, 500);
      }
      return hands;
    };
    const a = createGame({ seed: SEED, best: 0 });
    const first = play(a);
    restartGame(a, SEED);
    expect(play(a)).toEqual(first);
    expect(play(createGame({ seed: SEED, best: 0 }))).toEqual(first);
  });

  test('nothing drops while paused and the clock stands still', () => {
    const g = createGame({ seed: SEED, best: 0 });
    tick(g, 16);
    setPaused(g, true);
    const t = g.gt;
    tick(g, 300);
    expect(g.gt).toBe(t);
    expect(dropFruit(g)).toBe(false);
  });
});

describe('danger and game over', () => {
  const tower = (g: Game) => {
    // a perfectly vertical stack has no sideways force, so it stands above the line
    spawnFruit(g, 11, 195, floorY(11));
    spawnFruit(g, 10, 195, floorY(11) - RADII[10] - RADII[9]);
    spawnFruit(g, 11, 195, floorY(11) - 2 * RADII[9] - 2 * RADII[10]);
  };

  test('a pile held above the danger line for 2 seconds ends the run exactly once', () => {
    const g = createGame({ seed: SEED, best: 100 });
    tower(g);
    tick(g, 1500);
    expect(ofType(drainEvents(g), 'over')).toEqual([]);
    tick(g, 2500);
    const over = ofType(drainEvents(g), 'over');
    expect(over).toHaveLength(1);
    expect(over[0]).toEqual(expect.objectContaining({ found: expect.arrayContaining([g.cur, g.next]) }));
    tick(g, 2000);
    expect(ofType(drainEvents(g), 'over')).toEqual([]);
  });

  test('the jar shakes the moment the run ends', () => {
    const g = createGame({ seed: SEED, best: 0 });
    tower(g);
    tick(g, 2100);
    expect(g.over).toBe(true);
    expect(g.rt - g.jarShakeAt).toBeLessThan(200);
  });

  test('a long frame gap does not throw fruit out of the jar', () => {
    const g = createGame({ seed: SEED, best: 0 });
    for (let i = 0; i < 8; i++) spawnFruit(g, 1 + (i % 4), 60 + i * 36, 500 - i * 20);
    tickGame(g, 5000);
    tick(g, 2000);
    for (const b of g.world.bodies) {
      expect(b.x).toBeGreaterThanOrEqual(JAR.left + b.r - 0.5);
      expect(b.x).toBeLessThanOrEqual(JAR.right - b.r + 0.5);
      expect(b.y).toBeLessThanOrEqual(JAR.floor - b.r + 0.5);
    }
  });
});

describe('power-ups and restart', () => {
  test('pop removes the smallest fruit, the higher one on a tie', () => {
    const g = createGame({ seed: SEED, best: 0 });
    spawnFruit(g, 3, 80, floorY(3));
    const low = spawnFruit(g, 2, 200, floorY(2));
    spawnFruit(g, 2, 320, 480);
    tick(g, 16);
    expect(applyPop(g)).toBe(true);
    expect(g.world.bodies.map(b => b.tier).sort()).toEqual([2, 3]);
    expect(g.world.bodies).toContain(low);
    expect(g.pop).toBe(2);
  });

  test('restart drops pending merges and resets the run', () => {
    const g = createGame({ seed: SEED, best: 0 });
    const r = RADII[2];
    spawnFruit(g, 3, 150, floorY(3));
    spawnFruit(g, 3, 150 + 2 * r - 0.5, floorY(3));
    tick(g, 32);
    restartGame(g, SEED);
    tick(g, 400);
    expect(g.world.bodies).toHaveLength(0);
    expect(g.score).toBe(0);
    expect(g.combo).toBe(0);
    expect([g.shake, g.pop]).toEqual([2, 3]);
  });
});

describe('presentation state for the HUD', () => {
  const mergeTwo = (g: Game, tier: number, x: number) => {
    const r = RADII[tier - 1];
    spawnFruit(g, tier, x - r + 0.3, floorY(tier));
    spawnFruit(g, tier, x + r - 0.3, floorY(tier));
  };

  test('the score counts up to the new total instead of jumping', () => {
    const g = createGame({ seed: SEED, best: 0 });
    mergeTwo(g, 6, 195);
    tick(g, 112);
    expect(g.score).toBe(56);
    expect(g.shown).toBeLessThan(56);
    tick(g, 800);
    expect(g.shown).toBe(56);
  });

  test('a celebrated discovery stays on screen for 1.95s of real time despite the slow-mo', () => {
    const g = createGame({ seed: SEED, best: 0 });
    mergeTwo(g, 5, 195);
    tick(g, 300);
    expect(g.revealTier).toBe(6);
    tick(g, 1500);
    expect(g.revealTier).toBe(6);
    tick(g, 400);
    expect(g.revealTier).toBe(0);
  });
});
