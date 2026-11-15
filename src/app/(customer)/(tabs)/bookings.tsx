import { useFocusEffect } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, EmptyState, Headline, ModalSheet, SegmentedControl, Skeleton } from '@/components';
import { useCancelBooking, useMyBookings } from '@/hooks/useBooking';
import { useSession } from '@/hooks/useSession';
import { formatTime, zonedClock } from '@/lib/hours';
import { directionsUrl } from '@/lib/links';
import { formatPrice } from '@/lib/money';
import { cancellationQuote, FREE_CANCEL_HOURS } from '@/lib/payments';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, fonts, radius, space } from '@/theme';

type Item = NonNullable<ReturnType<typeof useMyBookings>['data']>[number];
type View_ = 'upcoming' | 'past';

/**
 * My bookings (MyBookings.html), Phase 5 part: upcoming appointments with Directions and Cancel, and
 * past ones. Reschedule, reviews and "Book again" arrive in Phase 7.
 */
export default function Bookings() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useSession();
  const signedIn = !!session || !isSupabaseConfigured;
  const q = useMyBookings();
  const [tab, setTab] = useState<View_>('upcoming');
  const [cancelling, setCancelling] = useState<Item | null>(null);
  // "Now" for upcoming/past and the free-cancel window; refreshed whenever the tab is opened.
  const [now, setNow] = useState(() => Date.now());
  const { refetch } = q;

  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      refetch();
    }, [refetch]),
  );

  const all = q.data ?? [];
  const upcoming = all
    .filter((x) => x.booking.status === 'confirmed' && new Date(x.booking.ends_at).getTime() > now)
    .sort((a, b) => a.booking.starts_at.localeCompare(b.booking.starts_at));
  const past = all.filter((x) => !upcoming.includes(x));
  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + space.xxl,
          },
        ]}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}>
        <Headline text="My" accent="bookings" style={styles.title} />
        {!signedIn ? (
          <EmptyState
            icon={<CalendarDays color={colors.goldText} size={28} strokeWidth={1.8} />}
            title="Sign in to see your bookings"
            body="Your appointments show up here once you’ve booked."
            actionLabel="Sign in"
            onAction={() => signOut()}
          />
        ) : (
          <>
            <SegmentedControl
              options={[
                { key: 'upcoming', label: 'Upcoming' },
                { key: 'past', label: 'Past' },
              ]}
              value={tab}
              onChange={setTab}
            />
            {q.isPending ? (
              <Skeleton height={170} />
            ) : list.length === 0 ? (
              <EmptyState
                icon={<CalendarDays color={colors.goldText} size={28} strokeWidth={1.8} />}
                title={tab === 'upcoming' ? 'No upcoming bookings' : 'No past bookings yet'}
                body={
                  tab === 'upcoming' ? 'When you book a salon, your appointment shows up here.' : 'Appointments you’ve had show up here.'
                }
              />
            ) : (
              list.map((x) =>
                tab === 'upcoming' ? (
                  <UpcomingCard
                    key={x.booking.id}
                    x={x}
                    now={now}
                    onCancel={() => {
                      setNow(Date.now());
                      setCancelling(x);
                    }}
                  />
                ) : (
                  <PastCard key={x.booking.id} x={x} />
                ),
              )
            )}
          </>
        )}
      </ScrollView>
      {cancelling ? <CancelSheet item={cancelling} now={now} onClose={() => setCancelling(null)} /> : null}
    </View>
  );
}

