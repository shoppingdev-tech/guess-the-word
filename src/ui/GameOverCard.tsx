import React, { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { formatScore } from '../render/drawFrame';
import { haptic } from '../services/feedback';
import { playJingle, playTick } from '../services/sound';
import { Button3D } from './Button3D';
import { C, F, FRUIT_IMAGES, LEAF, MYSTERY } from './theme';

type Props = {
  score: number;
  best: number;
  newBest: boolean;
  found: number[];
  top: number;
  sound: boolean;
  haptics: boolean;
  onPlayAgain: () => void;
};

// Choreography, in ms after the card mounts.
const T = { title: 160, sub: 280, score: 360, count: 420, countFor: 900, stats: 540, slots: 680, slotGap: 45, cta: 980, home: 1120 };
const BACK = Easing.out(Easing.back(2.2));

// the card rises from below on a soft spring
const cardIn = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 180 }, { scale: 0.9 }] },
    animations: {
      opacity: withTiming(1, { duration: 220 }),
      transform: [
        { translateY: withSpring(0, { damping: 16, stiffness: 150, mass: 0.9 }) },
        { scale: withSpring(1, { damping: 13, stiffness: 170 }) },
      ],
    },
  };
};

// big and transparent, then stamped down with a bounce
const stampIn = (delay: number, from = 1.8, rotate = '0deg', damping = 13) => () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: from }, { rotate }] },
    animations: {
      opacity: withDelay(delay, withTiming(1, { duration: 140 })),
      transform: [
        { scale: withDelay(delay, withSpring(1, { damping, stiffness: 230 })) },
        { rotate: withDelay(delay, withTiming('0deg', { duration: 420, easing: BACK })) },
      ],
    },
  };
};

const riseIn = (delay: number, distance = 18) => () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateY: distance }] },
    animations: {
      opacity: withDelay(delay, withTiming(1, { duration: 260 })),
      transform: [{ translateY: withDelay(delay, withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) })) }],
    },
  };
};

const popIn = (delay: number) => () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.2 }] },
    animations: {
      opacity: withDelay(delay, withTiming(1, { duration: 120 })),
      transform: [{ scale: withDelay(delay, withTiming(1, { duration: 380, easing: Easing.out(Easing.back(3)) })) }],
    },
  };
};

const swayIn = (delay: number, from: string) => () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ rotate: from }, { scale: 0.4 }] },
    animations: {
      opacity: withDelay(delay, withTiming(1, { duration: 200 })),
      transform: [
        { rotate: withDelay(delay, withTiming('0deg', { duration: 560, easing: BACK })) },
        { scale: withDelay(delay, withTiming(1, { duration: 560, easing: BACK })) },
      ],
    },
  };
};

// a ring of little gold diamonds flying out from the score
const sparkOut = (angle: number, dist: number) => () => {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 0.2 }, { rotate: '45deg' }] },
    animations: {
      opacity: withSequence(withTiming(1, { duration: 160 }), withTiming(0, { duration: 420 })),
      transform: [
        { translateX: withTiming(Math.cos(angle) * dist, { duration: 580, easing: Easing.out(Easing.cubic) }) },
        { translateY: withTiming(Math.sin(angle) * dist, { duration: 580, easing: Easing.out(Easing.cubic) }) },
        { scale: withSequence(withTiming(1.3, { duration: 160 }), withTiming(0.4, { duration: 420 })) },
        { rotate: '45deg' },
      ],
    },
  };
};

