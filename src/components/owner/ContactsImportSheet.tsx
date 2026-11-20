import { Contact, ContactField, requestPermissionsAsync } from 'expo-contacts';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useImportClients } from '@/hooks/useOwnerDay';
import { normalizeEmail } from '@/lib/email';
import { formatPhone } from '@/lib/phone';
import type { Client } from '@/lib/types';
import { colors, fonts, radius, space } from '@/theme';
import { errorText } from '@/lib/errors';

import { AppText } from '../AppText';
import { Button } from '../Button';
import { ModalSheet } from '../ModalSheet';

type Person = { key: string; name: string; email: string | null; phone: string | null };

type Props = { visible: boolean; onClose: () => void; businessId: string; existing: Client[] };

/**
 * Clients → New → Import from your contacts. Asks for contacts permission only now, when tapped
 * (SPEC §12), and imports just the people picked.
 */
export function ContactsImportSheet(props: Props) {
  if (!props.visible) return null;
  return <ImportForm {...props} />;
}

function ImportForm({ onClose, businessId, existing }: Props) {
  const imp = useImportClients();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      const perm = await requestPermissionsAsync();
      if (!perm.granted) {
        if (live) setDenied(true);
        return;
      }
      const all = await Contact.getAllDetails([
        ContactField.FULL_NAME,
        ContactField.GIVEN_NAME,
        ContactField.FAMILY_NAME,
        ContactField.EMAILS,
        ContactField.PHONES,
      ] as const);
      const list: Person[] = all
        .map((c, i) => {
          const name = (c.fullName || [c.givenName, c.familyName].filter(Boolean).join(' ')).trim();
          const email = c.emails?.find((e) => e.address)?.address ?? null;
          const phone = c.phones?.find((p) => p.number)?.number ?? null;
          return { key: `${i}-${name}`, name, email: email ? normalizeEmail(email) : null, phone: phone ? formatPhone(phone) : null };
        })
        .filter((p) => p.name)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (live) setPeople(list);
    })().catch(() => live && setPeople([]));
    return () => {
      live = false;
    };
  }, []);

  const already = (p: Person) =>
    existing.some(
      (c) =>
        (p.email && c.email?.toLowerCase() === p.email) ||
        (p.phone && c.phone && c.phone.replace(/\D/g, '').slice(-10) === p.phone.replace(/\D/g, '').slice(-10)),
    );
  const shown = (people ?? []).filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (k: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const onImport = async () => {
    const chosen = (people ?? []).filter((p) => picked.has(p.key));
    try {
      const r = await imp.mutateAsync({ business_id: businessId, people: chosen, existing });
      onClose();
      Alert.alert(
        r.added === 1 ? '1 client added' : `${r.added} clients added`,
        r.skipped ? `${r.skipped} ${r.skipped === 1 ? 'was' : 'were'} already on your list.` : undefined,
      );
    } catch (e) {
      Alert.alert('Couldn’t import', errorText(e, 'Please try again.'));
    }
  };

  return (
    <ModalSheet
      visible
      onClose={onClose}
      title="Import contacts"
      footer={
        people?.length ? (
          <Button
            title={picked.size ? `Import ${picked.size}` : 'Pick people to import'}
            onPress={onImport}
            disabled={!picked.size}
            loading={imp.isPending}
          />
        ) : undefined
      }>
      {denied ? (
        <View style={styles.center}>
          <AppText color="inkSoft" style={styles.centerText}>
            Hairday needs permission to see your contacts so you can pick who to import. You can turn it on in Settings.
          </AppText>
          <Button title="Open Settings" variant="secondary" onPress={() => Linking.openSettings()} />
        </View>
      ) : !people ? (
        <ActivityIndicator color={colors.muted} style={styles.loading} />
      ) : !people.length ? (
        <AppText color="muted">No contacts found on this phone.</AppText>
      ) : (
        <>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search contacts"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Search contacts"
            style={styles.search}
            autoCorrect={false}
          />
          <View>
            {shown.map((p) => {
              const on = picked.has(p.key);
              const dup = already(p);
              return (
                <Pressable
                  key={p.key}
                  onPress={() => !dup && toggle(p.key)}
                  disabled={dup}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: dup }}
                  accessibilityLabel={`${p.name}${dup ? ', already a client' : ''}`}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed, dup && styles.dim]}>
                  <View style={[styles.box, on && styles.boxOn]}>
                    {on ? <Check size={16} strokeWidth={2.4} color={colors.white} /> : null}
                  </View>
                  <View style={styles.flex1}>
                    <AppText style={styles.name} numberOfLines={1}>
                      {p.name}
                    </AppText>
                    <AppText variant="caption" color="muted" numberOfLines={1}>
                      {dup ? 'Already a client' : (p.phone ?? p.email ?? 'No phone or email')}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  center: { gap: space.l },
  centerText: { fontSize: 15, lineHeight: 22 },
  loading: { marginVertical: space.xxl },
  search: {
    minHeight: 48,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardLine,
  },
  pressed: { opacity: 0.7 },
  dim: { opacity: 0.5 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  flex1: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.semibold, fontSize: 15 },
});
