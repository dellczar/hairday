import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, space, touch, type ColorName } from '@/theme';

import { AppText } from './AppText';

type Variant = 'primary' | 'gold' | 'secondary';

const look: Record<Variant, { bg: string; fg: ColorName; border?: string }> = {
  primary: { bg: colors.ink, fg: 'white' },
  gold: { bg: colors.gold, fg: 'onGold' },
  secondary: { bg: colors.surface, fg: 'ink', border: colors.line },
};

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/** Small header action: "Add" (Services.html), "Save" (Availability.html, gold), "Preview" (BizProfile.html). */
export function PillButton({ title, onPress, variant = 'primary', icon, loading, disabled, accessibilityLabel }: Props) {
  const l = look[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: l.bg, borderColor: l.border ?? l.bg },
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.45 },
      ]}>
      {loading ? (
        <ActivityIndicator color={colors[l.fg]} />
      ) : (
        <View style={styles.row}>
          {icon}
          <AppText variant="smallStrong" color={l.fg}>
            {title}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: touch, paddingHorizontal: space.l, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