function CountUp({ value, delay, duration, style, onTick, onDone }: {
  value: number;
  delay: number;
  duration: number;
  style: StyleProp<TextStyle>;
  onTick: () => void;
  onDone: () => void;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    let start = 0;
    let lastTick = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const k = Math.min(1, (ts - start) / duration);
      setN(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) {
        if (ts - lastTick > 75) {
          lastTick = ts;
          onTick();
        }
        raf = requestAnimationFrame(step);
      } else onDone();
    };
    const id = setTimeout(() => {
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(id);
      cancelAnimationFrame(raf);
    };
    // the count runs once per card
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <Text style={style}>{formatScore(n)}</Text>;
}

export function GameOverCard({ score, best, newBest, found, top, sound, haptics, onPlayAgain }: Props) {
  const [counted, setCounted] = useState(false);
  const bump = useSharedValue(1);
  const breath = useSharedValue(1);
  const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
  const breathStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));

  useEffect(() => {
    // the call to action breathes gently once everything has landed
    breath.value = withDelay(
      T.cta + 700,
      withRepeat(
        withSequence(
          withTiming(1.035, { duration: 700, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
  }, [breath]);

  const onTick = useCallback(() => {
    if (sound) playTick();
  }, [sound]);
  const onDone = useCallback(() => {
    setCounted(true);
    bump.value = withSequence(withTiming(1.14, { duration: 120 }), withSpring(1, { damping: 8, stiffness: 260 }));
    if (sound) playJingle(newBest);
    if (haptics) haptic(newBest ? 'heavy' : 'medium');
  }, [bump, sound, haptics, newBest]);

  const sparks = newBest ? 12 : 8;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(380)} style={[StyleSheet.absoluteFill, styles.dim]} />
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View entering={cardIn} accessibilityViewIsModal style={styles.card}>
          <Animated.View entering={swayIn(120, '-40deg')} style={[styles.leafBox, styles.leafLeft]}>
            <Image source={LEAF} style={[styles.leaf, styles.leafLeftImg]} resizeMode="contain" />
          </Animated.View>
          <Animated.View entering={swayIn(190, '40deg')} style={[styles.leafBox, styles.leafRight]}>
            <Image source={LEAF} style={[styles.leaf, styles.leafRightImg]} resizeMode="contain" />
          </Animated.View>
          <Animated.Text entering={stampIn(T.title)} accessibilityRole="header" style={styles.title}>
            {top >= 11 ? 'Jackfruit reached!' : 'Jar full!'}
          </Animated.Text>
          <Animated.Text entering={riseIn(T.sub, 10)} style={styles.sub}>Today’s theme was World Fruits</Animated.Text>
          <Animated.View entering={riseIn(T.score, 14)} style={styles.scoreWrap}>
            <Animated.View style={bumpStyle}>
              <CountUp value={score} delay={T.count - T.score} duration={T.countFor} style={styles.score} onTick={onTick} onDone={onDone} />
            </Animated.View>
            {counted && (
              <View pointerEvents="none" style={styles.sparkOrigin}>
                {Array.from({ length: sparks }, (_, i) => (
                  <Animated.View key={i} entering={sparkOut((i / sparks) * Math.PI * 2 + 0.3, 70 + (i % 3) * 18)} style={[styles.spark, i % 2 ? styles.sparkWhite : null]} />
                ))}
              </View>
            )}
          </Animated.View>
          <View style={styles.stats}>
            <Animated.View entering={riseIn(T.stats)} style={styles.stat}>
              <Text style={styles.statValue}>{found.length}/11</Text>
              <Text style={styles.statLabel}>TIERS FOUND</Text>
            </Animated.View>
            <Animated.View entering={riseIn(T.stats + 70)} style={styles.stat}>
              <Text style={styles.statValue}>{formatScore(best)}</Text>
              <Text style={styles.statLabel}>BEST SCORE</Text>
            </Animated.View>
          </View>
          <View style={styles.strip} accessibilityLabel={`${found.length} of 11 tiers found`}>
            {FRUIT_IMAGES.map((src, i) => (
              <Animated.View
                key={i}
                entering={popIn(T.slots + i * T.slotGap)}
                style={[styles.slot, found.includes(i + 1) ? styles.slotFound : { backgroundImage: MYSTERY }]}
              >
                {found.includes(i + 1) ? <Image source={src} style={styles.slotImg} resizeMode="contain" /> : <Text style={styles.q}>?</Text>}
              </Animated.View>
            ))}
          </View>
          <Animated.View entering={riseIn(T.cta, 26)} style={styles.full}>
            <Animated.View style={breathStyle}>
              <Button3D label="Play again" variant="mango" onPress={onPlayAgain} />
            </Animated.View>
          </Animated.View>
          <Animated.Text entering={riseIn(T.home, 8)} accessibilityRole="button" style={styles.home}>
            Back home
          </Animated.Text>
          {newBest && counted && (
            <Animated.View entering={stampIn(60, 2.4, '-14deg', 10)} style={styles.ribbon}>
              <Text style={styles.ribbonText}>NEW BEST!</Text>
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(43,29,58,0.52)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  card: {
    width: '100%', maxWidth: 360, paddingTop: 30, paddingHorizontal: 22, paddingBottom: 12, borderRadius: 32,
    backgroundImage: 'linear-gradient(180deg, #FFFFFF 0%, #FFF6E9 100%)', borderWidth: 3, borderColor: '#FFFFFF',
    boxShadow: '0 24px 60px rgba(43,29,58,0.45)', alignItems: 'center', gap: 12,
  },
  leafBox: { position: 'absolute', width: 72, height: 54 },
  leafLeft: { left: -18, top: -20 },
  leafRight: { right: -16, top: -18 },
  leaf: { width: 72, height: 54 },
  leafLeftImg: { transform: [{ rotate: '-16deg' }] },
  leafRightImg: { transform: [{ scaleX: -1 }, { rotate: '-14deg' }] },
  ribbon: {
    position: 'absolute', top: -15, height: 30, paddingHorizontal: 16, borderRadius: 999, justifyContent: 'center',
    backgroundImage: 'linear-gradient(180deg, #6CEBC0, #2FBF8F)', borderWidth: 2.5, borderColor: '#FFFFFF', boxShadow: '0 6px 14px rgba(47,191,143,0.4)',
  },
  ribbonText: { fontFamily: F.display, fontSize: 14, letterSpacing: 1, color: C.mintText },
  title: { fontFamily: F.display, fontSize: 38, color: C.plum },
  sub: { fontFamily: F.body, fontSize: 14, color: C.muted, marginTop: -6 },
  scoreWrap: { alignItems: 'center', justifyContent: 'center' },
  score: { fontFamily: F.display, fontSize: 60, lineHeight: 66, color: C.purple, fontVariant: ['tabular-nums'] },
  sparkOrigin: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0 },
  spark: { position: 'absolute', left: -5, top: -5, width: 10, height: 10, borderRadius: 2, backgroundColor: '#FFC440' },
  sparkWhite: { backgroundColor: '#FFFFFF', boxShadow: '0 0 6px rgba(255,196,64,0.9)' },
  stats: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  stat: { flex: 1, paddingVertical: 10, borderRadius: 18, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, alignItems: 'center' },
  statValue: { fontFamily: F.display, fontSize: 22, color: C.plum, fontVariant: ['tabular-nums'] },
  statLabel: { fontFamily: F.body, fontSize: 11, letterSpacing: 0.6, color: C.muted },
  strip: { flexDirection: 'row', gap: 4 },
  slot: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  slotFound: { backgroundColor: '#FFFFFF', boxShadow: 'inset 0 0 0 1.5px rgba(43,29,58,0.07)' },
  slotImg: { width: 23, height: 23 },
  q: { fontFamily: F.display, fontSize: 13, color: '#FFFFFF' },
  full: { alignSelf: 'stretch', marginTop: 4 },
  home: { fontFamily: F.displaySemi, fontSize: 17, color: C.purple, paddingVertical: 10, paddingHorizontal: 18 },
});
