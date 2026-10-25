import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { Game } from '../game/engine';
import { drawFrame } from './drawFrame';
import { makeKit } from './kit';
import type { StageLayout } from './layout';
import { useGameResources } from './resources';

export type PressValues = { pause: SharedValue<number>; shake: SharedValue<number>; pop: SharedValue<number> };

type Props = { game: SharedValue<Game | null>; frame: SharedValue<number>; press: PressValues; layout: StageLayout };

// One Skia picture per frame, recorded on the UI thread from the game state.
export function GameCanvas({ game, frame, press, layout }: Props) {
  const R = useGameResources();
  const K = useMemo(() => (R ? makeKit(R, layout) : null), [R, layout]);
  const picture = useDerivedValue(() => {
    frame.value;
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording({ x: 0, y: 0, width: layout.width, height: layout.height });
    const g = game.value;
    if (g && R && K) drawFrame(c, g, R, K, layout, { pause: press.pause.value, shake: press.shake.value, pop: press.pop.value });
    return rec.finishRecordingAsPicture();
  });
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}
