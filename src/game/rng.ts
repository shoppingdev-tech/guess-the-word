// Seeded randomness for the daily drop sequence. Worklets: these run on the UI thread, so the
// generator's state lives in a plain object (worklets can't reassign captured variables).

export type RngState = { rs: number };

export function rngNext(st: RngState): number {
  'worklet';
  st.rs = (st.rs + 0x6d2b79f5) >>> 0;
  let t = st.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function daySeed(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

const DROP_WEIGHTS = [30, 28, 22, 13, 7];
const DROP_TOTAL = 100;

// r is a uniform random number in [0, 1)
export function pickTier(r: number): number {
  'worklet';
  let x = r * DROP_TOTAL;
  for (let i = 0; i < DROP_WEIGHTS.length; i++) {
    x -= DROP_WEIGHTS[i];
    if (x < 0) return i + 1;
  }
  return 1;
}
