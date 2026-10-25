// Fits the 390x844 design frame onto any phone: uniform scale, centred, with the HUD and the
// power-up bar kept inside the safe area. Everything above HUD_TOP / below CONTROLS_BOTTOM is
// only background, so it may run under the status bar and home indicator.
import { WORLD_W } from '../game/config';

export const HUD_TOP = 46;
export const CONTROLS_BOTTOM = 810;
const BREATH = 8; // extra world px kept clear above and below the safe content

export type StageLayout = { s: number; ox: number; oy: number; width: number; height: number };

export function stageLayout(width: number, height: number, insets: { top: number; bottom: number }): StageLayout {
  const avail = height - insets.top - insets.bottom;
  const content = CONTROLS_BOTTOM - HUD_TOP + 2 * BREATH;
  const s = Math.min(width / WORLD_W, avail / content);
  const ox = (width - WORLD_W * s) / 2;
  const oy = insets.top + (avail - content * s) / 2 + (BREATH - HUD_TOP) * s;
  return { s, ox, oy, width, height };
}

export function toScreen(L: StageLayout, x: number, y: number): { x: number; y: number } {
  'worklet';
  return { x: L.ox + x * L.s, y: L.oy + y * L.s };
}

export function toWorldX(L: StageLayout, sx: number): number {
  'worklet';
  return (sx - L.ox) / L.s;
}
