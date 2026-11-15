import { router, useLocalSearchParams } from 'expo-router';
import { CalendarClock, Clock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BackButton, Button, Card, EmptyState, Skeleton } from '@/components';
import { useHeldBooking, useReleaseHold } from '@/hooks/useBooking';
import { HOLD_MINUTES } from '@/lib/availability';
import { formatDuration, formatTime, zonedClock } from '@/lib/hours';
import { formatPrice } from '@/lib/money';
import { colors, fonts, space } from '@/theme';

/**
 * Review & pay (Confirm.html) — Phase 4 version. The time is held for 10 minutes; payment,
 * tips and the booking fee arrive in Phase 5, on this same screen.
 */
export default function HeldTime() {
  const { booking: bookingId } = useLocalSearchParams<{ salonId: string; booking: string }>();
  const insets = useSafeAreaInsets();
  const q = useHeldBooking(bookingId);
  const release = useReleaseHold();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (q.isPending) {
    return (
      <View style={[styles.screen, styles.pad, { paddingTop: insets.top + 8, gap: space.l }]}>
        <Skeleton height={44} width={44} rounded={22} />
        <Skeleton height={220} />
      </View>
    );
  }
  const d = q.data;
  if (!d) {
    return (
      <View style={[styles.screen, styles.pad, { paddingTop: insets.top + 8 }]}>
        <BackButton />
        <EmptyState title="Booking not found" body="Go back and pick a time again." />
      </View>
    );
  }

  const { booking, business, pro, items } = d;
  const tz = business?.time_zone ?? 'America/New_York';
  const expiresAt = new Date(booking.created_at).getTime() + HOLD_MINUTES * 60_000;
  const left = Math.max(0, expiresAt - now);
  const expired = booking.status !== 'pending_payment' || left === 0;
  const mm = Math.floor(left / 60_000);
  const ss = Math.floor((left % 60_000) / 1000);
  const start = new Date(booking.starts_at);
  const clock = zonedClock(start, tz);
  const dateLabel = start.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' });
  const minutes = items.reduce((s, i) => s + i.duration_min, 0);

  const pickAgain = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const letGo = () =>
    Alert.alert('Let go of this time?', 'Someone else will be able to book it.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Let go',
        style: 'destructive',
        onPress: async () => {
          try {
            await release.mutateAsync(booking.id);
          } catch {
            // Nothing to undo: the hold runs out on its own in a few minutes.
          }
          pickAgain();
        },
      },
    ]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.pad, styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + space.xxl }]}>
        <View style={styles.header}>
          <BackButton onPress={pickAgain} />
          <AppText style={styles.title} accessibilityRole="header">
            Review your booking
          </AppText>
        </View>

        <View style={[styles.timer, expired && styles.timerOut]} accessibilityLiveRegion="polite">
          <Clock size={20} strokeWidth={1.8} color={expired ? colors.danger : colors.goldText} />
          <AppText
            variant="small"
            color={expired ? 'danger' : 'inkSoft'}
            style={styles.flex1}
            accessibilityLabel={expired ? 'Your hold ran out' : `Time held for ${mm} minutes ${ss} seconds`}>
            {expired ? 'Your hold ran out, so the time was let go.' : `We’re holding this time for you for ${mm}:${String(ss).padStart(2, '0')}.`}
          </AppText>
        </View>

        <Card big>
          <View style={styles.cardBody}>
            <AppText variant="cardTitle" style={styles.salon}>
              {business?.name ?? 'Salon'}
            </AppText>
            <View style={styles.when}>
              <CalendarClock size={18} strokeWidth={1.8} color={colors.ink} />
              <AppText style={styles.semibold}>
                {dateLabel}, {formatTime(clock.minutes)}
              </AppText>
            </View>
            <AppText variant="small" color="muted">
              {formatDuration(minutes)}
              {pro ? ` · with ${pro.first_name}` : ''}
            </AppText>
            <View style={styles.divider} />
            {items.map((i) => (
              <View key={i.service_id} style={styles.line}>
                <AppText style={styles.flex1}>{i.name}</AppText>
                <AppText>{formatPrice(i.price_cents)}</AppText>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.line}>
              <AppText style={[styles.flex1, styles.semibold]}>Services</AppText>
              <AppText style={styles.semibold}>{formatPrice(booking.subtotal_cents)}</AppText>
            </View>
          </View>
        </Card>

        <View style={styles.note}>
          <AppText variant="caption" color="inkSoft">
            Tip, payment (card, Apple Pay or Google Pay) and confirming the booking come in the next phase. For now your time stays held for 10
            minutes and is then let go.
          </AppText>
        </View>

        {expired ? (
          <Button title="Pick another time" onPress={pickAgain} />
        ) : (
          <Button title="Let go of this time" variant="secondary" onPress={letGo} loading={release.isPending} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: space.screen },
  content: { gap: space.l },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  title: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.tint, borderRadius: 16, padding: 14 },
  timerOut: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  flex1: { flex: 1 },
  cardBody: { gap: space.s },
  salon: { fontSize: 26, lineHeight: 28 },
  when: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  semibold: { fontFamily: fonts.semibold },
  divider: { height: 1, backgroundColor: colors.lineSoft, marginVertical: space.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  note: { backgroundColor: colors.tint, borderRadius: 16, padding: 14 },
});
