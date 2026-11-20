import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Chip, EmptyState, Skeleton } from '@/components';
import { BookingSheet } from '@/components/owner/BookingSheet';
import { WalkInSheet, type WalkInStart } from '@/components/owner/WalkInSheet';
import { useMyBusiness } from '@/hooks/useOwner';
import { useSalonDay, type SalonBooking } from '@/hooks/useOwnerDay';
import { formatDuration, formatTime, zonedClock, zonedTimeToUtc } from '@/lib/hours';
import { dayStats, gapLabel, isFirstVisit, timeline } from '@/lib/ownerDay';
import { colors, fonts, radius, space } from '@/theme';

/** Today (OwnerToday.html): the three numbers, staff chips and the day's timeline with open gaps. */
export default function Today() {
  const insets = useSafeAreaInsets();
  const biz = useMyBusiness().data;
  const q = useSalonDay(biz?.id);
  const tz = biz?.time_zone ?? 'America/New_York';
  const [now, setNow] = useState(() => Date.now());
  const [who, setWho] = useState<string | 'all'>('all');
  const [walkIn, setWalkIn] = useState<WalkInStart | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const { refetch } = q;

  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      refetch();
    }, [refetch]),
  );

  const d = q.data;
  const date = zonedClock(new Date(now), tz).date;
  const team = d?.team ?? [];
  const rows = d
    ? timeline({
        date,
        timeZone: tz,
        now: new Date(now),
        businessHours: d.hours,
        pros: team.map((m) => ({ ...m.schedule, bookings: [] })),
        bookings: d.bookings,
        proIds: who === 'all' ? undefined : [who],
      })
    : [];
  const all = d?.bookings ?? [];
  const isNew = (b: { id: string }) => {
    const full = all.find((x) => x.id === b.id);
    return !!full && isFirstVisit(full, all);
  };
  const stats = dayStats(rows, (b) => isNew(b));
  const heading = new Date(now).toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' });
  const proName = (id: string) => team.find((m) => m.id === id)?.first_name ?? '';
  const open = all.find((b) => b.id === openId) ?? null;
  const closedToday = d && !d.hours.some((h) => h.weekday === zonedClock(new Date(now), tz).weekday);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: space.xxl }]}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}>
        <View style={styles.top}>
          <Image
            source={biz?.logo_url ? { uri: biz.logo_url } : undefined}
            style={styles.logo}
            accessibilityRole="image"
            accessibilityLabel="Salon logo"
          />
          <View style={styles.flex1}>
            <AppText style={styles.salon} numberOfLines={1}>
              {biz?.name}
            </AppText>
            <AppText variant="caption" color="muted">
              {heading}
            </AppText>
          </View>
        </View>

        <View style={styles.titleRow}>
          <AppText style={styles.h1} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
            Today
          </AppText>
          <Pressable
            onPress={() => router.push('/(business)/calendar')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.week, pressed && styles.pressed]}>
            <AppText style={styles.weekText}>Week view</AppText>
          </Pressable>
        </View>

        <View style={styles.stats}>
          <Stat n={stats.bookings} label={stats.bookings === 1 ? 'Booking' : 'Bookings'} />
          <Stat n={stats.openSlots} label={stats.openSlots === 1 ? 'Open slot' : 'Open slots'} />
          <Stat n={stats.newClients} label={stats.newClients === 1 ? 'New client' : 'New clients'} />
        </View>

        {team.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsBleed}>
            <Chip label="Everyone" selected={who === 'all'} onPress={() => setWho('all')} />
            {team.map((m) => (
              <Chip key={m.id} label={m.first_name} selected={who === m.id} onPress={() => setWho(m.id)} />
            ))}
          </ScrollView>
        ) : null}

        {q.isPending ? (
          <Skeleton height={300} />
        ) : !rows.length ? (
          <EmptyState
            icon={<CalendarDays color={colors.goldText} size={28} strokeWidth={1.8} />}
            title={closedToday ? 'Closed today' : 'Nothing on today'}
            body={
              closedToday
                ? 'Your salon is closed today. Open the week view to see what’s coming up.'
                : 'No bookings and no open time left today.'
            }
            actionLabel="Open week view"
            onAction={() => router.push('/(business)/calendar')}
          />
        ) : (
          <View style={styles.list}>
            {rows.map((r) =>
              r.kind === 'booking' ? (
                <BookingRow
                  key={r.booking.id}
                  time={formatTime(r.start).replace(/ (AM|PM)$/, '')}
                  b={r.booking as SalonBooking}
                  fullBooking={all.find((x) => x.id === r.booking.id)}
                  isNew={isNew(r.booking)}
                  pro={proName(r.proId)}
                  onPress={() => setOpenId(r.booking.id)}
                />
              ) : (
                <View key={`open-${r.proId}-${r.start}`} style={styles.row}>
                  <AppText variant="caption" color="muted" style={styles.time}>
                    {formatTime(r.start).replace(/ (AM|PM)$/, '')}
                  </AppText>
                  <View style={[styles.card, styles.gap]}>
                    <View style={styles.flex1}>
                      <AppText style={styles.name}>Open · {gapLabel(r.end - r.start)}</AppText>
                      <AppText variant="caption" color="muted">
                        {team.length > 1 ? `${proName(r.proId)} · ` : ''}Fill it with a walk-in
                      </AppText>
                    </View>
                    <Pressable
                      onPress={() => setWalkIn({ proId: r.proId, start: zonedTimeToUtc(date, r.start, tz).toISOString() })}
                      accessibilityRole="button"
                      accessibilityLabel={`Add a walk-in at ${formatTime(r.start)}${team.length > 1 ? ` with ${proName(r.proId)}` : ''}`}
                      hitSlop={{ top: 4, bottom: 4 }}
                      style={({ pressed }) => [styles.add, pressed && styles.pressed]}>
                      <AppText style={styles.addText} color="onGold">
                        Add
                      </AppText>
                    </Pressable>
                  </View>
                </View>
              ),
            )}
          </View>
        )}
      </ScrollView>

      {d && biz ? (
        <>
          <WalkInSheet
            visible={!!walkIn}
            onClose={() => setWalkIn(null)}
            businessId={biz.id}
            timeZone={tz}
            team={team}
            services={d.services}
            hours={d.hours}
            clients={d.clients}
            bookings={d.bookings}
            initial={walkIn ?? undefined}
          />
          <BookingSheet booking={open} isNew={!!open && isNew(open)} timeZone={tz} now={now} onClose={() => setOpenId(null)} />
        </>
      ) : null}
    </View>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${n} ${label}`}>
      <AppText style={styles.statN} maxFontSizeMultiplier={1.4}>
        {n}
      </AppText>
      <AppText variant="caption" color="muted" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

function BookingRow({
  time,
  b,
  fullBooking,
  isNew,
  pro,
  onPress,
}: {
  time: string;
  b: SalonBooking;
  fullBooking?: SalonBooking;
  isNew: boolean;
  pro: string;
  onPress: () => void;
}) {
  const x = fullBooking ?? b;
  const name = x.client?.name ?? (x.source === 'walk_in' ? 'Walk-in' : 'Client');
  const done = x.status === 'completed' ? ' · done' : x.status === 'no_show' ? ' · no-show' : '';
  return (
    <View style={styles.row}>
      <AppText variant="caption" color="muted" style={styles.time}>
        {time}
      </AppText>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${name}${isNew ? ', new client' : ''}, ${x.services.join(', ')}, ${formatDuration(x.minutes)}, with ${pro}${done}`}
        style={({ pressed }) => [
          styles.card,
          isNew && styles.cardNew,
          x.status === 'no_show' && styles.cardDim,
          pressed && styles.pressed,
        ]}>
        <View style={styles.flex1}>
          <AppText style={styles.name} numberOfLines={1}>
            {name}
            {isNew ? (
              <AppText style={styles.newTag} color="goldText">
                {'  '}NEW
              </AppText>
            ) : null}
          </AppText>
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {x.services.join(', ') || 'Service'} · {formatDuration(x.minutes)}
            {done}
          </AppText>
        </View>
        <View style={styles.proTag}>
          <AppText style={styles.proText}>{pro}</AppText>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.screen, gap: 16 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  logo: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.tile6 },
  flex1: { flex: 1, gap: 2 },
  salon: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40 },
  week: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  weekText: { fontFamily: fonts.semibold, fontSize: 13 },
  pressed: { opacity: 0.7 },
  stats: { flexDirection: 'row', gap: space.s },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderRadius: radius.card,
    padding: 12,
    gap: 2,
  },
  statN: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32 },
  chipsBleed: { marginHorizontal: -space.screen },
  chips: { gap: space.s, paddingHorizontal: space.screen },
  list: { gap: space.s },
  row: { flexDirection: 'row', gap: space.m, alignItems: 'flex-start' },
  time: { width: 52, paddingTop: 14 },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardNew: { borderColor: colors.gold, borderWidth: 1.5 },
  cardDim: { opacity: 0.6 },
  gap: { backgroundColor: 'transparent', borderStyle: 'dashed', borderWidth: 1.5, borderColor: colors.placeholder },
  name: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  newTag: { fontFamily: fonts.semibold, fontSize: 12 },
  proTag: { backgroundColor: colors.tint, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  proText: { fontFamily: fonts.semibold, fontSize: 12 },
  add: { minHeight: 36, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.gold, justifyContent: 'center' },
  addText: { fontFamily: fonts.semibold, fontSize: 13 },
});
