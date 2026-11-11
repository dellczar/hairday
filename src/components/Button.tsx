import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type ViewStyle } from 'react-native';

import { colors, radius, space, touch, type ColorName } from '@/theme';

import { AppText } from './AppText';

/**
 * Button hierarchy (SPEC §5):
 * - gold: the one main action on money screens (navy text, never white)
 * - primary: navy fill, white text — other primary buttons
 * - secondary: white with a line border
 * - light: ivory fill on navy screens (Welcome "Continue with Apple")
 * - outlineDark: transparent with a soft border on navy screens
 */
export type ButtonVariant = 'gold' | 'primary' | 'secondary' | 'light' | 'outlineDark';

const look: Record<ButtonVariant, { bg: string; fg: ColorName; border?: string }> = {
  gold: { bg: colors.gold, fg: 'onGold' },
  primary: { bg: colors.ink, fg: 'white' },
  secondary: { bg: colors.surface, fg: 'ink', border: colors.line },
  light: { bg: colors.onDark, fg: 'ink' },
  outlineDark: { bg: 'transparent', fg: 'onDark', border: colors.onDarkLine },
};

type Props = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: ButtonVariant;
  icon?: ReactNode;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({ title, variant = 'primary', icon, loading = false, disabled, style, ...rest }: Props) {
  const l = look[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: l.bg, borderColor: l.border ?? 'transparent', borderWidth: l.border ? 1 : 0 },
        pressed && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors[l.fg]} />
      ) : (
        <View style={styles.row}>
          {icon}
          <AppText variant="button" color={l.fg}>
            {title}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: touch },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
});
