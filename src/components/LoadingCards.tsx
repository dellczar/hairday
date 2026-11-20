import { StyleSheet, View } from 'react-native';

import { colors, radius, space } from '@/theme';

import { Skeleton } from './Skeleton';

/**
 * Loading versions of the real cards, the same shape and size, so the screen doesn't jump when
 * the content arrives and it feels faster (current iOS/Android practice). The whole card is one
 * "Loading" item for screen readers.
 */

/** Matches SalonCard (Results.html): three photos, name, rating line, price and Book pill. */
export function SalonCardSkeleton() {
  return (
    <View style={styles.salon} accessible accessibilityLabel="Loading salon">
      <View style={styles.photos}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={88} rounded={12} style={styles.flex1} />
        ))}
      </View>
      <View style={styles.lines}>
        <Skeleton height={16} width="62%" rounded={6} tone="lineSoft" />
        <Skeleton height={12} width="78%" rounded={6} tone="lineSoft" />
      </View>
      <View style={styles.bottom}>
        <Skeleton height={14} width={110} rounded={6} tone="lineSoft" />
        <Skeleton height={40} width={76} rounded={radius.pill} tone="lineSoft" />
      </View>
    </View>
  );
}

/** Matches the booking card in My bookings: date tile, three lines, row of actions. */
export function BookingCardSkeleton() {
  return (
    <View style={styles.booking} accessible accessibilityLabel="Loading booking">
      <View style={styles.bookingTop}>
        <Skeleton height={60} width={56} rounded={14} />
        <View style={[styles.lines, styles.flex1]}>
          <Skeleton height={16} width="55%" rounded={6} tone="lineSoft" />
          <Skeleton height={12} width="80%" rounded={6} tone="lineSoft" />
          <Skeleton height={12} width="45%" rounded={6} tone="lineSoft" />
        </View>
      </View>
      <View style={styles.actions}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.action}>
            <Skeleton height={12} width="55%" rounded={6} tone="lineSoft" />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  salon: {
    backgroundColor: colors.surface,
    borderRadius: radius.bigCard,
    padding: space.m,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.cardLine,
  },
  photos: { flexDirection: 'row', gap: 6 },
  lines: { gap: 8, paddingHorizontal: space.xs },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xs },
  booking: {
    backgroundColor: colors.surface,
    borderRadius: radius.bigCard,
    borderWidth: 1,
    borderColor: colors.cardLine,
    overflow: 'hidden',
  },
  bookingTop: { flexDirection: 'row', alignItems: 'center', gap: space.l, padding: space.l },
  actions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.lineSoft },
  action: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
});
