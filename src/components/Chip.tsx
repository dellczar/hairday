import * as Haptics from 'expo-haptics';
import { StyleSheet } from 'react-native';

import { colors, fonts, radius, space } from '@/theme';

import { AppText } from './AppText';
import { AnimatedPressable, usePressScale } from './pressScale';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

/** Selectable pill (Filters.html): white with a line border, navy when selected. Haptic tick on select. */
export function Chip({ label, selected = false, onPress }: Props) {
  const press = usePressScale({}, 0.95);
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={{ top: 2, bottom: 2 }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[styles.base, selected ? styles.on : styles.off, press.style]}>
      <AppText variant="small" color={selected ? 'white' : 'ink'} style={styles.label}>
        {label}
      </AppText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 40,
    paddingHorizontal: space.l,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: { backgroundColor: colors.ink, borderColor: colors.ink },
  off: { backgroundColor: colors.surface, borderColor: colors.line },
  label: { fontFamily: fonts.medium },
});
