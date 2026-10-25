// Loads every image and font the game canvas draws, as Skia objects shared with the UI thread.
import { useMemo } from 'react';
import { Skia, useImage, useTypeface, type SkFont, type SkImage, type SkRect } from '@shopify/react-native-skia';
import fruitsMeta from '../assets/sprites/fruits.json';
import particlesMeta from '../assets/sprites/particles.json';

export type Sprite = { src: SkRect; dst: SkRect };

export type Fonts = {
  score: SkFont;
  pill: SkFont;
  label: SkFont;
  mystery: SkFont;
  popup: SkFont;
  combo: SkFont;
  comboSmall: SkFont;
  cardTitle: SkFont;
  cardFact: SkFont;
  badge: SkFont;
  button: SkFont;
  count: SkFont;
};

export type Resources = {
  fruits: SkImage;
  particles: SkImage;
  bg: SkImage;
  mat: SkImage;
  leaf: SkImage;
  shakeIcon: SkImage;
  popIcon: SkImage;
  ui: SkImage[];
  fruitSprites: Sprite[]; // in world units, origin at the body centre
  dot: SkRect;
  fonts: Fonts;
};

const UI_SOURCES = [
  require('../assets/sprites/ui/t01_blueberry.png'),
  require('../assets/sprites/ui/t02_lychee.png'),
  require('../assets/sprites/ui/t03_kiwi.png'),
  require('../assets/sprites/ui/t04_passionfruit.png'),
  require('../assets/sprites/ui/t05_pomegranate.png'),
  require('../assets/sprites/ui/t06_dragonfruit.png'),
  require('../assets/sprites/ui/t07_mango.png'),
  require('../assets/sprites/ui/t08_coconut.png'),
  require('../assets/sprites/ui/t09_pineapple.png'),
  require('../assets/sprites/ui/t10_watermelon.png'),
  require('../assets/sprites/ui/t11_jackfruit.png'),
];

export function useGameResources(): Resources | null {
  const fruits = useImage(require('../assets/sprites/fruits.png'));
  const particles = useImage(require('../assets/sprites/particles.png'));
  const bg = useImage(require('../assets/sprites/bg_gameplay.jpg'));
  const mat = useImage(require('../assets/sprites/jar_mat.png'));
  const leaf = useImage(require('../assets/sprites/ui/ui_leaf_cluster.png'));
  const shakeIcon = useImage(require('../assets/sprites/ui/ui_shake.png'));
  const popIcon = useImage(require('../assets/sprites/ui/ui_pop.png'));
  // fixed hook order: one call per tier
  const ui = [
    useImage(UI_SOURCES[0]), useImage(UI_SOURCES[1]), useImage(UI_SOURCES[2]), useImage(UI_SOURCES[3]),
    useImage(UI_SOURCES[4]), useImage(UI_SOURCES[5]), useImage(UI_SOURCES[6]), useImage(UI_SOURCES[7]),
    useImage(UI_SOURCES[8]), useImage(UI_SOURCES[9]), useImage(UI_SOURCES[10]),
  ];
  const fredokaBold = useTypeface(require('../assets/fonts/Fredoka-Bold.ttf'));
  const fredokaSemi = useTypeface(require('../assets/fonts/Fredoka-SemiBold.ttf'));
  const nunito = useTypeface(require('../assets/fonts/Nunito-ExtraBold.ttf'));

  const uiReady = ui.every(Boolean);
  return useMemo(() => {
    if (!fruits || !particles || !bg || !mat || !leaf || !shakeIcon || !popIcon || !uiReady) return null;
    if (!fredokaBold || !fredokaSemi || !nunito) return null;
    const k = fruitsMeta.scale;
    const fruitSprites = fruitsMeta.sprites.map(s => ({
      src: Skia.XYWHRect(s.x, s.y, s.w, s.h),
      dst: Skia.XYWHRect(-s.ax / k, -s.ay / k, s.w / k, s.h / k),
    }));
    const d = particlesMeta.sprites.dot;
    const font = (tf: typeof fredokaBold, size: number) => Skia.Font(tf, size);
    return {
      fruits, particles, bg, mat, leaf, shakeIcon, popIcon,
      ui: ui as SkImage[],
      fruitSprites,
      dot: Skia.XYWHRect(d.x, d.y, d.w, d.h),
      fonts: {
        score: font(fredokaBold, 34),
        pill: font(fredokaSemi, 12),
        label: font(fredokaSemi, 11),
        mystery: font(fredokaBold, 15),
        popup: font(fredokaBold, 22),
        combo: font(fredokaBold, 36),
        comboSmall: font(fredokaBold, 13),
        cardTitle: font(fredokaBold, 28),
        cardFact: font(nunito, 14),
        badge: font(fredokaBold, 15),
        button: font(fredokaBold, 24),
        count: font(fredokaBold, 14),
      },
    };
    // ui images are tracked through uiReady
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fruits, particles, bg, mat, leaf, shakeIcon, popIcon, uiReady, fredokaBold, fredokaSemi, nunito]);
}
