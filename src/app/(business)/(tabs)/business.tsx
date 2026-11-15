import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowLeftRight } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Chip, Input, ListGroup, ListRow, ModalSheet, PhotoGrid, PillButton, Skeleton } from '@/components';
import { useBusinessPhotos, useMyBusiness, useOwnerAction, useServices, useTeam } from '@/hooks/useOwner';
import { useSession } from '@/hooks/useSession';
import { shortAddress } from '@/lib/address';
import { AMENITIES, HEALTH_SAFETY } from '@/lib/catalog';
import { addBusinessPhoto, removeBusinessPhoto, setBusinessLogo, updateBusiness } from '@/lib/owner';
import { pickPhoto } from '@/lib/photos';
import type { Business } from '@/lib/types';
import { colors, space } from '@/theme';

/** Business profile (BizProfile.html). */
export default function BusinessProfile() {
  const insets = useSafeAreaInsets();
  const { setMode } = useSession();
  const business = useMyBusiness();
  const b = business.data;
  const photos = useBusinessPhotos(b?.id);
  const services = useServices(b?.id);
  const team = useTeam(b?.id);
  const [aboutOpen, setAboutOpen] = useState(false);

  const save = useOwnerAction((patch: Partial<Business>) => updateBusiness(b!.id, patch));
  const addPhoto = useOwnerAction(async (uri: string) => addBusinessPhoto(b!.id, uri, photos.data?.length ?? 0));
  const removePhoto = useOwnerAction(removeBusinessPhoto);
  const changeLogo = useOwnerAction((uri: string) => setBusinessLogo(b!.id, uri));

  // Chips update instantly (local copy); the save happens in the background.
  const [amenityEdits, setAmenities] = useState<string[] | null>(null);
  const [safetyEdits, setSafety] = useState<string[] | null>(null);
  const amenities = amenityEdits ?? b?.amenities ?? [];
  const safety = safetyEdits ?? b?.health_safety ?? [];
  const toggleIn = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  if (!b) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 56, paddingHorizontal: space.screen, gap: space.l }]}>
        <Skeleton height={52} width={220} />
        <Skeleton height={76} />
        <Skeleton height={216} />
      </View>
    );
  }

  const fail = (e: unknown) => Alert.alert('Couldn’t save', e instanceof Error ? e.message : 'Try again.');
  const proCount = team.data?.length ?? 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={business.isRefetching} onRefresh={() => void business.refetch()} tintColor={colors.muted} />}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salon logo"
          accessibilityHint="Double-tap to change it"
          onPress={async () => {
            const uri = await pickPhoto({ square: true, title: 'Change your logo' });
            if (uri) changeLogo.mutateAsync(uri).catch(fail);
          }}>
          {b.logo_url ? <Image source={{ uri: b.logo_url }} style={styles.logo} contentFit="cover" /> : <View style={[styles.logo, styles.logoEmpty]} />}
        </Pressable>
        <View style={styles.titles}>
          <AppText variant="cardTitle" style={styles.name} numberOfLines={2} accessibilityRole="header">
            {b.name}
          </AppText>
          <AppText variant="caption" color="muted">
            {b.type ?? 'Business'} · {b.is_published ? 'Live on Hairday' : 'Not live yet'}
          </AppText>
        </View>
        <PillButton
          title="Preview"
          variant="secondary"
          onPress={() => router.push({ pathname: '/salon/[id]', params: { id: b.id, preview: '1' } })}
        />
      </View>

      <PhotoGrid
        photos={photos.data ?? []}
        adding={addPhoto.isPending}
        addLabel="Add photos"
        photoLabel="Salon photo"
        onAdd={async () => {
          const uri = await pickPhoto({ title: 'Add a salon photo' });
          if (uri) addPhoto.mutateAsync(uri).catch(fail);
        }}
        onRemove={(id) => removePhoto.mutateAsync(id).catch(fail)}
      />

      <ListGroup>
        <ListRow label="Services" value={String(services.data?.length ?? 0)} onPress={() => router.push('/(business)/services')} />
        <ListRow label="Team" value={`${proCount} ${proCount === 1 ? 'professional' : 'professionals'}`} onPress={() => router.push('/(business)/team')} />
        <ListRow label="Location & hours" value={shortAddress(b.address_line1)} onPress={() => router.push({ pathname: '/(business)/setup', params: { edit: '1' } })} />
        <ListRow label="Payouts" value={b.payouts_enabled ? 'On' : 'Finish setup'} valueAccent={!b.payouts_enabled} onPress={() => router.push('/(business)/payouts')} />
      </ListGroup>

      {!b.is_published ? (
        <View style={styles.notice}>
          <AppText variant="caption" color="inkSoft">
            Clients can’t find your salon yet. It goes live once you’ve added services, your team and payouts.
          </AppText>
        </View>
      ) : null}

      <View style={styles.group}>
        <AppText variant="smallStrong">Amenities</AppText>
        <View style={styles.chips}>
          {AMENITIES.map((a) => (
            <Chip
              key={a}
              label={a}
              selected={amenities.includes(a)}
              onPress={() => {
                const next = toggleIn(amenities, a);
                setAmenities(next);
                save.mutateAsync({ amenities: next }).catch(fail);
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <AppText variant="smallStrong">Health & safety</AppText>
        <View style={styles.chips}>
          {HEALTH_SAFETY.map((a) => (
            <Chip
              key={a}
              label={a}
              selected={safety.includes(a)}
              onPress={() => {
                const next = toggleIn(safety, a);
                setSafety(next);
                save.mutateAsync({ health_safety: next }).catch(fail);
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <AppText variant="smallStrong">About & contact</AppText>
        <ListGroup>
          <ListRow
            label={b.description ? 'About your salon' : 'Add a description'}
            sublabel={[b.phone, b.instagram && `@${b.instagram}`].filter(Boolean).join(' · ') || 'Phone, website, Instagram, TikTok'}
            onPress={() => setAboutOpen(true)}
          />
        </ListGroup>
      </View>

      <View style={styles.group}>
        <AppText variant="smallStrong">Cancellation policy</AppText>
        <ListGroup>
          <ListRow label="Free cancellation until" right={<AppText variant="bodyStrong">{b.cancellation_hours} hr before</AppText>} />
          <ListRow label="Late cancel or no-show" right={<AppText variant="bodyStrong">{b.late_cancel_percent}% charge</AppText>} />
        </ListGroup>
      </View>

      <Button
        title="Switch to booking"
        variant="secondary"
        icon={<ArrowLeftRight size={18} strokeWidth={1.8} color={colors.ink} />}
        accessibilityHint="Go back to the customer side of Hairday"
        onPress={() => {
          setMode('customer');
          router.replace('/(customer)/(tabs)/profile');
        }}
      />

      <AboutSheet visible={aboutOpen} business={b} onClose={() => setAboutOpen(false)} />
    </ScrollView>
  );
}

/** Description, phone and socials (shown on the salon page's About tab). */
function AboutSheet({ visible, business, onClose }: { visible: boolean; business: Business; onClose: () => void }) {
  // Mounted only while open, so the fields start from what's saved each time.
  return visible ? <AboutForm business={business} onClose={onClose} /> : null;
}

function AboutForm({ business, onClose }: { business: Business; onClose: () => void }) {
  const [form, setForm] = useState({
    description: business.description ?? '',
    phone: business.phone ?? '',
    website: business.website ?? '',
    instagram: business.instagram ?? '',
    tiktok: business.tiktok ?? '',
  });
  const [errors, setErrors] = useState<{ phone?: string; website?: string }>({});
  const save = useOwnerAction((patch: Partial<Business>) => updateBusiness(business.id, patch));
  const set = (k: keyof typeof form) => (v: string) => setForm({ ...form, [k]: v });
  const handle = (v: string) => v.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?(instagram|tiktok)\.com\/@?/i, '').replace(/\/$/, '');

  const submit = async () => {
    const e: typeof errors = {};
    const digits = form.phone.replace(/\D/g, '');
    if (form.phone.trim() && !(digits.length === 10 || (digits.length === 11 && digits.startsWith('1')))) e.phone = 'Enter a 10-digit US phone number.';
    if (form.website.trim() && !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/.*)?$/i.test(form.website.trim())) e.website = 'That website doesn’t look right.';
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await save.mutateAsync({
        description: form.description.trim() || null,
        phone: form.phone.trim() || null,
        website: form.website.trim() || null,
        instagram: handle(form.instagram) || null,
        tiktok: handle(form.tiktok) || null,
      });
      onClose();
    } catch (err) {
      Alert.alert('Couldn’t save', err instanceof Error ? err.message : 'Try again.');
    }
  };

  return (
    <ModalSheet visible onClose={onClose} title="About & contact" footer={<Button title="Save changes" onPress={submit} loading={save.isPending} />}>
      <Input label="About your salon" value={form.description} onChangeText={set('description')} multiline maxLength={600} placeholder="What makes your salon special?" style={styles.textarea} />
      <Input label="Phone" value={form.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" textContentType="telephoneNumber" placeholder="(212) 555-0123" />
      <Input label="Website (optional)" value={form.website} onChangeText={set('website')} error={errors.website} keyboardType="url" autoCapitalize="none" autoCorrect={false} placeholder="lisassalon.com" />
      <Input label="Instagram (optional)" value={form.instagram} onChangeText={set('instagram')} autoCapitalize="none" autoCorrect={false} placeholder="@lisassalon" />
      <Input label="TikTok (optional)" value={form.tiktok} onChangeText={set('tiktok')} autoCapitalize="none" autoCorrect={false} placeholder="@lisassalon" />
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.screen, paddingBottom: space.xxl * 2, gap: 14 },
  // Wraps so the Preview button drops to its own line when the text is very large.
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.m },
  logo: { width: 52, height: 52, borderRadius: 16 },
  logoEmpty: { backgroundColor: colors.placeholder },
  titles: { flex: 1, minWidth: 160, gap: 2 },
  name: { fontSize: 28, lineHeight: 30 },
  group: { gap: space.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  notice: { backgroundColor: colors.tint, borderRadius: 16, padding: 14 },
  textarea: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
});
