import { Mail, Phone } from 'lucide-react-native';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { useMarkBooking, useSalonCancel, type SalonBooking } from '@/hooks/useOwnerDay';
import { formatDuration, formatTime, zonedClock } from '@/lib/hours';
import { formatPrice } from '@/lib/money';
import { amountDue, CHARGE_DELAY_MINUTES } from '@/lib/payments';
import { colors, fonts, radius, space } from '@/theme';

import { AppText } from '../AppText';
import { Button } from '../Button';
import { ModalSheet } from '../ModalSheet';

type Props = {
  booking: SalonBooking | null;
  isNew: boolean;
  timeZone: string;
  now: number;
  onClose: () => void;
};

/** Today → tap a booking: details, mark completed / no-show, cancel (SPEC §10). */
export function BookingSheet({ booking, isNew, timeZone, now, onClose }: Props) {
  const mark = useMarkBooking();
  const cancel = useSalonCancel();
  if (!booking) return null;
  const b = booking;
  const start = new Date(b.starts_at);
  const started = start.getTime() <= now;
  const upcoming = b.status === 'confirmed' && !started;
  const canMark =
    (b.status === 'confirmed' || b.status === 'completed' || b.status === 'no_show') &&
    started &&
    !['charging', 'charged'].includes(b.payment_status);
  const day = start.toLocaleDateString('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric' });
  const name = b.client?.name ?? (b.source === 'walk_in' ? 'Walk-in' : 'Client');

  const payment = (() => {
    if (b.source !== 'online') return 'Walk-in · pays at the salon';
    switch (b.payment_status) {
      case 'card_saved':
        return b.status === 'no_show'
          ? `No-show: ${formatPrice(amountDue(b))} (50% of services) will be charged to ${b.card_label ?? 'their card'}`
          : `${b.card_label ?? 'Card'} saved · ${formatPrice(b.total_cents)} is charged ${CHARGE_DELAY_MINUTES / 60} hour after the visit`;
      case 'charging':
        return 'Charging the card now…';
      case 'charged':
        return `${formatPrice(b.charge_cents)} charged to ${b.card_label ?? 'their card'}`;
      case 'failed':
        return `The card was declined${b.payment_error ? `: ${b.payment_error}` : ''}`;
      case 'not_charged':
        return 'Nothing charged';
      default:
        return 'Not paid yet';
    }
  })();

  const doMark = async (status: 'completed' | 'no_show') => {
    try {
      await mark.mutateAsync({ id: b.id, status });
      onClose();
    } catch (e) {
      Alert.alert('Couldn’t save that', e instanceof Error ? e.message : 'Please try again.');
    }
  };
  const confirmNoShow = () =>
    Alert.alert(
      'Mark as a no-show?',
      b.source === 'online' && b.payment_status === 'card_saved'
        ? `${name} will be charged ${formatPrice(amountDue({ ...b, status: 'no_show' }))}, half the services. No tip.`
        : 'This walk-in is marked as not having come in.',
      [
        { text: 'Back', style: 'cancel' },
        { text: 'Mark no-show', style: 'destructive', onPress: () => doMark('no_show') },
      ],
    );
  const confirmCancel = () =>
    Alert.alert(
      'Cancel this appointment?',
      b.source === 'online' ? `${name} won’t be charged anything.` : 'It will be taken off your calendar.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel appointment',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancel.mutateAsync(b.id);
              onClose();
            } catch (e) {
              Alert.alert('Couldn’t cancel', e instanceof Error ? e.message : 'Please try again.');
            }
          },
        },
      ],
    );

  const status =
    b.status === 'completed'
      ? 'Completed'
      : b.status === 'no_show'
        ? 'No-show'
        : b.status === 'cancelled'
          ? 'Cancelled'
          : started
            ? 'In progress or done'
            : 'Booked';

  return (
    <ModalSheet
      visible
      onClose={onClose}
      title={name}
      footer={
        <View style={styles.actions}>
          {canMark ? (
            <View style={styles.pair}>
              <View style={styles.flex1}>
                <Button
                  title="Completed"
                  onPress={() => doMark('completed')}
                  disabled={b.status === 'completed'}
                  loading={mark.isPending}
                />
              </View>
              <View style={styles.flex1}>
                <Button title="No-show" variant="secondary" onPress={confirmNoShow} disabled={b.status === 'no_show'} />
              </View>
            </View>
          ) : null}
          {upcoming ? <Button title="Cancel appointment" variant="secondary" onPress={confirmCancel} loading={cancel.isPending} /> : null}
        </View>
      }>
      <View style={styles.badges}>
        {isNew ? (
          <AppText style={styles.new} color="goldText">
            NEW CLIENT
          </AppText>
        ) : null}
        <AppText variant="caption" color="muted">
          {status}
        </AppText>
      </View>

      <View style={styles.card}>
        <Line label="When" value={`${day} · ${formatTime(zonedClock(start, timeZone).minutes)}`} />
        <Line label="Service" value={`${b.services.join(', ') || 'Service'} · ${formatDuration(b.minutes)}`} />
        <Line label="With" value={b.pro?.first_name ?? '—'} />
        <Line label="Price" value={formatPrice(b.subtotal_cents) + (b.tip_cents ? ` + ${formatPrice(b.tip_cents)} tip` : '')} />
        <Line label="Payment" value={payment} />
      </View>

      {b.client?.phone || b.client?.email ? (
        <View style={styles.contact}>
          {b.client.phone ? (
            <Contact
              icon={<Phone size={18} strokeWidth={1.8} color={colors.ink} />}
              label={b.client.phone}
              url={`tel:${b.client.phone.replace(/[^\d+]/g, '')}`}
            />
          ) : null}
          {b.client.email ? (
            <Contact
              icon={<Mail size={18} strokeWidth={1.8} color={colors.ink} />}
              label={b.client.email}
              url={`mailto:${b.client.email}`}
            />
          ) : null}
        </View>
      ) : null}
      {b.client?.notes ? (
        <View style={styles.notes}>
          <AppText variant="caption" color="inkSoft">
            {b.client.notes}
          </AppText>
        </View>
      ) : null}
      {!started && b.status === 'confirmed' ? (
        <AppText variant="caption" color="muted">
          You can mark it completed or a no-show once it has started.
        </AppText>
      ) : null}
    </ModalSheet>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <AppText variant="small" color="muted" style={styles.label}>
        {label}
      </AppText>
      <AppText variant="small" style={styles.flex1}>
        {value}
      </AppText>
    </View>
  );
}

function Contact({ icon, label, url }: { icon: React.ReactNode; label: string; url: string }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url).catch(() => {})}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.contactRow, pressed && styles.pressed]}>
      {icon}
      <AppText variant="small" style={styles.flex1} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: { gap: space.s },
  pair: { flexDirection: 'row', gap: space.s },
  flex1: { flex: 1 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: space.m, marginTop: -space.s },
  new: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.bigCard,
    borderWidth: 1,
    borderColor: colors.cardLine,
    padding: 16,
    gap: 12,
  },
  line: { flexDirection: 'row', gap: space.m },
  label: { width: 70 },
  contact: {
    backgroundColor: colors.surface,
    borderRadius: radius.bigCard,
    borderWidth: 1,
    borderColor: colors.cardLine,
    paddingHorizontal: 16,
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 48 },
  notes: { backgroundColor: colors.tint, borderRadius: radius.card, padding: 14 },
  pressed: { opacity: 0.7 },
});
