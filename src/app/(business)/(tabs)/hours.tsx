import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Plus, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, Button, Chip, EmptyState, Input, ListGroup, ModalSheet, MonthCalendar, PillButton, Skeleton, TimeRow, Toggle } from '@/components';
import { useBusinessHours, useMyBusiness, useOwnerAction, useSchedule, useTeam, useTimeOff } from '@/hooks/useOwner';
import { roleLabel } from '@/lib/catalog';
import { addDays, formatDay, formatRange, fromMinutes, isoDate, toMinutes, WEEK, zonedDayStart } from '@/lib/hours';
import { addTimeOff, removeTimeOff, saveSchedule, type BreakInput } from '@/lib/owner';
import type { Availability, Break, BusinessHour, Professional } from '@/lib/types';
import { colors, fonts, radius, space, touch } from '@/theme';
import { errorText } from '@/lib/errors';

type Range = { start: number; end: number };
type BreakDraft = { weekday: number | null; start: number; end: number };

/** Availability (Availability.html): per professional — working days and hours, breaks, time off. */
export default function Hours() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ pro?: string }>();
  const business = useMyBusiness();
  const b = business.data;
  const team = useTeam(b?.id);
  const bizHours = useBusinessHours(b?.id);
  // Coming from "Save and set hours" selects that person; "Switch" picks someone else.
  const [picked, setPicked] = useState<{ forParam?: string; id: string } | null>(null);
  const proId = picked && picked.forParam === params.pro ? picked.id : (params.pro ?? team.data?.[0]?.id);
  const pro = team.data?.find((p) => p.id === proId) ?? team.data?.[0];
  const schedule = useSchedule(pro?.id);

  if (!b || team.isPending) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 56, paddingHorizontal: space.screen, gap: space.m }]}>
        <Skeleton height={68} />
        <Skeleton height={364} />
      </View>
    );
  }

  if (!team.data?.length || !pro) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + space.xxl, paddingHorizontal: space.screen }]}>
        <AppText style={styles.title} accessibilityRole="header">
          Availability
        </AppText>
        <EmptyState
          icon={<Users size={28} strokeWidth={1.8} color={colors.goldText} />}
          title="Add your team first"
          body="Hours are set for each person who takes clients. Add yourself or your team to start."
          actionLabel="Add a professional"
          onAction={() => router.push('/(business)/team/new')}
        />
      </View>
    );
  }

  if (!schedule.data || !bizHours.data) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 56, paddingHorizontal: space.screen, gap: space.m }]}>
        <Skeleton height={68} />
        <Skeleton height={364} />
      </View>
    );
  }

  return (
    <ScheduleEditor
      // A fresh editor whenever the person or their saved schedule actually changes
      // (not on every background refresh, which would wipe unsaved edits).
      key={`${pro.id}-${JSON.stringify(schedule.data)}`}
      pro={pro}
      team={team.data}
      timeZone={b.time_zone}
      salonHours={bizHours.data}
      saved={schedule.data}
      onSwitch={(id) => setPicked({ forParam: params.pro, id })}
    />
  );
}

type Member = Professional & { serviceIds: string[] };

