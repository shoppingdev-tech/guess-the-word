import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions, type AccessibilityActionEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { useFrameCallback, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { AUTOPLAY } from '../devFlags';
import {
  applyPop,
  applyShake,
  createGame,
  drainEvents,
  dropFruit,
  restartGame,
  setAim,
  setPaused,
  tickGame,
  type Game,
  type GameEvent,
} from '../game/engine';
import { daySeed } from '../game/rng';
import { formatScore } from '../render/drawFrame';
import { GameCanvas } from '../render/GameCanvas';
import { stageLayout, toWorldX, type StageLayout } from '../render/layout';
import { haptic, loadBest, saveBest } from '../services/feedback';
import { playSfx, playTap } from '../services/sound';
import { GameOverCard } from './GameOverCard';
import { PauseSheet } from './PauseSheet';
import { C } from './theme';

type Over = { score: number; best: number; newBest: boolean; found: number[]; top: number };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const box = (L: StageLayout, x: number, y: number, w: number, h: number) => ({
  left: L.ox + x * L.s,
  top: L.oy + y * L.s,
  width: w * L.s,
  height: h * L.s,
});

function pressHandlers(v: SharedValue<number>) {
  return {
    onPressIn: () => {
      v.value = withTiming(1, { duration: 70 });
    },
    onPressOut: () => {
      v.value = withSpring(0, { damping: 11, stiffness: 320 });
    },
  };
}

export function GameScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const layout = useMemo(
    () => stageLayout(width, height, { top: insets.top, bottom: insets.bottom }),
    [width, height, insets.top, insets.bottom],
  );
  const game = useSharedValue<Game | null>(null);
  const frame = useSharedValue(0);
  const pause = useSharedValue(0);
  const shake = useSharedValue(0);
  const pop = useSharedValue(0);
  const press = useMemo(() => ({ pause, shake, pop }), [pause, shake, pop]);
  const [paused, setPausedUI] = useState(false);
  const [over, setOver] = useState<Over | null>(null);
  const [sound, setSound] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const prefs = useRef({ sound, haptics });
  prefs.current = { sound, haptics };
  const live = useRef({ score: 0, top: 1 });
  const seed = useMemo(() => daySeed(new Date()), []);

  // the game lives on the UI thread from its first frame
  useEffect(() => {
    let alive = true;
    loadBest().then(best => {
      if (!alive) return;
      scheduleOnUI(
        (s: number, b: number, auto: boolean) => {
          'worklet';
          game.value = createGame({ seed: s, best: b, autoplay: auto });
        },
        seed,
        best,
        AUTOPLAY,
      );
    });
    return () => {
      alive = false;
    };
  }, [game, seed]);

  const onEvents = useCallback((events: GameEvent[]) => {
    for (const e of events) {
      if (e.type === 'sound') {
        if (prefs.current.sound) playSfx(e.name, e.tier, e.combo, e.strength);
      } else if (e.type === 'haptic') {
        if (prefs.current.haptics) haptic(e.level);
      } else if (e.type === 'score') live.current.score = e.score;
      else if (e.type === 'top') live.current.top = e.tier;
      else if (e.type === 'reset') live.current = { score: e.score, top: e.top };
      else if (e.type === 'over') {
        saveBest(e.best);
        setOver({ score: e.score, best: e.best, newBest: e.newBest, found: e.found, top: live.current.top });
      }
    }
  }, []);

  useFrameCallback(info => {
    'worklet';
    const g = game.value;
    if (!g) return;
    tickGame(g, info.timeSincePreviousFrame ?? 16);
    frame.value += 1;
    if (g.events.length) scheduleOnRN(onEvents, drainEvents(g));
  });

  // aiming runs on the UI thread: the hanging fruit follows the finger with no JS round trip
  const aimAt = (sx: number) => {
    'worklet';
    const g = game.value;
    if (g && !g.paused && !g.over) setAim(g, toWorldX(layout, sx));
  };
  const pan = usePanGesture({
    minDistance: 0,
    onBegin: e => {
      'worklet';
      aimAt(e.x);
    },
    onUpdate: e => {
      'worklet';
      aimAt(e.x);
    },
    onFinalize: e => {
      'worklet';
      const g = game.value;
      if (!g || e.canceled || g.paused || g.over) return;
      setAim(g, toWorldX(layout, e.x));
      dropFruit(g);
    },
  });

  const onA11y = useCallback(
    (e: AccessibilityActionEvent) => {
      const name = e.nativeEvent.actionName;
      scheduleOnUI((n: string) => {
        'worklet';
        const g = game.value;
        if (!g) return;
        if (n === 'activate') dropFruit(g);
        else setAim(g, g.aimTarget + (n === 'increment' ? 24 : -24));
      }, name);
    },
    [game],
  );

  const onPause = useCallback(() => {
    if (over) return;
    if (prefs.current.sound) playTap();
    scheduleOnUI(() => {
      'worklet';
      if (game.value) setPaused(game.value, true);
    });
    setPausedUI(true);
  }, [game, over]);

  const onResume = useCallback(() => {
    if (prefs.current.sound) playTap();
    scheduleOnUI(() => {
      'worklet';
      if (game.value) setPaused(game.value, false);
    });
    setPausedUI(false);
  }, [game]);

  const onRestart = useCallback(() => {
    if (prefs.current.sound) playTap();
    scheduleOnUI((s: number) => {
      'worklet';
      if (game.value) restartGame(game.value, s);
    }, seed);
    live.current = { score: 0, top: 1 };
    setPausedUI(false);
    setOver(null);
  }, [game, seed]);

  const onShake = useCallback(() => {
    scheduleOnUI(() => {
      'worklet';
      if (game.value) applyShake(game.value);
    });
  }, [game]);

  const onPop = useCallback(() => {
    scheduleOnUI(() => {
      'worklet';
      if (game.value) applyPop(game.value);
    });
  }, [game]);

  const now = new Date();
  return (
    <View style={styles.root}>
      <GameCanvas game={game} frame={frame} press={press} layout={layout} />
      <GestureDetector gesture={pan}>
        <View
          style={[styles.abs, box(layout, 0, 164, 390, 574), styles.fullWidth]}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Jar. Drag to aim, release to drop the fruit."
          accessibilityActions={[{ name: 'activate', label: 'Drop fruit' }, { name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={onA11y}
        />
      </GestureDetector>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pause"
        hitSlop={8}
        style={[styles.abs, box(layout, 324, 52, 50, 50)]}
        onPress={onPause}
        {...pressHandlers(pause)}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Shake the jar"
        style={[styles.abs, box(layout, 20, 748, 168, 59)]}
        onPress={onShake}
        {...pressHandlers(shake)}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pop the smallest fruit"
        style={[styles.abs, box(layout, 202, 748, 168, 59)]}
        onPress={onPop}
        {...pressHandlers(pop)}
      />
      {paused && !over && (
        <PauseSheet
          score={formatScore(live.current.score)}
          dateLine={`Today’s mystery · ${now.getDate()} ${MONTHS[now.getMonth()]}`}
          sound={sound}
          haptics={haptics}
          onResume={onResume}
          onRestart={onRestart}
          onToggleSound={setSound}
          onToggleHaptics={setHaptics}
        />
      )}
      {over && <GameOverCard {...over} sound={sound} haptics={haptics} onPlayAgain={onRestart} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  abs: { position: 'absolute' },
  fullWidth: { left: 0, right: 0, width: undefined },
});
