// World constants shared by physics, rules and rendering. Units are the 390x844 design frame.

export const WORLD_W = 390;
export const WORLD_H = 844;

export const JAR = { left: 33, right: 357, floor: 704, rimBottom: 264 } as const;
export const JAR_W = JAR.right - JAR.left;
export const CORNER_R = 30;
export const DANGER_Y = 296;
export const HANG_Y = 205;
export const MAX_TIER = 11;

export const RADII = [0.045, 0.06, 0.075, 0.09, 0.11, 0.13, 0.155, 0.18, 0.21, 0.245, 0.29].map(
  f => f * JAR_W,
);

export const STEP_MS = 1000 / 120;
export const GRAVITY = 0.00125; // px per ms^2
export const DROP_COOLDOWN_MS = 480;
export const COMBO_WINDOW_MS = 1200;
export const MERGE_SLIDE_MS = 90;
export const GROW_MS = 230;
export const GAME_OVER_HOLD_MS = 2000;
export const FRESH_DROP_MS = 900;
export const DANGER_NEAR = DANGER_Y + 0.15 * (JAR.floor - DANGER_Y);

export type TierInfo = { name: string; color: string; juice: string; fact: string };

export const TIERS: TierInfo[] = [
  { name: 'Blueberry', color: '#4B5BD7', juice: '#6F7DF0', fact: 'One of the few naturally blue foods.' },
  { name: 'Lychee', color: '#F2687B', juice: '#FFD9DE', fact: 'Its bumpy red shell peels off by hand.' },
  { name: 'Kiwi', color: '#8CC63F', juice: '#A9DB5B', fact: 'Named after New Zealand’s kiwi bird.' },
  { name: 'Passion Fruit', color: '#7A3E9D', juice: '#F5B83D', fact: 'Named after its flower by 16th-century missionaries.' },
  { name: 'Pomegranate', color: '#C8233A', juice: '#E8344F', fact: 'One fruit holds hundreds of juicy seeds.' },
  { name: 'Dragon Fruit', color: '#E4307F', juice: '#F25A9C', fact: 'It grows on a cactus.' },
  { name: 'Mango', color: '#FFA726', juice: '#FFBE45', fact: 'The national fruit of India.' },
  { name: 'Coconut', color: '#8B5A3C', juice: '#F6EEDF', fact: 'Botanically a drupe, not a nut.' },
  { name: 'Pineapple', color: '#F5C518', juice: '#FFD84A', fact: 'One plant takes about two years to fruit.' },
  { name: 'Watermelon', color: '#2E8B57', juice: '#FF5A73', fact: 'About 92% water.' },
  { name: 'Jackfruit', color: '#C5D93A', juice: '#E4EC63', fact: 'The largest fruit that grows on trees.' },
];

// merge into tier t pays t * (t + 1); two jackfruits vanish for a flat bonus
export const mergePoints = (tier: number): number => {
  'worklet';
  return tier * (tier + 1);
};
export const JACKFRUIT_BONUS = 500;