function ScheduleEditor({
  pro,
  team,
  timeZone,
  salonHours,
  saved,
  onSwitch,
}: {
  pro: Member;
  team: Member[];
  timeZone: string;
  salonHours: BusinessHour[];
  saved: { availability: Availability[]; breaks: Break[] };
  onSwitch: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const timeOff = useTimeOff(pro.id);
  const [picker, setPicker] = useState(false);
  const [days, setDays] = useState<Record<number, Range | null>>(() => {
    const d: Record<number, Range | null> = {};
    for (const w of WEEK) d[w.weekday] = null;
    for (const a of saved.availability) d[a.weekday] = { start: toMinutes(a.starts_at), end: toMinutes(a.ends_at) };
    return d;
  });
  const [breaks, setBreaks] = useState<BreakDraft[]>(() => saved.breaks.map((x) => ({ weekday: x.weekday, start: toMinutes(x.starts_at), end: toMinutes(x.ends_at) })));
  const [dirty, setDirty] = useState(false);
  const [dayEditing, setDayEditing] = useState<number | null>(null);
  const [breakEditing, setBreakEditing] = useState<{ index: number | null; draft: BreakDraft } | null>(null);
  const [timeOffOpen, setTimeOffOpen] = useState(false);

  const salonRange = (weekday: number): Range => {
    const h = salonHours.find((x) => x.weekday === weekday);
    return h ? { start: toMinutes(h.opens_at), end: toMinutes(h.closes_at) } : { start: 10 * 60, end: 20 * 60 };
  };

  const save = useOwnerAction(() => {
    const dayList = WEEK.flatMap((w) => {
      const r = days[w.weekday];
      return r ? [{ weekday: w.weekday, start: fromMinutes(r.start), end: fromMinutes(r.end) }] : [];
    });
    const breakList: BreakInput[] = breaks.map((x) => ({ weekday: x.weekday, starts_at: fromMinutes(x.start), ends_at: fromMinutes(x.end) }));
    return saveSchedule(pro.id, dayList, breakList);
  });
  const deleteTimeOff = useOwnerAction(removeTimeOff);

  const bad = useMemo(() => Object.values(days).some((r) => r && r.end <= r.start), [days]);

  const onSave = async () => {
    if (bad) return Alert.alert('Check the hours', 'Each day’s end time has to be after its start time.');
    try {
      await save.mutateAsync(undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setDirty(false);
    } catch (e) {
      Alert.alert('Couldn’t save', errorText(e, 'Try again.'));
    }
  };

  const switchTo = (id: string) => {
    setPicker(false);
    if (!dirty || id === pro.id) return onSwitch(id);
    Alert.alert('Save changes first?', `You changed ${pro.first_name}’s hours.`, [
      { text: 'Discard', style: 'destructive', onPress: () => onSwitch(id) },
      { text: 'Save', onPress: () => onSave().then(() => onSwitch(id)) },
    ]);
  };

  const change = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };
  const setDay = change((v: { weekday: number; range: Range | null }) => setDays((d) => ({ ...d, [v.weekday]: v.range })));
  const setBreakList = change(setBreaks);

  const name = [pro.first_name, pro.last_name].filter(Boolean).join(' ');
  const upcomingOff = (timeOff.data ?? []).filter((t) => new Date(t.ends_at) > new Date());

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <AppText style={[styles.title, styles.flex1]} accessibilityRole="header">
            Availability
          </AppText>
          <PillButton title="Save" variant="gold" onPress={onSave} loading={save.isPending} disabled={!dirty} accessibilityLabel={dirty ? 'Save changes' : 'Saved'} />
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel={`${name}, ${roleLabel(pro.role)}. Switch professional`} onPress={() => setPicker(true)} style={styles.proCard}>
          <Avatar name={name} uri={pro.avatar_url} size={44} />
          <View style={styles.flex1}>
            <AppText variant="bodyStrong">{name}</AppText>
            <AppText variant="caption" color="muted">
              {roleLabel(pro.role)}
            </AppText>
          </View>
          {team.length > 1 ? <AppText variant="smallStrong">Switch</AppText> : null}
        </Pressable>

        <AppText variant="bodyStrong" style={styles.h2} accessibilityRole="header">
          Weekly hours
        </AppText>
        <ListGroup>
            {WEEK.map((w) => {
              const r = days[w.weekday] ?? null;
              const wrong = !!r && r.end <= r.start;
              return (
                <View key={w.weekday} style={styles.dayRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${w.full}, ${r ? formatRange(r.start, r.end) : 'day off'}`}
                    accessibilityHint={r ? 'Change the hours' : undefined}
                    disabled={!r}
                    onPress={() => setDayEditing(w.weekday)}
                    style={styles.dayPress}>
                    <AppText style={styles.dayName}>{w.full}</AppText>
                    <AppText variant="small" color={wrong ? 'danger' : r ? 'ink' : 'muted'} style={[styles.flex1, r && styles.underline]}>
                      {r ? formatRange(r.start, r.end) : 'Day off'}
                    </AppText>
                  </Pressable>
                  <Toggle
                    value={!!r}
                    accessibilityLabel={`${w.full} working`}
                    onChange={(on) => setDay({ weekday: w.weekday, range: on ? salonRange(w.weekday) : null })}
                  />
                </View>
              );
            })}
        </ListGroup>

        <AppText variant="bodyStrong" style={styles.h2} accessibilityRole="header">
          Breaks & time off
        </AppText>
        {breaks.map((x, i) => (
          <View key={i} style={styles.item}>
            <View style={styles.flex1}>
              <AppText>Break</AppText>
              <AppText variant="caption" color="muted">
                {formatRange(x.start, x.end)}, {x.weekday === null ? 'every working day' : `${WEEK.find((w) => w.weekday === x.weekday)?.full}s`}
              </AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Edit break ${formatRange(x.start, x.end)}`} onPress={() => setBreakEditing({ index: i, draft: x })} style={styles.textBtn}>
              <AppText variant="smallStrong">Edit</AppText>
            </Pressable>
          </View>
        ))}
        {upcomingOff.map((t) => {
          const last = addDays(isoDate(new Date(t.ends_at)), -1);
          const first = isoDate(new Date(t.starts_at));
          const when = first === last ? formatDay(first) : `${formatDay(first)} – ${formatDay(last)}`;
          return (
            <View key={t.id} style={styles.item}>
              <View style={styles.flex1}>
                <AppText>{t.note || 'Time off'}</AppText>
                <AppText variant="caption" color="muted">
                  {when}
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove time off ${when}`}
                onPress={() =>
                  Alert.alert('Remove this time off?', when, [
                    { text: 'Keep', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => deleteTimeOff.mutateAsync(t.id).catch(() => Alert.alert('Couldn’t remove', 'Try again.')) },
                  ])
                }
                style={styles.textBtn}>
                <AppText variant="smallStrong">Remove</AppText>
              </Pressable>
            </View>
          );
        })}
        <View style={styles.addRow}>
          <Pressable accessibilityRole="button" onPress={() => setBreakEditing({ index: null, draft: { weekday: null, start: 13 * 60, end: 13 * 60 + 30 } })} style={styles.dashed}>
            <Plus size={18} strokeWidth={1.8} color={colors.ink} />
            <AppText variant="smallStrong">Add a break</AppText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setTimeOffOpen(true)} style={styles.dashed}>
            <Plus size={18} strokeWidth={1.8} color={colors.ink} />
            <AppText variant="smallStrong">Add time off</AppText>
          </Pressable>
        </View>
        <AppText variant="label" color="muted">
          Changes only affect new bookings. Existing appointments stay as they are.
        </AppText>
      </ScrollView>

      {/* Pick a professional */}
      <ModalSheet visible={picker} onClose={() => setPicker(false)} title="Whose hours?">
        {team.map((p) => {
          const n = [p.first_name, p.last_name].filter(Boolean).join(' ');
          return (
            <Pressable key={p.id} accessibilityRole="button" accessibilityState={{ selected: p.id === pro.id }} onPress={() => switchTo(p.id)} style={[styles.proCard, p.id === pro.id && styles.proOn]}>
              <Avatar name={n} uri={p.avatar_url} size={40} />
              <View style={styles.flex1}>
                <AppText variant="bodyStrong">{n}</AppText>
                <AppText variant="caption" color="muted">
                  {roleLabel(p.role)}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </ModalSheet>

      {/* One day's hours */}
      {dayEditing !== null && days[dayEditing] ? (
        <ModalSheet visible onClose={() => setDayEditing(null)} title={WEEK.find((w) => w.weekday === dayEditing)?.full ?? ''} footer={<Button title="Done" onPress={() => setDayEditing(null)} />}>
          <ListGroup>
            <TimeRow label="Starts" value={days[dayEditing]!.start} onChange={(start) => setDay({ weekday: dayEditing, range: { ...days[dayEditing]!, start } })} />
            <TimeRow label="Ends" value={days[dayEditing]!.end} onChange={(end) => setDay({ weekday: dayEditing, range: { ...days[dayEditing]!, end } })} />
          </ListGroup>
          {days[dayEditing]!.end <= days[dayEditing]!.start ? (
            <AppText variant="caption" color="danger">
              The end time has to be after the start time.
            </AppText>
          ) : null}
          <Pressable
            accessibilityRole="button"
            style={styles.textBtn}
            onPress={() => {
              const r = days[dayEditing]!;
              const next = { ...days };
              for (const w of WEEK) if (next[w.weekday]) next[w.weekday] = { ...r };
              setDays(next);
              setDirty(true);
              setDayEditing(null);
            }}>
            <AppText variant="smallStrong" style={styles.underline}>
              Use these hours on all working days
            </AppText>
          </Pressable>
        </ModalSheet>
      ) : null}

      {/* Add / edit a break */}
      {breakEditing ? (
        <BreakSheet
          initial={breakEditing.draft}
          isNew={breakEditing.index === null}
          onClose={() => setBreakEditing(null)}
          onDelete={() => {
            setBreakList(breaks.filter((_, i) => i !== breakEditing.index));
            setBreakEditing(null);
          }}
          onDone={(draft) => {
            const next = [...breaks];
            if (breakEditing.index === null) next.push(draft);
            else next[breakEditing.index] = draft;
            setBreakList(next);
            setBreakEditing(null);
          }}
        />
      ) : null}

      {timeOffOpen ? <TimeOffSheet proId={pro.id} timeZone={timeZone} onClose={() => setTimeOffOpen(false)} /> : null}
    </View>
  );
}

function BreakSheet({ initial, isNew, onClose, onDone, onDelete }: { initial: BreakDraft; isNew: boolean; onClose: () => void; onDone: (b: BreakDraft) => void; onDelete: () => void }) {
  const [d, setD] = useState(initial);
  const wrong = d.end <= d.start;
  return (
    <ModalSheet visible onClose={onClose} title={isNew ? 'Add a break' : 'Edit break'} footer={<Button title={isNew ? 'Add break' : 'Done'} disabled={wrong} onPress={() => onDone(d)} />}>
      <ListGroup>
        <TimeRow label="Starts" value={d.start} step={15} onChange={(start) => setD({ ...d, start })} />
        <TimeRow label="Ends" value={d.end} step={15} onChange={(end) => setD({ ...d, end })} />
      </ListGroup>
      {wrong ? (
        <AppText variant="caption" color="danger">
          The end time has to be after the start time.
        </AppText>
      ) : null}
      <View style={{ gap: space.s }}>
        <AppText variant="smallStrong">Which days?</AppText>
        <View style={styles.chips}>
          <Chip label="Every working day" selected={d.weekday === null} onPress={() => setD({ ...d, weekday: null })} />
          {WEEK.map((w) => (
            <Chip key={w.weekday} label={`${w.full}s`} selected={d.weekday === w.weekday} onPress={() => setD({ ...d, weekday: w.weekday })} />
          ))}
        </View>
      </View>
      {!isNew ? (
        <Pressable accessibilityRole="button" onPress={onDelete} style={styles.textBtn}>
          <AppText variant="smallStrong" color="danger">
            Delete break
          </AppText>
        </Pressable>
      ) : null}
    </ModalSheet>
  );
}

/** Whole days off, from a first day to a last day (inclusive), in the salon's time zone. */
function TimeOffSheet({ proId, timeZone, onClose }: { proId: string; timeZone: string; onClose: () => void }) {
  const today = isoDate(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [picking, setPicking] = useState<'from' | 'to'>('from');
  const [note, setNote] = useState('');
  const add = useOwnerAction(() => addTimeOff(proId, zonedDayStart(from, timeZone), zonedDayStart(addDays(to, 1), timeZone), note.trim() || null));

  const pick = (day: string) => {
    if (picking === 'from') {
      setFrom(day);
      if (to < day) setTo(day);
      setPicking('to');
    } else {
      if (day < from) {
        setFrom(day);
        setTo(day);
      } else setTo(day);
    }
  };

  return (
    <ModalSheet
      visible
      onClose={onClose}
      title="Add time off"
      footer={
        <Button
          title="Add time off"
          loading={add.isPending}
          onPress={() =>
            add
              .mutateAsync(undefined)
              .then(() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                onClose();
              })
              .catch(() => Alert.alert('Couldn’t add time off', 'Try again.'))
          }
        />
      }>
      <View style={styles.rangeRow}>
        {(['from', 'to'] as const).map((k) => (
          <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: picking === k }} onPress={() => setPicking(k)} style={[styles.rangeBox, picking === k && styles.rangeOn]}>
            <AppText variant="caption" color="muted">
              {k === 'from' ? 'First day off' : 'Last day off'}
            </AppText>
            <AppText variant="bodyStrong">{formatDay(k === 'from' ? from : to)}</AppText>
          </Pressable>
        ))}
      </View>
      <MonthCalendar from={from} to={to} min={today} onPick={pick} />
      <Input label="Note (optional)" value={note} onChangeText={setNote} placeholder="Vacation" maxLength={60} />
      <AppText variant="caption" color="muted">
        Clients can’t book these days. Existing appointments stay — move or cancel them yourself.
      </AppText>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.screen, paddingBottom: space.xxl * 2, gap: space.m },
  flex1: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 44 },
  title: { fontSize: 17, lineHeight: 22, fontFamily: fonts.semibold },
  h2: { marginTop: 4 },
  proCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardLine, borderRadius: radius.card, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: space.m },
  proOn: { borderColor: colors.ink },
  dayRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayPress: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: touch, gap: 10 },
  dayName: { width: 96, fontFamily: fonts.medium },
  underline: { textDecorationLine: 'underline', textDecorationColor: colors.line },
  item: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardLine, borderRadius: radius.card, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: space.m },
  textBtn: { minHeight: touch, justifyContent: 'center', alignSelf: 'flex-start' },
  addRow: { flexDirection: 'row', gap: space.s },
  dashed: { flex: 1, minHeight: 48, borderRadius: radius.card, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.placeholder, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  rangeRow: { flexDirection: 'row', gap: space.s },
  rangeBox: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.input, backgroundColor: colors.surface, padding: space.m, gap: 2 },
  rangeOn: { borderColor: colors.ink },
});
