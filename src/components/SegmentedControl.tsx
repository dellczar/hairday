import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';

import { AppText } from './AppText';

type Props<K extends string> = {
  options: readonly { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
};

/** Tan pill with a white selected segment (MyBookings.html: Upcoming / Past). */
export function SegmentedControl<K extends string>({ options, value, onChange }: Props<K>) {
  return (
    <View accessibilityRole="tablist" style={styles.track}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            hitSlop={{ top: 2, bottom: 2 }}
            onPress={() => {
              if (!on) Haptics.selectionAsync().catch(() => {});
              onChange(o.key);
            }}
            style={[styles.seg, on && styles.segOn]}>
            <AppText variant="smallStrong">{o.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: colors.tint, borderRadius: radius.pill, padding: 4 },
  seg: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: colors.surface },
});
