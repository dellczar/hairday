import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEFAULT_FILTERS, FILTER_SERVICES, SORT_LABELS, type SearchFilters, type SortKey, type When } from '@/lib/discovery';
import { formatDay, isoDate } from '@/lib/hours';
import { colors, fonts, radius, space, touch } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Chip } from './Chip';
import { IconButton } from './IconButton';
import { MonthCalendar } from './MonthCalendar';
import { RangeSlider } from './RangeSlider';

/** Price slider range, in dollars. The top end means "no limit". */
const PRICE_MIN = 0;
const PRICE_MAX = 300;
const PRICE_STEP = 5;

type Props = {
  visible: boolean;
  value: SearchFilters;
  onClose: () => void;
  onApply: (f: SearchFilters) => void;
  /** How many salons a set of filters would show ("Show 24 salons"). */
  countFor: (f: SearchFilters) => number;
};

/** Filters sheet over Explore (Filters.html). Changes apply when "Show N salons" is tapped. */
export function FiltersSheet({ visible, ...rest }: Props) {
  // Mounted only while open, so it starts from the filters in use each time.
  return visible ? <FiltersPanel {...rest} /> : null;
}

function FiltersPanel({ value, onClose, onApply, countFor }: Omit<Props, 'visible'>) {
  const insets = useSafeAreaInsets();
  const [f, setF] = useState<SearchFilters>(value);
  const [picking, setPicking] = useState(typeof value.when === 'object');
  const set = (patch: Partial<SearchFilters>) => setF((cur) => ({ ...cur, ...patch }));
  const count = countFor(f);

  const low = f.priceMin === null ? PRICE_MIN : f.priceMin / 100;
  const high = f.priceMax === null ? PRICE_MAX : f.priceMax / 100;
  const money = (d: number) => (d >= PRICE_MAX ? `$${PRICE_MAX}+` : `$${d}`);
  const today = isoDate(new Date());
  const pickedDate = typeof f.when === 'object' ? f.when.date : null;

  const whens: { key: 'today' | 'tomorrow' | 'pick'; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'tomorrow', label: 'Tomorrow' },
    { key: 'pick', label: pickedDate ? formatDay(pickedDate).replace(/^\w+, /, '') : 'Pick date' },
  ];
  const whenOn = (k: string) => (k === 'pick' ? !!pickedDate || picking : f.when === k);
  const pickWhen = (k: 'today' | 'tomorrow' | 'pick') => {
    Haptics.selectionAsync().catch(() => {});
    if (k === 'pick') {
      // Tapping it again closes the calendar and clears the date.
      if (picking || pickedDate) {
        setPicking(false);
        return set({ when: 'any' });
      }
      return setPicking(true);
    }
    setPicking(false);
    set({ when: f.when === k ? 'any' : (k as When) });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      {/* Gestures inside a Modal need their own root view on Android (the price slider). */}
      <GestureHandlerRootView style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close filters" />
        <Animated.View entering={SlideInDown.duration(260)} style={[styles.panel, { marginTop: insets.top + 20 }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.header}>
            <IconButton accessibilityLabel="Close filters" bare onPress={onClose}>
              <X size={22} strokeWidth={1.8} color={colors.ink} />
            </IconButton>
            <AppText accessibilityRole="header" style={styles.title}>
              Filters
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset filters"
              onPress={() => {
                setPicking(false);
                setF({ ...DEFAULT_FILTERS, query: f.query });
              }}
              style={styles.reset}>
              <AppText variant="small" style={styles.resetText}>
                Reset
              </AppText>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            <View style={styles.group}>
              <AppText style={styles.h2} accessibilityRole="header">
                Service
              </AppText>
              <View style={styles.chips}>
                {FILTER_SERVICES.map((s) => {
                  const on = f.categories.includes(s.slug);
                  return (
                    <Chip
                      key={s.slug}
                      label={s.label}
                      selected={on}
                      onPress={() => set({ categories: on ? f.categories.filter((c) => c !== s.slug) : [...f.categories, s.slug] })}
                    />
                  );
                })}
              </View>
            </View>

            <View style={styles.group}>
              <AppText style={styles.h2} accessibilityRole="header">
                When
              </AppText>
              <View style={styles.whenRow}>
                {whens.map((w) => {
                  const on = whenOn(w.key);
                  return (
                    <Pressable
                      key={w.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={w.key === 'pick' && pickedDate ? `Date, ${formatDay(pickedDate)}` : w.label}
                      onPress={() => pickWhen(w.key)}
                      style={[styles.when, on ? styles.whenOn : styles.whenOff]}>
                      <AppText variant="small" color={on ? 'white' : 'ink'} style={styles.medium} numberOfLines={1}>
                        {w.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
              {picking ? (
                <MonthCalendar
                  from={pickedDate ?? ''}
                  to={pickedDate ?? ''}
                  min={today}
                  onPick={(day) => {
                    set({ when: { date: day } });
                    setPicking(false);
                  }}
                />
              ) : null}
            </View>

            <View style={styles.group}>
              <View style={styles.priceHead}>
                <AppText style={styles.h2} accessibilityRole="header">
                  Price
                </AppText>
                <AppText variant="small" color="muted">
                  {low === PRICE_MIN && high === PRICE_MAX ? 'Any price' : `${money(low)} – ${money(high)}`}
                </AppText>
              </View>
              <RangeSlider
                label="Price"
                min={PRICE_MIN}
                max={PRICE_MAX}
                step={PRICE_STEP}
                low={low}
                high={high}
                format={money}
                onChange={(l, h) => set({ priceMin: l === PRICE_MIN ? null : l * 100, priceMax: h === PRICE_MAX ? null : h * 100 })}
              />
            </View>

            <View style={styles.sortGroup} accessibilityRole="radiogroup">
              <AppText style={[styles.h2, styles.sortTitle]} accessibilityRole="header">
                Sort by
              </AppText>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => {
                const on = f.sort === k;
                return (
                  <Pressable
                    key={k}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      set({ sort: k });
                    }}
                    style={styles.sortRow}>
                    <AppText style={styles.medium}>{SORT_LABELS[k]}</AppText>
                    <View style={[styles.radio, on ? styles.radioOn : styles.radioOff]} />
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + space.l }]}>
            <Button
              title={count === 0 ? 'No salons match' : `Show ${count} ${count === 1 ? 'salon' : 'salons'}`}
              disabled={count === 0}
              onPress={() => onApply(f)}
            />
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.inkGlass },
  panel: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: 10,
    overflow: 'hidden',
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.placeholder, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.screen, paddingTop: 10 },
  title: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  reset: { minHeight: touch, minWidth: touch, alignItems: 'flex-end', justifyContent: 'center' },
  resetText: { fontFamily: fonts.medium, textDecorationLine: 'underline' },
  content: { paddingHorizontal: space.screen, paddingTop: space.s, paddingBottom: space.xxl, gap: 22 },
  group: { gap: 10 },
  h2: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  whenRow: { flexDirection: 'row', gap: space.s },
  when: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.input,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
  },
  whenOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  whenOff: { backgroundColor: colors.surface, borderColor: colors.line },
  medium: { fontFamily: fonts.medium },
  priceHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sortGroup: { gap: space.xs },
  sortTitle: { marginBottom: space.xs },
  sortRow: {
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardLine,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radio: { width: 22, height: 22, borderRadius: 11 },
  radioOn: { borderWidth: 7, borderColor: colors.ink },
  radioOff: { borderWidth: 1.5, borderColor: colors.placeholder },
  footer: { paddingTop: 14, paddingHorizontal: space.screen, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
});
