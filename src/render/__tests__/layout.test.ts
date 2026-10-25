import { HUD_TOP, CONTROLS_BOTTOM, stageLayout, toScreen, toWorldX } from '../layout';

const DEVICES = [
  { name: 'iPhone SE', w: 375, h: 667, top: 20, bottom: 0 },
  { name: 'iPhone 15', w: 390, h: 844, top: 47, bottom: 34 },
  { name: 'iPhone 16 Pro', w: 402, h: 874, top: 62, bottom: 34 },
  { name: 'iPhone 16 Pro Max', w: 430, h: 932, top: 62, bottom: 34 },
  { name: 'Pixel 8', w: 412, h: 915, top: 24, bottom: 24 },
];

describe.each(DEVICES)('stage on $name', ({ w, h, top, bottom }) => {
  const L = stageLayout(w, h, { top, bottom });

  test('the whole stage fits the screen width', () => {
    expect(390 * L.s).toBeLessThanOrEqual(w + 0.01);
    expect(L.ox).toBeGreaterThanOrEqual(-0.01);
  });

  test('the HUD starts below the status area and the controls end above the home indicator', () => {
    expect(toScreen(L, 0, HUD_TOP).y).toBeGreaterThanOrEqual(top);
    expect(toScreen(L, 0, CONTROLS_BOTTOM).y).toBeLessThanOrEqual(h - bottom);
  });

  test('screen and world x round-trip, so touches land where the finger is', () => {
    const p = toScreen(L, 123, 400);
    expect(toWorldX(L, p.x)).toBeCloseTo(123, 6);
  });
});

test('a 390x844 phone renders the design at 1:1 or close to it', () => {
  expect(stageLayout(390, 844, { top: 47, bottom: 34 }).s).toBeGreaterThan(0.97);
});
