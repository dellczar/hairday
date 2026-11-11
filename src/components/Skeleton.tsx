import { useEffect } from 'react';
import type { DimensionValue, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, useReducedMotion } from 'react-native-reanimated';

import { colors, radius } from '@/theme';

type Props = { width?: DimensionValue; height: number; rounded?: number; style?: ViewStyle };

/** Tan loading block (SPEC §10: every list has a loading state). */
export function Skeleton({ width = '100%', height, rounded = radius.card, style }: Props) {
  const reduce = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!reduce) opacity.value = withRepeat(withTiming(0.55, { duration: 800 }), -1, true);
  }, [opacity, reduce]);
  const anim = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      accessibilityLabel="Loading"
      style={[{ width, height, borderRadius: rounded, backgroundColor: colors.placeholder }, anim, style]}
    />
  );
}
