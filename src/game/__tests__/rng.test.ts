import { daySeed, pickTier, rngNext, type RngState } from '../rng';

const stream = (seed: number) => {
  const st: RngState = { rs: seed };
  return () => rngNext(st);
};

describe('daily drop sequence', () => {
  test('daySeed encodes the local date as YYYYMMDD', () => {
    expect(daySeed(new Date(2026, 9, 25))).toBe(20261025);
    expect(daySeed(new Date(2027, 0, 3))).toBe(20270103);
  });

  test('the same seed gives everyone the same first 50 drops', () => {
    const a = stream(20261025);
    const b = stream(20261025);
    const seqA = Array.from({ length: 50 }, () => pickTier(a()));
    const seqB = Array.from({ length: 50 }, () => pickTier(b()));
    expect(seqA).toEqual(seqB);
  });

  test('different days give different sequences', () => {
    const a = stream(20261025);
    const b = stream(20261026);
    const seqA = Array.from({ length: 30 }, () => pickTier(a()));
    const seqB = Array.from({ length: 30 }, () => pickTier(b()));
    expect(seqA).not.toEqual(seqB);
  });

  test('rng state lives in a plain object, so a worklet can carry it', () => {
    const st: RngState = { rs: 7 };
    const first = rngNext(st);
    expect(st.rs).not.toBe(7);
    expect(rngNext({ rs: 7 })).toBe(first);
  });

  test('only tiers 1 to 5 can be dropped, weighted 30/28/22/13/7', () => {
    const r = stream(42);
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 10000; i++) counts[pickTier(r())]++;
    expect(counts[0]).toBe(0);
    expect(counts.slice(1).reduce((s, n) => s + n, 0)).toBe(10000);
    expect(Math.abs(counts[1] / 10000 - 0.3)).toBeLessThan(0.02);
    expect(Math.abs(counts[5] / 10000 - 0.07)).toBeLessThan(0.015);
  });
});
