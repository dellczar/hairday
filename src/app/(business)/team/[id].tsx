import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, Check } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Chip, Input, PhotoGrid, ScreenHeader, Skeleton, Toggle } from '@/components';
import { useMyBusiness, useOwnerAction, useProPhotos, useServices, useTeam } from '@/hooks/useOwner';
import { defaultRoleFor, ROLES } from '@/lib/catalog';
import { formatDuration } from '@/lib/hours';
import { addProPhoto, deleteProfessional, removeProPhoto, saveProfessional } from '@/lib/owner';
import { pickPhoto } from '@/lib/photos';
import type { Business, Professional, ProRole, Service } from '@/lib/types';
import { colors, radius, space } from '@/theme';
import { errorText } from '@/lib/errors';

/** Add / edit professional (Team.html). Route: /team/new or /team/<id>. */
export default function ProfessionalEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const business = useMyBusiness();
  const b = business.data;
  const services = useServices(b?.id);
  const team = useTeam(b?.id);
  const existing = isNew ? undefined : team.data?.find((p) => p.id === id);
  if (!b || !services.data || (!isNew && !team.data)) return <Loading />;
  return <ProfessionalForm key={id} id={id} business={b} services={services.data} existing={existing} />;
}

function Loading() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, styles.content, { paddingTop: insets.top + 8 }]}>
      <ScreenHeader title="Professional" />
      <Skeleton height={72} />
      <Skeleton height={120} />
      <Skeleton height={200} />
    </View>
  );
}

type TeamMember = Professional & { serviceIds: string[] };

