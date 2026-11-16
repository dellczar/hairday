import { router, useFocusEffect } from 'expo-router';
import { CalendarPlus, Plus, Search, Users } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, EmptyState, Skeleton, initials } from '@/components';
import { ClientSheet } from '@/components/owner/ClientSheet';
import { ContactsImportSheet } from '@/components/owner/ContactsImportSheet';
import { WalkInSheet } from '@/components/owner/WalkInSheet';
import { useMyBusiness } from '@/hooks/useOwner';
import { useSalonDay } from '@/hooks/useOwnerDay';
import { clientSummaries } from '@/lib/ownerDay';
import { colors, fonts, radius, space } from '@/theme';

const TONES = [colors.tile1, colors.tile2, colors.tile3, colors.tile4, colors.tile5, colors.tile6] as const;

/** Clients (Clients.html): search as you type, All / New this month, A–Z list, add and import. */
export default function Clients() {
  const insets = useSafeAreaInsets();
  const biz = useMyBusiness().data;
  const q = useSalonDay(biz?.id);
  const tz = biz?.time_zone ?? 'America/New_York';
  const [now, setNow] = useState(() => Date.now());
  const [text, setText] = useState('');
  const [onlyNew, setOnlyNew] = useState(false);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [bookFor, setBookFor] = useState<string | null>(null);
  const { refetch } = q;

  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      refetch();
    }, [refetch]),
  );

  const d = q.data;
  const list = d ? clientSummaries(d.clients, d.bookings, new Date(now), tz) : [];
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const isNewThisMonth = (created: string) => new Date(created).getTime() >= monthStart.getTime();
  const newCount = list.filter((c) => isNewThisMonth(c.client.created_at)).length;
  const needle = text.trim().toLowerCase();
  const digits = needle.replace(/\D/g, '');
  const shown = list.filter(
    (c) =>
      (!onlyNew || isNewThisMonth(c.client.created_at)) &&
      (!needle ||
        c.client.name.toLowerCase().includes(needle) ||
        (c.client.email ?? '').toLowerCase().includes(needle) ||
        (digits.length >= 3 && (c.client.phone ?? '').replace(/\D/g, '').includes(digits))),
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: space.xxl }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <AppText style={styles.h1} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
            Clients
          </AppText>
          <Pressable
            onPress={() => setAdding(true)}
            accessibilityRole="button"
            accessibilityLabel="New client"
            style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}>
            <Plus size={18} strokeWidth={2} color={colors.white} />
            <AppText style={styles.newText} color="white">
              New
            </AppText>
          </Pressable>
        </View>

        <View style={styles.search}>
          <Search size={18} strokeWidth={1.8} color={colors.muted} />
          <TextInput
            defaultValue=""
            onChangeText={setText}
            placeholder="Name, email or phone"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Search clients"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.filters}>
          <Filter label={`All · ${list.length}`} on={!onlyNew} onPress={() => setOnlyNew(false)} />
          <Filter label={`New this month · ${newCount}`} on={onlyNew} onPress={() => setOnlyNew(true)} />
        </View>

        {q.isPending ? (
          <Skeleton height={300} />
        ) : !list.length ? (
          <EmptyState
            icon={<Users color={colors.goldText} size={28} strokeWidth={1.8} />}
            title="No clients yet"
            body="Everyone who books with you is added here automatically. You can also add people or import them from your contacts."
            actionLabel="Import from contacts"
            onAction={() => setImporting(true)}
          />
        ) : !shown.length ? (
          <View style={styles.none}>
            <AppText style={styles.noneTitle}>{needle ? `No clients match “${text.trim()}”` : 'No new clients this month'}</AppText>
            <AppText color="muted" style={styles.center}>
              {needle
                ? 'Check the spelling or add them as a new client.'
                : 'Clients added or booking for the first time this month show up here.'}
            </AppText>
          </View>
        ) : (
          <View>
            {shown.map((c, i) => (
              <View key={c.client.id} style={styles.row}>
                <Pressable
                  onPress={() => router.push({ pathname: '/(business)/client/[id]', params: { id: c.client.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.client.name}, ${c.meta}`}
                  style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}>
                  <View style={[styles.avatar, { backgroundColor: TONES[i % TONES.length] }]}>
                    <AppText style={styles.ini} maxFontSizeMultiplier={1.2}>
                      {initials(c.client.name)}
                    </AppText>
                  </View>
                  <View style={styles.flex1}>
                    <AppText style={styles.name} numberOfLines={1}>
                      {c.client.name}
                    </AppText>
                    <AppText variant="caption" color="muted" numberOfLines={1}>
                      {c.meta}
                    </AppText>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => setBookFor(c.client.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Book ${c.client.name}`}
                  hitSlop={4}
                  style={({ pressed }) => [styles.book, pressed && styles.pressed]}>
                  <CalendarPlus size={18} strokeWidth={1.8} color={colors.ink} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {biz && d ? (
        <>
          <ClientSheet
            visible={adding}
            onClose={() => setAdding(false)}
            businessId={biz.id}
            onImport={() => {
              setAdding(false);
              setImporting(true);
            }}
          />
          <ContactsImportSheet visible={importing} onClose={() => setImporting(false)} businessId={biz.id} existing={d.clients} />
          <WalkInSheet
            visible={!!bookFor}
            onClose={() => setBookFor(null)}
            businessId={biz.id}
            timeZone={tz}
            team={d.team}
            services={d.services}
            hours={d.hours}
            clients={d.clients}
            bookings={d.bookings}
            initial={bookFor ? { clientId: bookFor } : undefined}
          />
        </>
      ) : null}
    </View>
  );
}

function Filter({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      hitSlop={{ top: 5, bottom: 5 }}
      style={[styles.filter, on && styles.filterOn]}>
      <AppText style={styles.filterText} color={on ? 'white' : 'ink'}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.screen, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontFamily: fonts.display, fontSize: 38, lineHeight: 42 },
  newBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newText: { fontFamily: fonts.semibold, fontSize: 14 },
  pressed: { opacity: 0.7 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink, paddingVertical: 12 },
  filters: { flexDirection: 'row', gap: space.s, flexWrap: 'wrap' },
  filter: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  filterOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterText: { fontFamily: fonts.medium, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardLine,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 60 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  ini: { fontFamily: fonts.semibold, fontSize: 13 },
  flex1: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.semibold, fontSize: 15 },
  book: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  none: { paddingVertical: 40, paddingHorizontal: 10, gap: 6, alignItems: 'center' },
  noneTitle: { fontFamily: fonts.semibold, fontSize: 15, textAlign: 'center' },
  center: { textAlign: 'center' },
});
