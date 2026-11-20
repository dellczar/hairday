import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type PressableProps, type ViewStyle } from 'react-native';

import { colors, radius, space, touch, type ColorName } from '@/theme';

import { AppText } from './AppText';
import { AnimatedPressable, usePressScale } from './pressScale';

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

export function Button({ title, variant = 'primary', icon, loading = false, disabled, style, onPressIn, onPressOut, ...rest }: Props) {
  const l = look[variant];
  const isDisabled = disabled || loading;
  const press = usePressScale({ onPressIn, onPressOut });
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      {...rest}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        styles.base,
        { backgroundColor: l.bg, borderColor: l.border ?? 'transparent', borderWidth: l.border ? 1 : 0 },
        press.pressed && styles.pressed,
        isDisabled && styles.disabled,
        style,
        press.style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors[l.fg]} />
      ) : (
        <View style={[styles.row, !icon && styles.fill]}>
          {icon}
          <AppText variant="button" color={l.fg} style={!icon ? styles.fillText : undefined}>
            {title}
          </AppText>
        </View>
      )}
    </AnimatedPressable>
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
  // Without an icon the label spans the whole button (centered). On Android a label sized to its
  // own measured width can come out a few pixels short and drop its last word ("Add time off").
  fill: { alignSelf: 'stretch' },
  // flexGrow (not flex: 1 or width 100%) so buttons that size to their label keep their natural width.
  fillText: { flexGrow: 1, textAlign: 'center' },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.45 },
});
