import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet } from 'react-native';

import { colors, fonts, radius, space } from '@/theme';

import { AppText } from './AppText';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

/** Selectable pill (Filters.html): white with a line border, navy when selected. Haptic tick on select. */
export function Chip({ label, selected = false, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={{ top: 2, bottom: 2 }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [styles.base, selected ? styles.on : styles.off, pressed && { opacity: 0.85 }]}>
      <AppText variant="small" color={selected ? 'white' : 'ink'} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
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
