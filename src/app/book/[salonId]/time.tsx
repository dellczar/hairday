import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { CalendarX2, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, BackButton, EmptyState, IconButton, Skeleton } from '@/components';
import { schedulesFor, useBookingSetup, useBusyTimes, useCreateHold, useHeldBooking, useRescheduleBooking } from '@/hooks/useBooking';
import { useSalon } from '@/hooks/useDiscovery';
import { useSession } from '@/hooks/useSession';
import { getAvailableSlots, groupSlots, type Slot } from '@/lib/availability';
import { sameStretch } from '@/lib/db';
import { addDays, formatDuration, formatTime, zonedClock, zonedTimeToUtc } from '@/lib/hours';
import { formatPrice } from '@/lib/money';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, fonts, radius, space, touch } from '@/theme';

const WEEKS_AHEAD = 8;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** 'YYYY-MM-DD' → its parts, without the phone's time zone getting involved. */
function parts(date: string) {
  const [y, m, d] = date.split('-').map((n) => parseInt(n, 10)) as [number, number, number];
  return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

/**
 * Pick a time (Book.html): who, which day, which time → Continue holds it for 10 minutes.
 * With `reschedule=<booking id>` it moves that booking instead (My bookings → Reschedule).
 */
export default function PickATime() {
  const params = useLocalSearchParams<{ salonId: string; services?: string; pro?: string; reschedule?: string }>();
  const salonId = params.salonId;
  const serviceIds = useMemo(() => (params.services ?? '').split(',').filter(Boolean), [params.services]);
  const insets = useSafeAreaInsets();
  const { session, signOut } = useSession();

  const moving = useHeldBooking(params.reschedule).data?.booking ?? null;
  const reschedule = useRescheduleBooking();
  const salon = useSalon(salonId);
  const setup = useBookingSetup(salonId, serviceIds);
  const business = salon.data?.listing.business;
  const tz = business?.time_zone ?? 'America/New_York';
  const [now] = useState(() => new Date());
  const today = zonedClock(now, tz).date;

  const [week, setWeek] = useState(0);
  const weekStart = addDays(today, week * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const busy = useBusyTimes(
    salonId,
    zonedTimeToUtc(addDays(weekStart, -1), 0, tz).toISOString(),
    zonedTimeToUtc(addDays(weekStart, 8), 0, tz).toISOString(),
  );

  const able = setup.data?.pros ?? [];
  const [who, setWho] = useState<string>(() => params.pro || 'any');
  const proId = who === 'any' || able.some((p) => p.pro.id === who) ? who : 'any';
  const [day, setDay] = useState<string | null>(null);
  const [picked, setPicked] = useState<Slot | null>(null);
  const hold = useCreateHold();

  const services = setup.data?.services ?? [];
  const minutes = services.reduce((s, x) => s + x.duration_min, 0);
  // A moved booking keeps the price it was booked at.
  const price = moving ? moving.subtotal_cents : services.reduce((s, x) => s + x.price_cents, 0);
  const busyNow = hold.isPending || reschedule.isPending;

  // Times for every day of the visible week, so empty days can be dimmed.
  const slotsByDay = useMemo(() => {
    if (!setup.data || !busy.data) return null;
    // The booking being moved doesn't block itself.
    const schedules = schedulesFor(
      setup.data,
      moving ? busy.data.filter((b) => !(b.kind === 'booking' && sameStretch(b, moving))) : busy.data,
    );
    const out: Record<string, Slot[]> = {};
    for (const d of days)
      out[d] = getAvailableSlots({
        date: d,
        timeZone: tz,
        now: new Date(),
        durationMin: minutes,
        businessHours: setup.data.hours,
        pros: schedules,
        proId,
      });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `days` is derived from weekStart
  }, [setup.data, busy.data, weekStart, tz, minutes, proId, moving]);

  const open = (d: string) => (slotsByDay?.[d] ?? []).some((s) => !s.booked);
  // Default to the first day with a free time.
  const selectedDay = day && days.includes(day) ? day : (days.find(open) ?? days[0]!);
  const slots = slotsByDay?.[selectedDay] ?? [];
  const groups = groupSlots(slots);
  const current = picked && slots.some((s) => s.start === picked.start && !s.booked) ? picked : null;

  const proName = (id: string | null) => able.find((p) => p.pro.id === id)?.pro.first_name;
  const sel = parts(selectedDay);
  const whoLabel = proId === 'any' ? (current?.proId ? proName(current.proId) : 'anyone') : proName(proId);

  const cont = async () => {
    if (!current?.proId || !business) return;
    if (params.reschedule) {
      if (!moving) return;
      try {
        await reschedule.mutateAsync({ bookingId: moving.id, professionalId: current.proId, startsAt: current.start });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Alert.alert(
          'Booking moved',
          `You’re now booked for ${DOW[sel.dow]} ${MONTHS[sel.m - 1]} ${sel.d} at ${formatTime(current.minutes)}.`,
        );
        if (router.canGoBack()) router.back();
        else router.replace('/(customer)/(tabs)/bookings');
      } catch (e) {
        setPicked(null);
        void busy.refetch();
        Alert.alert('Couldn’t move it', e instanceof Error ? e.message : 'Pick another time.');
      }
      return;
    }
    if (isSupabaseConfigured && !session) {
      Alert.alert('Sign in to book', 'We’ll keep your services and time. It only takes a moment.', [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Sign in',
          onPress: async () => {
            await signOut(); // leaves guest mode
            router.push('/(auth)/welcome');
          },
        },
      ]);
      return;
    }
    try {
      const id = await hold.mutateAsync({
        business_id: business.id,
        professional_id: current.proId,
        service_ids: serviceIds,
        starts_at: current.start,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.push({ pathname: '/book/[salonId]/pay', params: { salonId: business.id, booking: id } });
    } catch (e) {
      setPicked(null);
      void busy.refetch();
      Alert.alert('That time is gone', e instanceof Error ? e.message : 'Pick another time.');
    }
  };

  if (!serviceIds.length) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8, paddingHorizontal: space.screen }]}>
        <BackButton />
        <EmptyState title="Pick a service first" body="Go back and tap + on the services you want." />
      </View>
    );
  }

  const loading = salon.isPending || setup.isPending || (busy.isPending && !busy.data);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: 120 + insets.bottom }]}>
        <View style={styles.header}>
          <BackButton />
          <View style={styles.flex1}>
            <AppText style={styles.title} accessibilityRole="header">
              {params.reschedule ? 'Pick a new time' : 'Pick a time'}
            </AppText>
            <AppText variant="caption" color="muted" numberOfLines={2}>
              {[business?.name, services.length ? `${services.map((s) => s.name).join(', ')}, ${formatDuration(minutes)}` : null]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
          </View>
        </View>

        {loading ? (
          <>
            <Skeleton height={86} />
            <Skeleton height={100} />
            <Skeleton height={200} />
          </>
        ) : !able.length ? (
          <EmptyState
            icon={<CalendarX2 size={28} strokeWidth={1.8} color={colors.goldText} />}
            title="No one offers all of those"
            body="No single professional here does every service you picked. Try booking them separately."
          />
        ) : (
          <>
            <View style={styles.section}>
              <AppText style={styles.h2} accessibilityRole="header">
                Who
              </AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.whoRow}>
                {[
                  { id: 'any', name: 'Anyone', uri: null as string | null },
                  ...able.map((p) => ({ id: p.pro.id, name: p.pro.first_name, uri: p.pro.avatar_url })),
                ].map((p) => {
                  const on = proId === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={p.id === 'any' ? 'Anyone available' : p.name}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setWho(p.id);
                        setPicked(null);
                      }}
                      style={styles.who}>
                      <View style={[styles.ring, on && styles.ringOn]}>
                        {p.id === 'any' ? (
                          <View style={styles.anyone}>
                            <AppText variant="caption" style={styles.semibold} maxFontSizeMultiplier={1.2}>
                              Any
                            </AppText>
                          </View>
                        ) : (
                          <Avatar
                            name={[p.name, able.find((a) => a.pro.id === p.id)?.pro.last_name].filter(Boolean).join(' ')}
                            uri={p.uri}
                            size={46}
                            tone="photo"
                          />
                        )}
                      </View>
                      <AppText variant="caption" style={on ? styles.semibold : styles.medium} numberOfLines={1}>
                        {p.name}
                      </AppText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <View style={styles.rowBetween}>
                <AppText style={styles.h2} accessibilityRole="header">
                  When
                </AppText>
                <View style={styles.weekNav}>
                  <IconButton accessibilityLabel="Previous week" bare disabled={week === 0} onPress={() => setWeek(week - 1)}>
                    <ChevronLeft size={20} strokeWidth={1.8} color={week === 0 ? colors.placeholder : colors.ink} />
                  </IconButton>
                  <AppText variant="small" color="muted">
                    {MONTHS_LONG[sel.m - 1]} {sel.y}
                  </AppText>
                  <IconButton accessibilityLabel="Next week" bare disabled={week >= WEEKS_AHEAD} onPress={() => setWeek(week + 1)}>
                    <ChevronRight size={20} strokeWidth={1.8} color={week >= WEEKS_AHEAD ? colors.placeholder : colors.ink} />
                  </IconButton>
                </View>
              </View>
              <View style={styles.days}>
                {days.map((d) => {
                  const p = parts(d);
                  const on = d === selectedDay;
                  const any = open(d);
                  return (
                    <Pressable
                      key={d}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${DOW[p.dow]} ${MONTHS[p.m - 1]} ${p.d}${any ? '' : ', no times'}`}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setDay(d);
                        setPicked(null);
                      }}
                      style={[styles.day, on ? styles.dayOn : styles.dayOff]}>
                      <AppText variant="label" color={on ? 'white' : any ? 'ink' : 'muted'} maxFontSizeMultiplier={1.3}>
                        {d === today ? 'Today' : DOW[p.dow]}
                      </AppText>
                      <AppText
                        color={on ? 'white' : any ? 'ink' : 'muted'}
                        style={[styles.dayNum, !any && !on && styles.strike]}
                        maxFontSizeMultiplier={1.3}>
                        {p.d}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <AppText style={styles.h2} accessibilityRole="header">
                Available times
              </AppText>
              {groups.length ? (
                <>
                  {groups.map((g) => (
                    <View key={g.period} style={styles.group}>
                      <AppText variant="label" color="muted" style={styles.overline} accessibilityRole="header">
                        {g.label.toUpperCase()}
                      </AppText>
                      <View style={styles.grid}>
                        {g.slots.map((s) => {
                          const on = current?.start === s.start;
                          return (
                            <View key={s.start} style={styles.cell}>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`${formatTime(s.minutes)}${s.booked ? ', booked' : ''}`}
                                accessibilityState={{ selected: on, disabled: s.booked }}
                                disabled={s.booked}
                                onPress={() => {
                                  Haptics.selectionAsync().catch(() => {});
                                  setPicked(s);
                                }}
                                style={[styles.time, on ? styles.timeOn : s.booked ? styles.timeBooked : styles.timeOff]}>
                                <AppText
                                  variant="caption"
                                  color={on ? 'onGold' : s.booked ? 'muted' : 'ink'}
                                  style={[styles.medium, s.booked && styles.strike]}
                                  maxFontSizeMultiplier={1.4}>
                                  {formatTime(s.minutes)}
                                </AppText>
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                  {slots.some((s) => s.booked) ? (
                    <AppText variant="label" color="muted">
                      Crossed-out times are already booked.
                    </AppText>
                  ) : null}
                </>
              ) : (
                <View style={styles.none}>
                  <AppText variant="small" color="inkSoft">
                    {slots.length ? 'Every time on this day is booked.' : 'No times on this day.'}{' '}
                    {days.some(open) ? 'Try another day.' : 'Try next week.'}
                  </AppText>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 14 }]}>
        <View style={styles.flex1}>
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {`${DOW[sel.dow]} ${sel.d} ${MONTHS[sel.m - 1]}`}
            {whoLabel ? ` · with ${whoLabel}` : ''}
          </AppText>
          <AppText style={styles.barTotal} numberOfLines={1}>
            {current ? `${formatTime(current.minutes)} · ${formatPrice(price)}` : 'Pick a time'}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !current, busy: busyNow }}
          accessibilityHint={params.reschedule ? 'Moves your booking to this time' : 'Holds this time for 10 minutes'}
          disabled={!current || busyNow || (!!params.reschedule && !moving)}
          onPress={cont}
          style={({ pressed }) => [styles.cta, (!current || busyNow) && styles.ctaOff, pressed && { opacity: 0.88 }]}>
          <AppText variant="button" color="onGold">
            {params.reschedule ? (reschedule.isPending ? 'Moving…' : 'Move it here') : hold.isPending ? 'Holding…' : 'Continue'}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.screen, gap: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  flex1: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  section: { gap: space.m },
  h2: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekNav: { flexDirection: 'row', alignItems: 'center', marginRight: -10 },
  whoRow: { gap: 14 },
  who: { width: 64, alignItems: 'center', gap: 6 },
  ring: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOn: { borderColor: colors.gold },
  anyone: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.mapLand, alignItems: 'center', justifyContent: 'center' },
  semibold: { fontFamily: fonts.semibold },
  medium: { fontFamily: fonts.medium },
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, minHeight: 64, borderRadius: radius.input, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  dayOff: { backgroundColor: colors.surface, borderColor: colors.line },
  dayNum: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 22 },
  strike: { textDecorationLine: 'line-through' },
  group: { gap: 6 },
  overline: { fontFamily: fonts.semibold, letterSpacing: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  cell: { width: '25%', padding: 3 },
  time: { minHeight: touch, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  timeOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  timeOff: { backgroundColor: colors.surface, borderColor: colors.line },
  timeBooked: { backgroundColor: 'transparent', borderColor: colors.line },
  none: { backgroundColor: colors.tint, borderRadius: radius.card, padding: 14 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 14,
    paddingHorizontal: space.screen,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
  },
  barTotal: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  cta: {
    minHeight: 50,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaOff: { opacity: 0.45 },
});
