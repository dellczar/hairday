import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BackButton, EmptyState, IconButton, Skeleton, initials } from '@/components';
import { BookingSheet } from '@/components/owner/BookingSheet';
import { WalkInSheet, type WalkInStart } from '@/components/owner/WalkInSheet';
import { useMyBusiness } from '@/hooks/useOwner';
import { useSalonDay } from '@/hooks/useOwnerDay';
import { addDays, formatTime, toMinutes, zonedClock, zonedTimeToUtc } from '@/lib/hours';
import { isFirstVisit, timeline } from '@/lib/ownerDay';
import { colors, fonts, radius, space } from '@/theme';

const HOUR = 52; // points per hour (Calendar.html)
const BLOCK_TONES = [colors.tile1, colors.tile2, colors.tile3] as const;
const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Calendar (Calendar.html): a week strip, one column per professional, open gaps and the Walk-in sheet. */
export default function Calendar() {
  const insets = useSafeAreaInsets();
  const biz = useMyBusiness().data;
  const q = useSalonDay(biz?.id);
  const tz = biz?.time_zone ?? 'America/New_York';
  const [now, setNow] = useState(() => Date.now());
  const today = zonedClock(new Date(now), tz).date;
  const [date, setDate] = useState(today);
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
  const team = d?.team ?? [];
  // Sunday-to-Saturday week around the picked day.
  const weekday = zonedClock(zonedTimeToUtc(date, 12 * 60, tz), tz).weekday;
  const weekStart = addDays(date, -weekday);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const month = zonedTimeToUtc(date, 12 * 60, tz).toLocaleDateString('en-US', { timeZone: tz, month: 'long' });

  const open = d?.hours.filter((h) => h.weekday === weekday) ?? [];
  const first = open.length ? Math.floor(Math.min(...open.map((h) => toMinutes(h.opens_at))) / 60) * 60 : 9 * 60;
  const last = open.length ? Math.ceil(Math.max(...open.map((h) => toMinutes(h.closes_at))) / 60) * 60 : 17 * 60;
  const rows = d
    ? timeline({
        date,
        timeZone: tz,
        now: new Date(now),
        businessHours: d.hours,
        pros: team.map((m) => ({ ...m.schedule, bookings: [] })),
        bookings: d.bookings,
      })
    : [];
  const all = d?.bookings ?? [];
  const top = (min: number) => ((Math.max(min, first) - first) / 60) * HOUR;
  const height = (a: number, z: number) => Math.max(22, ((Math.min(z, last) - Math.max(a, first)) / 60) * HOUR - 2);
  const hourMarks = Array.from({ length: (last - first) / 60 + 1 }, (_, i) => first + i * 60);
  const many = team.length > 3;
  const colWidth = many ? 104 : undefined;
  const openBooking = all.find((b) => b.id === openId) ?? null;

  const hourLabel = (m: number, i: number) => {
    const h = Math.floor(m / 60) % 24;
    const h12 = h % 12 || 12;
    return i === 0 || h === 12 ? `${h12} ${h < 12 ? 'AM' : 'PM'}` : `${h12}`;
  };

  const grid = (
    <View>
      <View style={styles.heads}>
        <View style={styles.gutter} />
        {team.map((m, i) => (
          <View key={m.id} style={[styles.head, colWidth ? { width: colWidth } : styles.flex1]}>
            <View style={[styles.ini, { backgroundColor: BLOCK_TONES[i % 3] }]}>
              <AppText style={styles.iniText} maxFontSizeMultiplier={1}>
                {initials(`${m.first_name} ${m.last_name ?? ''}`)}
              </AppText>
            </View>
            <AppText style={styles.headName} numberOfLines={1}>
              {m.first_name}
            </AppText>
          </View>
        ))}
      </View>
      <View style={{ height: ((last - first) / 60) * HOUR + 8 }}>
        {hourMarks.map((m, i) => (
          <View key={m} style={[styles.hourLine, { top: i * HOUR }]}>
            <AppText style={styles.hourText} color="muted" maxFontSizeMultiplier={1.2}>
              {hourLabel(m, i)}
            </AppText>
          </View>
        ))}
        <View style={styles.columns}>
          {team.map((m, i) => (
            <View key={m.id} style={[styles.column, colWidth ? { width: colWidth } : styles.flex1]}>
              {rows
                .filter((r) => r.proId === m.id)
                .map((r) => {
                  if (r.kind === 'open') {
                    return (
                      <Pressable
                        key={`o-${r.start}`}
                        onPress={() => setWalkIn({ proId: m.id, start: zonedTimeToUtc(date, r.start, tz).toISOString() })}
                        accessibilityRole="button"
                        accessibilityLabel={`Open from ${formatTime(r.start)} to ${formatTime(r.end)} with ${m.first_name}. Add a walk-in.`}
                        style={[styles.block, styles.open, { top: top(r.start), height: height(r.start, r.end) }]}>
                        <AppText style={styles.openText} color="muted">
                          Open
                        </AppText>
                      </Pressable>
                    );
                  }
                  const b = all.find((x) => x.id === r.booking.id);
                  if (!b) return null;
                  const fresh = isFirstVisit(b, all);
                  const name = b.client?.name ?? (b.source === 'walk_in' ? 'Walk-in' : 'Client');
                  const short = name.includes(' ') ? `${name.split(' ')[0]} ${name.split(' ').slice(-1)[0]![0]}.` : name;
                  const h = height(r.start, r.end);
                  return (
                    <Pressable
                      key={b.id}
                      onPress={() => setOpenId(b.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${name}${fresh ? ', new client' : ''}, ${b.services.join(', ')}, ${formatTime(r.start)} to ${formatTime(r.end)}`}
                      style={[
                        styles.block,
                        { top: top(r.start), height: h, backgroundColor: fresh ? colors.gold : BLOCK_TONES[i % 3] },
                        b.status === 'no_show' && styles.dim,
                      ]}>
                      <AppText style={styles.blockText} numberOfLines={h > 40 ? 3 : 1} maxFontSizeMultiplier={1.2}>
                        <AppText style={styles.bold}>{short}</AppText>
                        {h > 40
                          ? `\n${b.services.join(', ')}`
                          : fresh
                            ? ' · new'
                            : ` · ${b.services[0]?.split(' ').slice(-1)[0]?.toLowerCase() ?? ''}`}
                        {h > 60 ? `\n${formatTime(r.start)} – ${formatTime(r.end)}` : ''}
                      </AppText>
                    </Pressable>
                  );
                })}
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 110 }]}>
        <View style={styles.titleRow}>
          <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/(business)/(tabs)'))} />
          <AppText style={styles.h1} accessibilityRole="header" maxFontSizeMultiplier={1.4} numberOfLines={1}>
            {month}
          </AppText>
          <IconButton accessibilityLabel="Previous week" onPress={() => setDate(addDays(date, -7))} bare>
            <ChevronLeft size={22} strokeWidth={1.8} color={colors.ink} />
          </IconButton>
          <IconButton accessibilityLabel="Next week" onPress={() => setDate(addDays(date, 7))} bare>
            <ChevronRight size={22} strokeWidth={1.8} color={colors.ink} />
          </IconButton>
          <Pressable
            onPress={() => setDate(today)}
            accessibilityRole="button"
            accessibilityLabel="Go to today"
            hitSlop={{ top: 4, bottom: 4 }}
            style={({ pressed }) => [styles.today, pressed && styles.pressed]}>
            <AppText style={styles.todayText}>Today</AppText>
          </Pressable>
        </View>

        <View style={styles.days}>
          {days.map((day, i) => {
            const on = day === date;
            const n = parseInt(day.slice(8), 10);
            return (
              <Pressable
                key={day}
                onPress={() => setDate(day)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={zonedTimeToUtc(day, 12 * 60, tz).toLocaleDateString('en-US', {
                  timeZone: tz,
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
                style={[styles.day, on && styles.dayOn]}>
                <AppText style={styles.dayLetter} color={on ? 'white' : 'ink'} maxFontSizeMultiplier={1.2}>
                  {WEEKDAY[i]}
                </AppText>
                <AppText style={styles.dayNum} color={on ? 'white' : 'ink'} maxFontSizeMultiplier={1.2}>
                  {n}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {q.isPending ? (
          <Skeleton height={400} />
        ) : !team.length ? (
          <EmptyState title="No team yet" body="Add the people who take clients, and their hours, to see your calendar." />
        ) : !open.length ? (
          <EmptyState title="Closed" body="Your salon is closed this day. Pick another day above." />
        ) : many ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {grid}
          </ScrollView>
        ) : (
          grid
        )}
      </ScrollView>

      <Pressable
        onPress={() => setWalkIn({})}
        accessibilityRole="button"
        accessibilityLabel="Add a walk-in"
        style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 24 }, pressed && styles.pressed]}>
        <Plus size={20} strokeWidth={2} color={colors.white} />
        <AppText style={styles.fabText} color="white">
          Walk-in
        </AppText>
      </Pressable>

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
          <BookingSheet
            booking={openBooking}
            isNew={!!openBooking && isFirstVisit(openBooking, all)}
            timeZone={tz}
            now={now}
            onClose={() => setOpenId(null)}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.screen, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  h1: { flex: 1, fontFamily: fonts.display, fontSize: 36, lineHeight: 40, marginLeft: space.s },
  today: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  todayText: { fontFamily: fonts.semibold, fontSize: 13 },
  pressed: { opacity: 0.7 },
  days: { flexDirection: 'row', gap: 4 },
  day: {
    flex: 1,
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayOn: { backgroundColor: colors.ink },
  dayLetter: { fontSize: 12, lineHeight: 15 },
  dayNum: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  heads: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 10 },
  gutter: { width: 36 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex1: { flex: 1 },
  ini: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iniText: { fontSize: 12, fontFamily: fonts.semibold },
  headName: { flex: 1, fontFamily: fonts.semibold, fontSize: 13 },
  hourLine: { position: 'absolute', left: 0, right: 0, height: HOUR, borderTopWidth: 1, borderTopColor: colors.cardLine },
  hourText: { fontSize: 12, lineHeight: 15, marginTop: -7, alignSelf: 'flex-start', backgroundColor: colors.bg, paddingRight: 4 },
  columns: { position: 'absolute', left: 42, right: 0, top: 0, bottom: 0, flexDirection: 'row', gap: 6 },
  column: { position: 'relative' },
  block: { position: 'absolute', left: 0, right: 0, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, overflow: 'hidden' },
  open: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.placeholder, alignItems: 'center', justifyContent: 'center' },
  openText: { fontSize: 12 },
  blockText: { fontSize: 12, lineHeight: 15, color: colors.ink },
  bold: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink },
  dim: { opacity: 0.55 },
  fab: {
    position: 'absolute',
    right: space.screen,
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    shadowColor: colors.ink,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  fabText: { fontFamily: fonts.semibold, fontSize: 15 },
});
