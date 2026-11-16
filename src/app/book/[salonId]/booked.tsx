import { router, useLocalSearchParams } from 'expo-router';
import { Check, Navigation } from 'lucide-react-native';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Headline, Skeleton } from '@/components';
import { useHeldBooking } from '@/hooks/useBooking';
import { formatDuration, formatTime, zonedClock } from '@/lib/hours';
import { directionsUrl } from '@/lib/links';
import { colors, fonts, radius, space } from '@/theme';

/**
 * "You're booked." (Booked.html). Email confirmations, reminders and Add to calendar arrive with
 * notifications in Phase 7, so the text says what's true today: the card is saved, not charged.
 */
export default function Booked() {
  const { booking: bookingId } = useLocalSearchParams<{
    salonId: string;
    booking: string;
  }>();
  const insets = useSafeAreaInsets();
  const q = useHeldBooking(bookingId);
  const d = q.data;

  const tz = d?.business?.time_zone ?? 'America/New_York';
  const start = d ? new Date(d.booking.starts_at) : null;
  const month = start?.toLocaleDateString('en-US', { timeZone: tz, month: 'short' }).toUpperCase();
  const day = start?.toLocaleDateString('en-US', {
    timeZone: tz,
    day: 'numeric',
  });
  const weekday = start?.toLocaleDateString('en-US', {
    timeZone: tz,
    weekday: 'long',
  });
  const minutes = d?.items.reduce((s, i) => s + i.duration_min, 0) ?? 0;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 34 }]}>
        <View style={styles.top}>
          <View style={styles.badge} accessible={false}>
            <Check size={40} strokeWidth={2.2} color={colors.onGold} />
          </View>
          <Headline text="You’re" accent="booked." style={styles.h1} />
          <AppText color="muted" style={styles.lead}>
            Your card is saved and you won’t be charged until after your appointment.
          </AppText>
        </View>

        {!d || !start ? (
          <Skeleton height={150} />
        ) : (
          <View style={styles.card}>
            <View style={styles.cardBody}>
              <View style={styles.date} accessible accessibilityLabel={`${weekday} ${month} ${day}`}>
                <AppText style={styles.month} color="white">
                  {month}
                </AppText>
                <AppText style={styles.day} color="white">
                  {day}
                </AppText>
              </View>
              <View style={styles.flex1}>
                <AppText style={styles.when}>
                  {weekday} · {formatTime(zonedClock(start, tz).minutes)}
                </AppText>
                <AppText variant="small" color="muted">
                  {d.items.map((i) => i.name).join(', ')}
                  {d.pro ? ` with ${d.pro.first_name}` : ''} · {formatDuration(minutes)}
                </AppText>
                <AppText variant="small" color="muted">
                  {d.business?.name}
                  {d.business?.address_line1 ? `, ${d.business.address_line1}` : ''}
                </AppText>
              </View>
            </View>
            {d.business ? (
              <Pressable
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                accessibilityRole="link"
                accessibilityLabel={`Directions to ${d.business.name}`}
                onPress={() => Linking.openURL(directionsUrl(d.business!, Platform.OS === 'ios' ? 'ios' : 'android')).catch(() => {})}>
                <Navigation size={18} strokeWidth={1.8} color={colors.ink} />
                <AppText style={styles.actionText}>Directions</AppText>
              </Pressable>
            ) : null}
          </View>
        )}

        <View style={styles.flex1} />
        <View style={styles.buttons}>
          <Button title="View my bookings" onPress={() => router.replace('/(customer)/(tabs)/bookings')} />
          <Button title="Back to home" variant="secondary" onPress={() => router.replace('/(customer)/(tabs)')} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, paddingHorizontal: space.screen, gap: 32 },
  top: { alignItems: 'center', gap: 14 },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: {
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1,
    marginTop: 8,
    textAlign: 'center',
  },
  lead: { textAlign: 'center', maxWidth: 290, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderRadius: radius.bigCard,
    overflow: 'hidden',
  },
  cardBody: {
    padding: 18,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  date: {
    width: 56,
    minHeight: 60,
    borderRadius: 14,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  month: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.semibold,
    letterSpacing: 1.2,
  },
  day: { fontFamily: fonts.display, fontSize: 28, lineHeight: 30 },
  flex1: { flex: 1, gap: 3 },
  when: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  action: {
    minHeight: 52,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s,
  },
  actionText: { fontFamily: fonts.medium, fontSize: 14 },
  pressed: { opacity: 0.7 },
  buttons: { gap: 10 },
});
