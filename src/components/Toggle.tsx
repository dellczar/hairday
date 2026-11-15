import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, touch } from '@/theme';

type Props = {
  value: boolean;
  onChange: (v: boolean) => void;
  /** What the switch controls, read by screen readers ("Monday working"). */
  accessibilityLabel: string;
  disabled?: boolean;
};

/** On/off switch from Availability.html and Services.html: 48×28 track, navy on, tan off, 44 pt tap area. */
export function Toggle({ value, onChange, accessibilityLabel, disabled }: Props) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onChange(!value);
      }}
      style={[styles.hit, disabled && { opacity: 0.45 }]}>
      <View style={[styles.track, { backgroundColor: value ? colors.ink : colors.placeholder, justifyContent: value ? 'flex-end' : 'flex-start' }]}>
        <View style={styles.knob} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { width: 56, height: touch, alignItems: 'center', justifyContent: 'center' },
  track: { width: 48, height: 28, borderRadius: radius.pill, padding: 3, flexDirection: 'row' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white },
});
