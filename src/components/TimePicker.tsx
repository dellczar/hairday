import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatTime, timeOptions } from '@/lib/hours';
import { colors, fonts, radius, space, touch } from '@/theme';

import { AppText } from './AppText';
import { ModalSheet } from './ModalSheet';

type Props = {
  label: string;
  /** Minutes after midnight. */
  value: number;
  onChange: (min: number) => void;
  step?: number;
  /** Earliest / latest choices offered (minutes). */
  min?: number;
  max?: number;
};

/**
 * A row like "Opens  [10:00 AM]" (Setup.html step 3). Tapping it opens a sheet of times as chips.
 * Built from chips rather than a spinning wheel so it looks the same on iOS and Android.
 */
export function TimeRow({ label, value, onChange, step = 30, min, max }: Props) {
  const [open, setOpen] = useState(false);
  const options = timeOptions(step, min, max);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatTime(value)}`}
        accessibilityHint="Opens a list of times"
        onPress={() => setOpen(true)}
        style={styles.row}>
        <AppText>{label}</AppText>
        <View style={styles.pill}>
          <AppText variant="bodyStrong">{formatTime(value)}</AppText>
        </View>
      </Pressable>
      <ModalSheet visible={open} onClose={() => setOpen(false)} title={label}>
        <View style={styles.grid}>
          {options.map((m) => {
            const on = m === value;
            return (
              <View key={m} style={styles.cell}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    onChange(m);
                    setOpen(false);
                  }}
                  style={[styles.chip, on ? styles.chipOn : styles.chipOff]}>
                  <AppText variant="small" color={on ? 'onGold' : 'ink'} style={{ fontFamily: fonts.medium }}>
                    {formatTime(m)}
                  </AppText>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ModalSheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pill: {
    minHeight: 36,
    paddingHorizontal: space.m,
    borderRadius: 10,
    backgroundColor: colors.bg,
    justifyContent: 'center',
  },
  // Four equal columns: each cell is 25% wide with half a gap of padding on each side.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -space.s / 2,
  },
  cell: { width: '25%', padding: space.s / 2 },
  chip: {
    minHeight: touch,
    borderRadius: radius.input,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipOff: { backgroundColor: colors.surface, borderColor: colors.line },
});
