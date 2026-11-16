import { router, useLocalSearchParams } from 'expo-router';
import { CalendarPlus, Mail, Pencil, Phone } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BackButton, Button, EmptyState, IconButton, Skeleton, initials } from '@/components';
import { BookingSheet } from '@/components/owner/BookingSheet';
import { ClientSheet } from '@/components/owner/ClientSheet';
import { WalkInSheet } from '@/components/owner/WalkInSheet';
import { useMyBusiness } from '@/hooks/useOwner';
import { useSalonDay } from '@/hooks/useOwnerDay';
import { formatDuration, formatTime, zonedClock } from '@/lib/hours';
import { formatPrice } from '@/lib/money';
import { clientSummaries, isFirstVisit } from '@/lib/ownerDay';
import { colors, fonts, radius, space } from '@/theme';

/** One client: contact, notes and visit history (SPEC §10 Clients). */
export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const biz = useMyBusiness().data;
  const q = useSalonDay(biz?.id);
  const tz = biz?.time_zone ?? 'America/New_York';
  const [now] = useState(() => Date.now());
  const [editing, setEditing] = useState(false);
  const [booking, setBooking] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(business)/(tabs)/clients'));
  const d = q.data;
  const client = d?.clients.find((c) => c.id === id);
  if (q.isPending) {
    return (
      <View style={[styles.screen, styles.pad, { paddingTop: insets.top + 8, gap: space.l }]}>
        <Skeleton height={44} width={44} rounded={22} />
        <Skeleton height={160} />
      </View>
    );
  }
  if (!d || !client || !biz) {
    return (
      <View style={[styles.screen, styles.pad, { paddingTop: insets.top + 8 }]}>
        <BackButton onPress={back} />
        <EmptyState title="Client not found" body="They may have been removed from your list." />
      </View>
    );
  }

  const summary = clientSummaries([client], d.bookings, new Date(now), tz)[0]!;
  const history = d.bookings.filter((b) => b.client_id === client.id).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const spent = history.filter((b) => b.payment_status === 'charged').reduce((s, b) => s + b.charge_cents, 0);
  const open = d.bookings.find((b) => b.id === openId) ?? null;
  const status = (s: string, start: string) =>
    s === 'cancelled'
      ? 'Cancelled'
      : s === 'no_show'
        ? 'No-show'
        : s === 'completed'
          ? 'Completed'
          : new Date(start).getTime() > now
            ? 'Upcoming'
            : 'Visited';

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.pad, styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + space.xxl }]}>
        <View style={styles.header}>
          <BackButton onPress={back} />
          <View style={styles.flex1} />
          <IconButton accessibilityLabel="Edit client" onPress={() => setEditing(true)}>
            <Pencil size={18} strokeWidth={1.8} color={colors.ink} />
          </IconButton>
        </View>

        <View style={styles.hero}>
          <View style={styles.avatar}>
            <AppText style={styles.ini} maxFontSizeMultiplier={1.2}>
              {initials(client.name)}
            </AppText>
          </View>
          <View style={styles.flex1}>
            <AppText style={styles.name} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
              {client.name}
            </AppText>
            <AppText variant="small" color="muted">
              {summary.meta}
              {spent ? ` · ${formatPrice(spent)} paid through Hairday` : ''}
            </AppText>
          </View>
        </View>

        {client.phone || client.email ? (
          <View style={styles.card}>
            {client.phone ? (
              <Row
                icon={<Phone size={18} strokeWidth={1.8} color={colors.ink} />}
                label={client.phone}
                url={`tel:${client.phone.replace(/[^\d+]/g, '')}`}
              />
            ) : null}
            {client.email ? (
              <Row icon={<Mail size={18} strokeWidth={1.8} color={colors.ink} />} label={client.email} url={`mailto:${client.email}`} />
            ) : null}
          </View>
        ) : null}

        {client.notes ? (
          <View style={styles.notes}>
            <AppText variant="small" color="inkSoft">
              {client.notes}
            </AppText>
          </View>
        ) : null}

        <Button
          title="Book a walk-in"
          icon={<CalendarPlus size={18} strokeWidth={1.8} color={colors.white} />}
          onPress={() => setBooking(true)}
        />

        <AppText style={styles.h2} accessibilityRole="header">
          Visits
        </AppText>
        {history.length ? (
          <View style={styles.card}>
            {history.map((b, i) => {
              const start = new Date(b.starts_at);
              return (
                <Pressable
                  key={b.id}
                  onPress={() => setOpenId(b.id)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.visit, i < history.length - 1 && styles.visitLine, pressed && styles.pressed]}>
                  <View style={styles.flex1}>
                    <AppText style={styles.visitTitle} numberOfLines={1}>
                      {b.services.join(', ') || 'Service'}
                      {b.pro ? ` · ${b.pro.first_name}` : ''}
                    </AppText>
                    <AppText variant="caption" color="muted">
                      {start.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
                      {formatTime(zonedClock(start, tz).minutes)} · {formatDuration(b.minutes)}
                    </AppText>
                  </View>
                  <AppText variant="caption" color={b.status === 'no_show' ? 'danger' : 'muted'}>
                    {status(b.status, b.starts_at)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <AppText color="muted">No visits yet.</AppText>
        )}
      </ScrollView>

      <ClientSheet visible={editing} onClose={() => setEditing(false)} businessId={biz.id} client={client} onDeleted={back} />
      <WalkInSheet
        visible={booking}
        onClose={() => setBooking(false)}
        businessId={biz.id}
        timeZone={tz}
        team={d.team}
        services={d.services}
        hours={d.hours}
        clients={d.clients}
        bookings={d.bookings}
        initial={{ clientId: client.id }}
      />
      <BookingSheet
        booking={open}
        isNew={!!open && isFirstVisit(open, d.bookings)}
        timeZone={tz}
        now={now}
        onClose={() => setOpenId(null)}
      />
    </View>
  );
}

function Row({ icon, label, url }: { icon: React.ReactNode; label: string; url: string }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url).catch(() => {})}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.contact, pressed && styles.pressed]}>
      {icon}
      <AppText style={styles.flex1} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: space.screen },
  content: { gap: space.l },
  header: { flexDirection: 'row', alignItems: 'center' },
  flex1: { flex: 1, gap: 2 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.l },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.tile2, alignItems: 'center', justifyContent: 'center' },
  ini: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30 },
  name: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.bigCard,
    borderWidth: 1,
    borderColor: colors.cardLine,
    paddingHorizontal: 16,
  },
  contact: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 52 },
  notes: { backgroundColor: colors.tint, borderRadius: radius.card, padding: 14 },
  h2: { fontFamily: fonts.semibold, fontSize: 15, marginTop: space.s },
  visit: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 60, paddingVertical: 10 },
  visitLine: { borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  visitTitle: { fontFamily: fonts.semibold, fontSize: 15 },
  pressed: { opacity: 0.7 },
});
