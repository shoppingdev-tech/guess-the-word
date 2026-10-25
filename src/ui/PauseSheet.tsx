import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button3D } from './Button3D';
import { C, F } from './theme';

type Props = {
  score: string;
  dateLine: string;
  sound: boolean;
  haptics: boolean;
  onResume: () => void;
  onRestart: () => void;
  onToggleSound: (on: boolean) => void;
  onToggleHaptics: (on: boolean) => void;
};

export function PauseSheet(p: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={[StyleSheet.absoluteFill, styles.dim]} />
      <Animated.View
        entering={SlideInDown.springify().damping(20).stiffness(190)}
        exiting={SlideOutDown.duration(220)}
        accessibilityViewIsModal
        style={[styles.sheet, { paddingBottom: 22 + insets.bottom }]}
      >
        <View style={styles.handle} />
        <View style={styles.header}>
          <View>
            <Text accessibilityRole="header" style={styles.title}>Paused</Text>
            <Text style={styles.sub}>{p.dateLine}</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.score}>{p.score}</Text>
            <Text style={styles.caption}>SCORE</Text>
          </View>
        </View>
        <Button3D label="Resume" variant="mango" onPress={p.onResume} />
        <View style={styles.row}>
          <Button3D label="Restart" variant="cream" onPress={p.onRestart} style={styles.half} />
          <Button3D label="Quit" variant="cream" style={styles.half} />
        </View>
        <View style={styles.settings}>
          <View style={[styles.setting, styles.divider]}>
            <Text style={styles.settingLabel}>Sound</Text>
            <Switch accessibilityLabel="Sound" value={p.sound} onValueChange={p.onToggleSound} trackColor={{ true: C.mint, false: '#D9CFE3' }} />
          </View>
          <View style={styles.setting}>
            <Text style={styles.settingLabel}>Haptics</Text>
            <Switch accessibilityLabel="Haptics" value={p.haptics} onValueChange={p.onToggleHaptics} trackColor={{ true: C.mint, false: '#D9CFE3' }} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(43,29,58,0.42)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: 20, gap: 14,
    borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: C.cream, boxShadow: '0 -12px 40px rgba(43,29,58,0.3)',
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 999, backgroundColor: '#DCCFE6' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: F.display, fontSize: 28, color: C.plum },
  sub: { fontFamily: F.body, fontSize: 14, color: C.muted, marginTop: 2 },
  scoreBox: { alignItems: 'flex-end' },
  score: { fontFamily: F.display, fontSize: 26, color: C.purple, fontVariant: ['tabular-nums'] },
  caption: { fontFamily: F.body, fontSize: 11, letterSpacing: 0.8, color: C.muted, marginTop: 2 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  settings: { borderRadius: 22, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line, paddingHorizontal: 16 },
  setting: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divider: { borderBottomWidth: 1, borderBottomColor: '#F3E9DC' },
  settingLabel: { fontFamily: F.body, fontSize: 16, color: C.plum },
});