function when(x: Item, style: 'short' | 'long') {
  const tz = x.business?.time_zone ?? 'America/New_York';
  const start = new Date(x.booking.starts_at);
  const day = start.toLocaleDateString(
    'en-US',
    style === 'short' ? { timeZone: tz, weekday: 'short' } : { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' },
  );
  return `${day} · ${formatTime(zonedClock(start, tz).minutes)}`;
}

function UpcomingCard({ x, now, onCancel }: { x: Item; now: number; onCancel: () => void }) {
  const tz = x.business?.time_zone ?? 'America/New_York';
  const start = new Date(x.booking.starts_at);
  const freeUntil = new Date(start.getTime() - FREE_CANCEL_HOURS * 3_600_000);
  const freeLabel =
    freeUntil.getTime() > now
      ? `Free cancellation until ${freeUntil.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' })} at ${formatTime(zonedClock(freeUntil, tz).minutes)}`
      : 'Less than 24 hours to go: cancelling now costs 50% of the services.';
  return (
    <View style={styles.group}>
      <View style={styles.card}>
        <View style={styles.cardBody}>
          <View style={styles.date}>
            <AppText style={styles.month}>{start.toLocaleDateString('en-US', { timeZone: tz, month: 'short' }).toUpperCase()}</AppText>
            <AppText style={styles.day}>
              {start.toLocaleDateString('en-US', {
                timeZone: tz,
                day: 'numeric',
              })}
            </AppText>
          </View>
          <View style={styles.flex1}>
            <AppText style={styles.name} numberOfLines={2}>
              {x.services.join(', ')}
            </AppText>
            <AppText variant="small" color="muted">
              {when(x, 'short')}
              {x.pro ? ` · with ${x.pro.first_name}` : ''}
            </AppText>
            <AppText variant="small" color="muted" numberOfLines={1}>
              {x.business?.name}
            </AppText>
          </View>
        </View>
        <View style={styles.actions}>
          {x.business ? (
            <Pressable
              style={({ pressed }) => [styles.action, styles.actionLine, pressed && styles.pressed]}
              accessibilityRole="link"
              accessibilityLabel={`Directions to ${x.business.name}`}
              onPress={() => Linking.openURL(directionsUrl(x.business!, Platform.OS === 'ios' ? 'ios' : 'android')).catch(() => {})}>
              <AppText style={styles.actionText}>Directions</AppText>
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Cancel ${x.services.join(', ')}`}
            onPress={onCancel}>
            <AppText style={styles.actionText} color="goldText">
              Cancel
            </AppText>
          </Pressable>
        </View>
      </View>
      <AppText variant="caption" color="muted" style={styles.center}>
        {freeLabel}
      </AppText>
    </View>
  );
}

function PastCard({ x }: { x: Item }) {
  const b = x.booking;
  const status =
    b.status === 'cancelled'
      ? b.charge_cents > 0
        ? `Cancelled · ${formatPrice(b.charge_cents)} charged`
        : 'Cancelled · nothing charged'
      : b.payment_status === 'charged'
        ? `${formatPrice(b.charge_cents || b.total_cents)} charged${b.card_label ? ` to ${b.card_label}` : ''}`
        : b.payment_status === 'failed'
          ? 'Payment didn’t go through'
          : 'Charged after your appointment';
  return (
    <View style={[styles.card, styles.pastBody]}>
      <AppText style={styles.pastName} numberOfLines={2}>
        {x.services.join(', ')}
        {x.pro ? ` · ${x.pro.first_name}` : ''}
      </AppText>
      <AppText variant="small" color="muted">
        {when(x, 'long')} · {x.business?.name}
      </AppText>
      <AppText variant="small" color={b.payment_status === 'failed' ? 'danger' : 'muted'}>
        {status}
      </AppText>
    </View>
  );
}

/** Cancel sheet (MyBookings.html): shows exactly what will be charged before the person confirms (SPEC §9). */
function CancelSheet({ item, now, onClose }: { item: Item; now: number; onClose: () => void }) {
  const cancel = useCancelBooking();
  const b = item.booking;
  const quote = cancellationQuote(b, new Date(now), 'customer');
  const what = `${item.services.join(', ')}${item.pro ? ` with ${item.pro.first_name}` : ''}, ${when(item, 'long')}`;
  const card = b.card_label ?? 'your card';

  const onYes = async () => {
    try {
      const r = await cancel.mutateAsync(b.id);
      onClose();
      Alert.alert(
        'Booking cancelled',
        r.charged_cents > 0 ? `${formatPrice(r.charged_cents)} was charged to ${card}.` : 'Nothing was charged.',
      );
    } catch (e) {
      Alert.alert('Couldn’t cancel', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <ModalSheet
      visible
      onClose={onClose}
      title="Cancel this booking?"
      footer={
        <View style={styles.sheetButtons}>
          <Button title="Keep my booking" onPress={onClose} />
          <Pressable
            onPress={onYes}
            disabled={cancel.isPending}
            accessibilityRole="button"
            style={({ pressed }) => [styles.yes, pressed && styles.pressed]}>
            <AppText style={styles.actionText} color="goldText">
              {cancel.isPending ? 'Cancelling…' : 'Yes, cancel it'}
            </AppText>
          </Pressable>
        </View>
      }>
      <AppText color="inkSoft" style={styles.sheetText}>
        {what}.{' '}
        {quote.late ? (
          <>
            It’s less than 24 hours away, so{' '}
            <AppText color="inkSoft" style={styles.bold}>
              {formatPrice(quote.charge)} (50% of the services)
            </AppText>{' '}
            will be charged to {card}. No tip is charged.
          </>
        ) : (
          <>
            You’re still inside the free window, so{' '}
            <AppText color="inkSoft" style={styles.bold}>
              nothing will be charged
            </AppText>
            .
          </>
        )}
      </AppText>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.screen, gap: 18 },
  title: { fontSize: 38, lineHeight: 40 },
  group: { gap: space.m },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderRadius: radius.bigCard,
    overflow: 'hidden',
  },
  cardBody: {
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  date: {
    width: 56,
    minHeight: 60,
    borderRadius: 14,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  month: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.semibold,
    letterSpacing: 1.2,
    color: colors.onGold,
  },
  day: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    color: colors.onGold,
  },
  flex1: { flex: 1, gap: 3 },
  name: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
  },
  action: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLine: { borderRightWidth: 1, borderRightColor: colors.lineSoft },
  actionText: { fontFamily: fonts.semibold, fontSize: 14 },
  pressed: { opacity: 0.7 },
  center: { textAlign: 'center' },
  pastBody: { padding: 16, gap: 4 },
  pastName: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  sheetText: { fontSize: 15, lineHeight: 22 },
  bold: { fontFamily: fonts.semibold },
  sheetButtons: { gap: space.s },
  yes: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
