import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { colors, touch } from '@/theme';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  /** Required: icon-only buttons must have a screen reader label. */
  accessibilityLabel: string;
  children: ReactNode;
  tone?: 'light' | 'dark';
};

/** 44×44 round button (back, close, favorite…). */
export function IconButton({ children, tone = 'light', ...rest }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={4}
      {...rest}
      style={({ pressed }) => [styles.base, tone === 'dark' ? styles.dark : styles.light, pressed && { opacity: 0.8 }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { width: touch, height: touch, borderRadius: touch / 2, alignItems: 'center', justifyContent: 'center' },
  light: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  dark: { backgroundColor: colors.ink },
});
