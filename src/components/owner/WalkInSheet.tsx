import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAddWalkIn, scheduleWithBookings, type SalonBooking, type TeamMember } from '@/hooks/useOwnerDay';
import { formatDuration, formatTime, zonedClock } from '@/lib/hours';
import { formatPrice } from '@/lib/money';
import { nextOpenTimes } from '@/lib/ownerDay';
import type { BusinessHour, Client, Service } from '@/lib/types';
import { colors, fonts, radius, space } from '@/theme';

import { AppText } from '../AppText';
import { Button } from '../Button';
import { Chip } from '../Chip';
import { Input } from '../Input';
import { ModalSheet } from '../ModalSheet';

export type WalkInStart = { proId?: string; start?: string; clientId?: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdded?: (bookingId: string) => void;
  businessId: string;
  timeZone: string;
  team: TeamMember[];
  services: Service[];
  hours: BusinessHour[];
  clients: Client[];
  bookings: SalonBooking[];
  initial?: WalkInStart;
};

/**
 * "New appointment" sheet (Calendar.html): client, service, who, and the next open times.
 * Walk-ins skip online payment (SPEC §9); the client pays at the salon.
 */
export function WalkInSheet(props: Props) {
  // Remount with fresh choices every time it opens.
  if (!props.visible) return null;
  return <WalkInForm {...props} />;
}

function WalkInForm({ onClose, onAdded, businessId, timeZone, team, services, hours, clients, bookings, initial }: Props) {
  const add = useAddWalkIn();
  const menu = services.filter((s) => team.some((m) => m.serviceIds.includes(s.id)));
  const startClient = clients.find((c) => c.id === initial?.clientId) ?? null;
  const [clientText, setClientText] = useState(startClient?.name ?? '');
  const [client, setClient] = useState<Client | null>(startClient);
  const [proId, setProId] = useState<string | undefined>(initial?.proId ?? team[0]?.id);
  const firstService = menu.find((s) => !proId || team.find((m) => m.id === proId)?.serviceIds.includes(s.id));
  const [serviceId, setServiceId] = useState<string | undefined>(firstService?.id);
  const [picked, setPicked] = useState<string | undefined>(initial?.start);
  const [now] = useState(() => new Date());

  const service = menu.find((s) => s.id === serviceId);
  const able = team.filter((m) => !serviceId || m.serviceIds.includes(serviceId));
  const pro = able.find((m) => m.id === proId) ?? able[0];
  const times =
    service && pro
      ? nextOpenTimes({
          from: now,
          timeZone,
          durationMin: service.duration_min,
          businessHours: hours,
          pro: scheduleWithBookings(pro, bookings),
          count: 6,
        })
      : [];
  // A gap tapped on Today or Calendar comes first, even if it's later than the next few times.
  if (initial?.start && pro?.id === initial.proId && !times.some((t) => t.start === initial.start)) {
    const c = zonedClock(new Date(initial.start), timeZone);
    times.unshift({ start: initial.start, date: c.date, minutes: c.minutes });
  }
  const start = times.find((t) => t.start === picked)?.start ?? times[0]?.start;

  const matches =
    clientText.trim() && !client
      ? clients
          .filter((c) => c.name.toLowerCase().includes(clientText.trim().toLowerCase()) || (c.phone ?? '').includes(clientText.trim()))
          .slice(0, 4)
      : [];

  const today = zonedClock(now, timeZone).date;
  const label = (t: { start: string; date: string; minutes: number }) => {
    const day = t.date === today ? 'Today' : new Date(t.start).toLocaleDateString('en-US', { timeZone, weekday: 'short' });
    return `${day} ${formatTime(t.minutes)}`;
  };

  const onAdd = async () => {
    if (!service || !pro || !start) return;
    try {
      const id = await add.mutateAsync({
        business_id: businessId,
        professional_id: pro.id,
        client_id: client?.id ?? null,
        newClientName: client ? undefined : clientText,
        service_ids: [service.id],
        starts_at: start,
      });
      onAdded?.(id);
      onClose();
    } catch (e) {
      Alert.alert('Couldn’t add it', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <ModalSheet
      visible
      onClose={onClose}
      title="New appointment"
      footer={
        <Button title="Add to calendar" variant="gold" onPress={onAdd} loading={add.isPending} disabled={!service || !pro || !start} />
      }>
      <View style={styles.field}>
        <Input
          label="Client"
          value={clientText}
          onChangeText={(t) => {
            setClientText(t);
            setClient(null);
          }}
          placeholder="Name or phone (optional)"
          autoCapitalize="words"
          hint={client ? undefined : clientText.trim() && !matches.length ? 'New client — they’ll be added to your list.' : undefined}
        />
        {matches.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => {
              setClient(c);
              setClientText(c.name);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Choose ${c.name}`}
            style={({ pressed }) => [styles.match, pressed && styles.pressed]}>
            <AppText style={styles.semibold}>{c.name}</AppText>
            {c.phone || c.email ? (
              <AppText variant="caption" color="muted">
                {c.phone ?? c.email}
              </AppText>
            ) : null}
          </Pressable>
        ))}
      </View>

      <View style={styles.field}>
        <AppText variant="smallStrong">Service</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {menu.map((s) => (
            <Chip
              key={s.id}
              label={`${s.name} · ${formatDuration(s.duration_min)} · ${formatPrice(s.price_cents)}`}
              selected={s.id === serviceId}
              onPress={() => {
                setServiceId(s.id);
                setPicked(undefined);
              }}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.field}>
        <AppText variant="smallStrong">With</AppText>
        <View style={styles.wrap}>
          {able.map((m) => (
            <Chip
              key={m.id}
              label={m.first_name}
              selected={m.id === pro?.id}
              onPress={() => {
                setProId(m.id);
                setPicked(undefined);
              }}
            />
          ))}
        </View>
        {!able.length ? (
          <AppText variant="caption" color="muted">
            Nobody on your team does this service yet.
          </AppText>
        ) : null}
      </View>

      <View style={styles.field}>
        <AppText variant="smallStrong">Next open times</AppText>
        {times.length ? (
          <View style={styles.times}>
            {times.map((t) => {
              const on = t.start === start;
              return (
                <Pressable
                  key={t.start}
                  onPress={() => setPicked(t.start)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, checked: on }}
                  style={[styles.time, on && styles.timeOn]}>
                  <AppText style={styles.semibold} color={on ? 'white' : 'ink'} maxFontSizeMultiplier={1.4}>
                    {label(t)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <AppText variant="caption" color="muted">
            {service && pro ? `${pro.first_name} has no open time for this in the next week.` : 'Pick a service and who does it.'}
          </AppText>
        )}
      </View>
      <AppText variant="caption" color="muted">
        Walk-ins pay at the salon. Nothing is charged through Hairday.
      </AppText>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.s },
  row: { gap: space.s, paddingRight: space.l },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  match: {
    backgroundColor: colors.surface,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
  },
  pressed: { opacity: 0.7 },
  semibold: { fontFamily: fonts.semibold, fontSize: 14 },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  time: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeOn: { backgroundColor: colors.ink, borderColor: colors.ink },
});
