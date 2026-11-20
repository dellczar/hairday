import { useEffect, useState } from 'react';
import { StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors, radius } from '@/theme';

type Props = { width?: DimensionValue; height: number; rounded?: number; style?: ViewStyle; tone?: 'placeholder' | 'lineSoft' };

/**
 * Loading block (SPEC §10: every list has a loading state). A soft light band sweeps across it,
 * the way current iOS and Android apps show loading. With "Reduce motion" on, it stays still.
 */
export function Skeleton({ width = '100%', height, rounded = radius.card, style, tone = 'placeholder' }: Props) {
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    if (reduce || !w) return;
    x.value = 0;
    x.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [x, reduce, w]);
  const band = Math.min(160, Math.max(60, w * 0.35));
  const anim = useAnimatedStyle(() => ({ transform: [{ translateX: -band + x.value * (w + band * 2) }, { skewX: '-18deg' }] }));
  return (
    <View
      accessible
      accessibilityLabel="Loading"
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[{ width, height, borderRadius: rounded, backgroundColor: colors[tone] }, styles.clip, style]}>
      {!reduce && w ? <Animated.View style={[styles.band, { width: band }, anim]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  band: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: colors.shimmer },
});
