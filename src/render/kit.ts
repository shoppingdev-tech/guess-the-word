// Everything the per-frame renderer needs, built once on the JS thread: pictures, paints, shaders.
// The frame worklet only mutates paint state; it never allocates paints or shaders.
import {
  BlendMode,
  BlurStyle,
  Skia,
  StrokeJoin,
  type SkColor,
  type SkPaint,
  type SkPath,
  type SkPicture,
  type SkShader,
} from '@shopify/react-native-skia';
import { TIERS } from '../game/config';
import type { StageLayout } from './layout';
import type { Resources } from './resources';
import { fill, linear, radial, recordBackground, recordHud, recordJarBack, recordJarFront, starPath, stroke } from './scenery';

export type Kit = {
  background: SkPicture;
  jarBack: SkPicture;
  jarFront: SkPicture;
  hud: SkPicture;
  sprite: SkPaint;
  solid: SkPaint;
  line: SkPaint;
  text: SkPaint;
  textStroke: SkPaint;
  flash: SkPaint;
  glow: SkPaint;
  dash: SkPaint;
  dim: SkPaint;
  vignette: SkPaint;
  layer: SkPaint;
  shadow: SkPaint;
  dotWhite: SkPaint;
  dotShade: SkPaint;
  shaded: SkPaint; // fill paint whose shader is swapped per element
  colors: Record<string, SkColor>;
  star: SkPath;
  crown: SkPath;
  jarOutline: SkPath;
  shaders: {
    slotFound: SkShader;
    slotMystery: SkShader;
    pause: SkShader;
    bestPill: SkShader;
    shakeFace: SkShader;
    popFace: SkShader;
    comboFill: SkShader;
    cardBody: SkShader;
    cardHeader: SkShader;
    badge: SkShader;
    shimmer: SkShader;
  };
};

const PALETTE = [
  '#FFFFFF', '#2B1D3A', '#6E6180', '#5A3BD0', '#4A2F9F', '#B8460F', '#FFF6E9', '#FFE7A3', '#FFE27A', '#FFD36B',
  '#FFB547', '#FF4D5E', '#B79CFF', '#9C7CFF', '#FF7A9C', '#FFC440',
  ...TIERS.map(t => t.color),
  ...TIERS.map(t => t.juice),
];

export function makeKit(R: Resources, L: StageLayout): Kit {
  const colors: Record<string, SkColor> = {};
  for (const c of PALETTE) colors[c] = Skia.Color(c);

  const textStroke = stroke('#2B1D3A', 5);
  textStroke.setStrokeJoin(StrokeJoin.Round);
  const flash = fill('#FFFFFF');
  flash.setBlendMode(BlendMode.Plus);
  const glow = stroke('#FFC440', 6, true);
  glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 5, true));
  const dash = stroke('#FFFFFF', 4, true);
  dash.setPathEffect(Skia.PathEffect.MakeDash([12, 9], 0));
  const vignette = fill('#000', radial(L.width / 2, L.height * 0.48, Math.hypot(L.width, L.height) * 0.56, [
    [0, 'rgba(255,77,94,0)'], [0.62, 'rgba(255,77,94,0)'], [1, 'rgba(255,77,94,0.38)'],
  ]));
  const dotWhite = stroke('#FFFFFF', 4.4, true);
  const dotShade = stroke('rgba(90,59,208,0.35)', 6.4, true);
  const shadow = fill('rgba(43,29,58,0.3)');
  shadow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 9, true));

  const crown = Skia.Path.MakeFromSVGString('M1 3.5 L3.8 6 L6.5 1 L9.2 6 L12 3.5 L11 10 H2 Z')!;
  const jarOutline = Skia.Path.MakeFromSVGString('M24 262 V676 A40 40 0 0 0 64 716 H326 A40 40 0 0 0 366 676 V262')!;

  return {
    background: recordBackground(R, L),
    jarBack: recordJarBack(),
    jarFront: recordJarFront(),
    hud: recordHud(R),
    sprite: fill('#FFFFFF'),
    solid: fill('#FFFFFF'),
    line: stroke('#FFFFFF', 2),
    text: fill('#FFFFFF'),
    textStroke,
    flash,
    glow,
    dash,
    dim: fill('#000'),
    vignette,
    layer: fill('#FFFFFF'),
    shadow,
    dotWhite,
    dotShade,
    shaded: fill('#FFFFFF'),
    colors,
    star: starPath(1),
    crown,
    jarOutline,
    shaders: {
      slotFound: radial(-4, -4.5, 16, [[0, '#FFFFFF'], [1, '#F7EFE6']]),
      slotMystery: linear(-6, -13, 6, 13, [[0, '#9C7CFF'], [1, '#5A3BD0']]),
      pause: linear(0, -25, 0, 25, [[0, '#8A6CFF'], [1, '#5A3BD0']]),
      bestPill: linear(0, 0, 0, 18, [[0, '#7B5CF5'], [1, '#5A3BD0']]),
      shakeFace: linear(0, 0, 0, 54, [[0, '#9C7CFF'], [0.58, '#6C4BD8'], [1, '#5A3BD0']]),
      popFace: linear(0, 0, 0, 54, [[0, '#FF9A4D'], [0.55, '#F26A21'], [1, '#E0520C']]),
      comboFill: linear(0, -18, 0, 18, [[0, '#FFE27A'], [1, '#FF7A3D']]),
      cardBody: linear(0, 0, 0, 240, [[0, '#FFFFFF'], [1, '#FFF6E9']]),
      cardHeader: radial(136, 84, 190, [[0, '#A98BFF'], [0.55, '#6C4BD8'], [1, '#4A2F9F']]),
      badge: linear(0, -27, 0, 27, [[0, '#FFE08A'], [1, '#FFB547']]),
      shimmer: linear(-5, 0, 5, 0, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]),
    },
  };
}

