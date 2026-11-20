import { useState } from 'react';
import { Pressable, type GestureResponderEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

/** Pressable that can take an animated style (for the press-in scale below). */
export const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SPRING = { damping: 18, stiffness: 420, mass: 0.6 };

/**
 * Tactile press feedback: the control shrinks slightly while a finger is on it and springs back
 * when released (current iOS/Android practice). Off when the phone's "Reduce motion" is on.
 */
export function usePressScale(
  handlers: { onPressIn?: ((e: GestureResponderEvent) => void) | null; onPressOut?: ((e: GestureResponderEvent) => void) | null } = {},
  to = 0.97,
) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    pressed,
    style,
    onPressIn: (e: GestureResponderEvent) => {
      setPressed(true);
      if (!reduce) scale.set(withSpring(to, SPRING));
      handlers.onPressIn?.(e);
    },
    onPressOut: (e: GestureResponderEvent) => {
      setPressed(false);
      if (!reduce) scale.set(withSpring(1, SPRING));
      handlers.onPressOut?.(e);
    },
  };
}
