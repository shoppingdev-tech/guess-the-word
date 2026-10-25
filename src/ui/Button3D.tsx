import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { C, F, MANGO } from './theme';

type Variant = 'mango' | 'cream';

const LOOK = {
  mango: { face: MANGO, edge: '#B8460F', text: '#FFFFFF', size: 24, height: 58, border: 0, shadow: '0 12px 22px rgba(224,82,12,0.3)' },
  cream: { face: 'linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 100%)', edge: C.creamEdge, text: C.plum, size: 18, height: 50, border: 2, shadow: '0 8px 16px rgba(122,62,30,0.1)' },
} as const;

type Props = { label: string; variant: Variant; onPress?: () => void; style?: StyleProp<ViewStyle> };

// Chunky pill: a darker 5px edge underneath; the face sinks 3px on press and springs back.
export function Button3D({ label, variant, onPress, style }: Props) {
  const look = LOOK[variant];
  const p = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: p.value * 3 }, { scale: 1 - p.value * 0.03 }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => {
        p.value = withTiming(1, { duration: 70 });
      }}
      onPressOut={() => {
        p.value = withSpring(0, { damping: 12, stiffness: 320 });
      }}
      style={[{ height: look.height + 5 }, style]}
    >
      <View style={[styles.edge, { height: look.height, backgroundColor: look.edge, boxShadow: look.shadow }]} />
      <Animated.View
        style={[styles.face, { height: look.height, backgroundImage: look.face, borderWidth: look.border, borderColor: '#E6D6C2' }, faceStyle]}
      >
        <Text style={[styles.label, { color: look.text, fontSize: look.size }, variant === 'mango' && styles.labelShadow]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  edge: { position: 'absolute', left: 0, right: 0, top: 5, borderRadius: 999 },
  face: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: F.display, letterSpacing: 0.4 },
  labelShadow: { textShadowColor: 'rgba(150,50,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 },
});
