import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatDay, isoDate, WEEK } from '@/lib/hours';
import { colors, fonts, radius, space, touch } from '@/theme';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

/**
 * Month grid, Monday first. Days from `from` to `to` are highlighted (gold ends, tinted middle);
 * pass the same day twice to pick a single date, or '' for nothing picked yet. Days before `min` can't be picked.
 * Used for time off (Availability) and "Pick date" (Filters).
 */
export function MonthCalendar({ from, to, min, onPick }: { from: string; to: string; min: string; onPick: (day: string) => void }) {
  const [month, setMonth] = useState(() => {
    const [y, m] = (from || isoDate(new Date())).split('-').map(Number) as [number, number];
    return new Date(y, m - 1, 1);
  });
  const title = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const lead = (month.getDay() + 6) % 7; // Monday-first grid
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: count }, (_, i) => isoDate(new Date(month.getFullYear(), month.getMonth(), i + 1))),
  ];
  const isCurrent = month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth();

  return (
    <View style={styles.cal}>
      <View style={styles.calHead}>
        <IconButton
          accessibilityLabel="Previous month"
          bare
          disabled={isCurrent}
          onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          <ChevronLeft size={20} strokeWidth={1.8} color={isCurrent ? colors.placeholder : colors.ink} />
        </IconButton>
        <AppText variant="bodyStrong">{title}</AppText>
        <IconButton accessibilityLabel="Next month" bare onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
          <ChevronRight size={20} strokeWidth={1.8} color={colors.ink} />
        </IconButton>
      </View>
      <View style={styles.calGrid}>
        {WEEK.map((w) => (
          <AppText key={w.weekday} variant="label" color="muted" style={styles.calDow} importantForAccessibility="no">
            {w.short}
          </AppText>
        ))}
        {cells.map((day, i) => {
          if (!day) return <View key={`e${i}`} style={styles.calCell} />;
          const past = day < min;
          const inRange = day >= from && day <= to;
          const edge = !!from && (day === from || day === to);
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={formatDay(day)}
              accessibilityState={{ selected: inRange, disabled: past }}
              disabled={past}
              onPress={() => onPick(day)}
              style={[styles.calCell, inRange && styles.calIn, edge && styles.calEdge]}>
              <AppText variant="small" color={past ? 'placeholder' : edge ? 'onGold' : 'ink'} style={edge && { fontFamily: fonts.semibold }}>
                {Number(day.slice(8))}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cal: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardLine, borderRadius: radius.card, padding: space.s },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDow: { width: '14.28%', textAlign: 'center', paddingVertical: 4 },
  calCell: { width: '14.28%', height: touch, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  calIn: { backgroundColor: colors.tint },
  calEdge: { backgroundColor: colors.gold },
});