function ProfessionalForm({ id, business: b, services, existing }: { id: string; business: Business; services: Service[]; existing?: TeamMember }) {
  const insets = useSafeAreaInsets();
  const isNew = id === 'new';
  const photos = useProPhotos(isNew ? undefined : id);

  // New people get the role that fits the salon and offer every service until unticked.
  const [first, setFirst] = useState(existing?.first_name ?? '');
  const [last, setLast] = useState(existing?.last_name ?? '');
  const [role, setRole] = useState<ProRole>(existing?.role ?? defaultRoleFor(b.type));
  const [instagram, setInstagram] = useState(existing?.instagram ?? '');
  const [active, setActive] = useState(existing?.is_active ?? true);
  const [serviceIds, setServiceIds] = useState<string[]>(existing?.serviceIds ?? services.map((s) => s.id));
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [firstError, setFirstError] = useState<string | null>(null);

  const save = useOwnerAction(saveProfessional);
  const remove = useOwnerAction(deleteProfessional);
  const addPhoto = useOwnerAction((uri: string) => addProPhoto(b.id, id, uri, photos.data?.length ?? 0));
  const removePhoto = useOwnerAction(removeProPhoto);

  const submit = async () => {
    if (!first.trim()) return setFirstError('Enter a first name.');
    setFirstError(null);
    try {
      const pro = await save.mutateAsync({
        id: isNew ? undefined : id,
        business_id: b.id,
        first_name: first.trim(),
        last_name: last.trim() || null,
        role,
        instagram: instagram.trim().replace(/^@/, '') || null,
        is_active: active,
        serviceIds,
        avatarUri,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // "Save and set hours" → Availability for this person.
      router.dismissTo({ pathname: '/(business)/(tabs)/hours', params: { pro: pro.id } });
    } catch (e) {
      Alert.alert('Couldn’t save', errorText(e, 'Try again.'));
    }
  };

  const confirmDelete = () =>
    Alert.alert(`Remove ${first}?`, 'They’ll be taken off your team and clients can’t book them. Past bookings stay in your records.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          remove
            .mutateAsync(id)
            .then(() => router.back())
            .catch(() => Alert.alert('Couldn’t remove', 'Try again.')),
      },
    ]);

  const toggleService = (sid: string) => {
    Haptics.selectionAsync().catch(() => {});
    setServiceIds(serviceIds.includes(sid) ? serviceIds.filter((x) => x !== sid) : [...serviceIds, sid]);
  };

  const shownAvatar = avatarUri ?? existing?.avatar_url ?? null;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
        <ScreenHeader
          title={isNew ? 'Add professional' : 'Edit professional'}
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Opens their page the way clients see it"
              style={styles.preview}
              onPress={() =>
                isNew
                  ? Alert.alert('Save first', 'Save this person, then you can preview their page the way clients see it.')
                  : router.push({ pathname: '/pro/[id]', params: { id } })
              }>
              <AppText variant="smallStrong" style={styles.underline}>
                Preview
              </AppText>
            </Pressable>
          }
        />

        <>
            <View style={styles.nameRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={shownAvatar ? 'Change profile photo' : 'Add profile photo'}
                onPress={async () => setAvatarUri((await pickPhoto({ square: true, title: 'Profile photo' })) ?? avatarUri)}>
                {shownAvatar ? (
                  <Image source={{ uri: shownAvatar }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, styles.avatarEmpty]}>
                    <Camera size={24} strokeWidth={1.8} color={colors.muted} />
                  </View>
                )}
              </Pressable>
              <View style={styles.names}>
                <View style={styles.flex1}>
                  <Input label="First name" value={first} onChangeText={(t) => { setFirst(t); setFirstError(null); }} error={firstError} autoCapitalize="words" textContentType="givenName" placeholder="April" />
                </View>
                <View style={styles.flex1}>
                  <Input label="Last name" value={last} onChangeText={setLast} autoCapitalize="words" textContentType="familyName" placeholder="Olson" />
                </View>
              </View>
            </View>

            <View style={styles.group}>
              <AppText variant="smallStrong">Role</AppText>
              <View style={styles.chips}>
                {ROLES.map((r) => (
                  <Chip key={r.value} label={r.label} selected={role === r.value} onPress={() => setRole(r.value)} />
                ))}
              </View>
            </View>

            <View style={styles.group}>
              <AppText variant="smallStrong">Services they offer</AppText>
              {services.length ? (
                <View style={styles.box}>
                  {services.map((s, i) => {
                    const on = serviceIds.includes(s.id);
                    return (
                      <Pressable
                        key={s.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={`${s.name}, ${formatDuration(s.duration_min)}`}
                        onPress={() => toggleService(s.id)}
                        style={[styles.check, i < services.length - 1 && styles.divider]}>
                        <View style={[styles.tick, on ? styles.tickOn : styles.tickOff]}>{on ? <Check size={14} strokeWidth={3} color={colors.white} /> : null}</View>
                        <AppText style={styles.flex1}>{s.name}</AppText>
                        <AppText variant="caption" color="muted">
                          {formatDuration(s.duration_min)}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.notice}>
                  <AppText variant="caption" color="inkSoft">
                    You haven’t added services yet. Add them from Business → Services, then tick which ones each person offers.
                  </AppText>
                </View>
              )}
            </View>

            <View style={styles.group}>
              <AppText variant="smallStrong">Portfolio</AppText>
              {isNew ? (
                <AppText variant="caption" color="muted">
                  Save first, then add photos of their work.
                </AppText>
              ) : (
                <PhotoGrid
                  photos={photos.data ?? []}
                  adding={addPhoto.isPending}
                  addLabel="Add portfolio photos"
                  photoLabel="Portfolio photo"
                  onAdd={async () => {
                    const uri = await pickPhoto({ title: 'Add a portfolio photo' });
                    if (uri) addPhoto.mutateAsync(uri).catch(() => Alert.alert('Couldn’t add the photo', 'Try again.'));
                  }}
                  onRemove={(pid) => removePhoto.mutateAsync(pid).catch(() => Alert.alert('Couldn’t remove the photo', 'Try again.'))}
                />
              )}
            </View>

            <Input label="Instagram (optional)" value={instagram} onChangeText={setInstagram} autoCapitalize="none" autoCorrect={false} placeholder="@aprilcuts" />

            {!isNew ? (
              <>
                <View style={styles.toggleRow}>
                  <View style={styles.flex1}>
                    <AppText>Taking bookings</AppText>
                    <AppText variant="caption" color="muted">
                      Turn off while they’re away for a long time.
                    </AppText>
                  </View>
                  <Toggle
                    value={active}
                    accessibilityLabel="Taking bookings"
                    onChange={setActive}
                  />
                </View>
                <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.link}>
                  <AppText variant="smallStrong" color="danger">
                    Remove from team
                  </AppText>
                </Pressable>
              </>
            ) : null}
        </>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button title="Save and set hours" onPress={submit} loading={save.isPending} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.screen, gap: space.l, paddingBottom: space.xxl },
  flex1: { flex: 1 },
  preview: { minHeight: 44, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36, marginTop: 22 },
  avatarEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.placeholder, alignItems: 'center', justifyContent: 'center' },
  names: { flex: 1, flexDirection: 'row', gap: space.s },
  group: { gap: space.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  box: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardLine, borderRadius: radius.card, paddingHorizontal: 14 },
  check: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: space.m },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  tick: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tickOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  tickOff: { borderColor: colors.placeholder },
  notice: { backgroundColor: colors.tint, borderRadius: 16, padding: 14 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  footer: { paddingHorizontal: space.screen, paddingTop: 14, backgroundColor: colors.bg },
});
