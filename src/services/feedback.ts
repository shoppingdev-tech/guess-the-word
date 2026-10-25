// Haptics and the saved best score.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trigger } from 'react-native-haptic-feedback';
import type { HapticLevel } from '../game/engine';

const IMPACT = { light: 'impactLight', medium: 'impactMedium', heavy: 'impactHeavy' } as const;

export function haptic(level: HapticLevel): void {
  try {
    trigger(IMPACT[level], { enableVibrateFallback: false, ignoreAndroidSystemSettings: false });
  } catch {
    // no haptic engine
  }
}

const BEST_KEY = 'dmm-best';

export async function loadBest(): Promise<number> {
  try {
    return Number(await AsyncStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(score: number): void {
  AsyncStorage.setItem(BEST_KEY, String(Math.round(score))).catch(() => undefined);
}
