import { useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { useDeleteClient, useSaveClient } from '@/hooks/useOwnerDay';
import { emailError, normalizeEmail } from '@/lib/email';
import { formatPhone, phoneError } from '@/lib/phone';
import type { Client } from '@/lib/types';
import { fonts, space } from '@/theme';

import { AppText } from '../AppText';
import { Button } from '../Button';
import { Input } from '../Input';
import { ModalSheet } from '../ModalSheet';

type Props = {
  visible: boolean;
  onClose: () => void;
  businessId: string;
  /** Editing this client; otherwise adding a new one. */
  client?: Client | null;
  onImport?: () => void;
  onDeleted?: () => void;
};

/** Add or edit a client (Clients.html "New"). Email and phone are both optional and checked separately. */
export function ClientSheet(props: Props) {
  if (!props.visible) return null;
  return <ClientForm {...props} />;
}

function ClientForm({ onClose, businessId, client, onImport, onDeleted }: Props) {
  const save = useSaveClient();
  const remove = useDeleteClient();
  const [name, setName] = useState(client?.name ?? '');
  const [email, setEmail] = useState(client?.email ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [notes, setNotes] = useState(client?.notes ?? '');
  const [tried, setTried] = useState(false);

  const nameErr = !name.trim() ? 'Enter the client’s name.' : null;
  const emailErr = email.trim() ? emailError(email) : null;
  const phoneErr = phoneError(phone);
  const hasAccount = !!client?.profile_id;

  const onSave = async () => {
    setTried(true);
    if (nameErr || emailErr || phoneErr) return;
    try {
      await save.mutateAsync({
        id: client?.id,
        business_id: businessId,
        name: name.trim(),
        email: email.trim() ? normalizeEmail(email) : null,
        phone: phone.trim() ? formatPhone(phone) : null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (e) {
      Alert.alert('Couldn’t save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const onDelete = () =>
    Alert.alert(`Remove ${client?.name}?`, 'They’ll be taken off your client list. Their past appointments stay on your calendar.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove.mutateAsync(client!.id);
            onClose();
            onDeleted?.();
          } catch (e) {
            Alert.alert('Couldn’t remove', e instanceof Error ? e.message : 'Please try again.');
          }
        },
      },
    ]);

  return (
    <ModalSheet
      visible
      onClose={onClose}
      title={client ? 'Edit client' : 'New client'}
      footer={<Button title={client ? 'Save' : 'Add client'} onPress={onSave} loading={save.isPending} />}>
      {!client && onImport ? (
        <Pressable onPress={onImport} accessibilityRole="button" style={({ pressed }) => [styles.import, pressed && styles.pressed]}>
          <AppText style={styles.link} color="goldText">
            Import from your contacts
          </AppText>
        </Pressable>
      ) : null}
      <Input
        label="Name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        textContentType="name"
        error={tried ? nameErr : null}
      />
      <Input
        label="Email (optional)"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
        error={tried || email.length > 4 ? emailErr : null}
        hint={hasAccount ? 'From their Hairday account.' : undefined}
      />
      <Input
        label="Phone (optional)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        error={tried || phone.replace(/\D/g, '').length >= 10 ? phoneErr : null}
      />
      <Input
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        multiline
        placeholder="Allergies, preferences, color formula…"
        style={styles.notes}
      />
      {client ? (
        <Pressable onPress={onDelete} accessibilityRole="button" style={({ pressed }) => [styles.import, pressed && styles.pressed]}>
          <AppText style={styles.link} color="danger">
            Remove from client list
          </AppText>
        </Pressable>
      ) : null}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  import: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { fontFamily: fonts.semibold, fontSize: 15 },
  pressed: { opacity: 0.6 },
  notes: { minHeight: 88, textAlignVertical: 'top', paddingTop: space.m },
});
