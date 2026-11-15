import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { AtSign, Check, ChevronLeft, Globe, Phone, Plus, Share as ShareIcon, Store } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, EmptyState, FavoriteButton, IconButton, ListGroup, ListRow, Rating, ReviewCard, Skeleton, Tabs } from '@/components';
import { roleLabel } from '@/lib/catalog';
import { averageRating, categoryName } from '@/lib/discovery';
import { distanceMiles, formatMiles } from '@/lib/geo';
import { formatDuration, openStatus, weeklyHours } from '@/lib/hours';
import { InstagramIcon } from '@/components/icons';
import { salonLink } from '@/lib/links';
import { formatPrice } from '@/lib/money';
import { useOrigin, useSalon } from '@/hooks/useDiscovery';
import { colors, fonts, radius, space, touch } from '@/theme';

type Tab = 'services' | 'team' | 'reviews' | 'about';
const TABS: { key: Tab; label: string }[] = [
  { key: 'services', label: 'Services' },
  { key: 'team', label: 'Team' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'about', label: 'About' },
];

/** Salon page (Salon.html). `preview=1` is the owner looking at their own salon from Business mode. */
export default function SalonPage() {
  const { id, preview, pro: withPro } = useLocalSearchParams<{ id: string; preview?: string; pro?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const salon = useSalon(id);
  const origin = useOrigin(false);
  const [tab, setTab] = useState<Tab>('services');
  const [picked, setPicked] = useState<string[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const isPreview = preview === '1';

  const data = salon.data;
  const listing = data?.listing;
  const b = listing?.business;

  // Services grouped under their category heading, in the owner's order.
  const groups = useMemo(() => {
    const out: { title: string; items: NonNullable<typeof listing>['services'] }[] = [];
    for (const s of listing?.services ?? []) {
      const title = s.categorySlug ? categoryName(s.categorySlug) : 'Other';
      const g = out.find((x) => x.title === title);
      if (g) g.items.push(s);
      else out.push({ title, items: [s] });
    }
    return out;
  }, [listing]);

  if (salon.isPending) {
    return (
      <View style={styles.screen}>
        <Skeleton height={250} rounded={0} />
        <View style={styles.loading}>
          <Skeleton height={40} width={240} />
          <Skeleton height={20} width={200} />
          <Skeleton height={76} />
          <Skeleton height={76} />
        </View>
      </View>
    );
  }
  if (!data || !listing || !b) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8, paddingHorizontal: space.screen }]}>
        <IconButton accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <ChevronLeft size={22} strokeWidth={1.8} color={colors.ink} />
        </IconButton>
        <EmptyState
          icon={<Store size={28} strokeWidth={1.8} color={colors.goldText} />}
          title="Salon not found"
          body={salon.isError ? 'Check your connection and try again.' : 'This salon may no longer be on Hairday.'}
          actionLabel={salon.isError ? 'Try again' : undefined}
          onAction={salon.isError ? () => void salon.refetch() : undefined}
        />
      </View>
    );
  }

  const status = openStatus(listing.hours, new Date(), b.time_zone);
  const distance = origin.data && b.lat !== null && b.lng !== null ? formatMiles(distanceMiles(origin.data.point, { lat: b.lat, lng: b.lng })) : null;
  const street = [b.address_line1, b.address_line2].filter(Boolean).join(', ');
  const pickedServices = listing.services.filter((s) => picked.includes(s.id));
  const total = pickedServices.reduce((sum, s) => sum + s.price_cents, 0);
  const minutes = pickedServices.reduce((sum, s) => sum + s.duration_min, 0);
  const photos = listing.photos;

  const togglePick = (sid: string) => {
    Haptics.selectionAsync().catch(() => {});
    setPicked((cur) => (cur.includes(sid) ? cur.filter((x) => x !== sid) : [...cur, sid]));
  };

  const share = () => {
    const url = salonLink(b.id);
    Share.share({ message: `${b.name} on Hairday: ${url}`, url, title: b.name }).catch(() => {});
  };

  const chooseTime = () => {
    if (isPreview) return Alert.alert('Preview', 'Clients pick a time here. Booking isn’t available in preview.');
    router.push({ pathname: '/book/[salonId]/time', params: { salonId: b.id, services: picked.join(','), pro: withPro ?? '' } });
  };
  const bookingWith = withPro ? data.pros.find((p) => p.id === withPro) : undefined;

  const proName = (pid: string | null) => {
    const p = data.pros.find((x) => x.id === pid);
    return p ? p.first_name : undefined;
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={styles.gallery}>
          {photos.length ? (
            <FlatList
              data={photos}
              keyExtractor={(p) => p.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
              renderItem={({ item, index }) => (
                <Image
                  source={{ uri: item.url }}
                  style={{ width, height: 250, backgroundColor: colors.placeholder }}
                  contentFit="cover"
                  transition={150}
                  accessibilityLabel={`Salon photo ${index + 1} of ${photos.length}`}
                />
              )}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.noPhoto]} accessibilityLabel="No salon photos yet" accessible />
          )}
          <View style={[styles.photoBar, { top: insets.top + 6 }]}>
            <IconButton accessibilityLabel="Back" tone="white" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
              <ChevronLeft size={22} strokeWidth={1.8} color={colors.ink} />
            </IconButton>
            <View style={styles.photoActions}>
              <IconButton accessibilityLabel="Share salon" tone="white" onPress={share}>
                <ShareIcon size={19} strokeWidth={1.8} color={colors.ink} />
              </IconButton>
              {!isPreview ? <FavoriteButton target={{ business_id: b.id }} name={b.name} tone="white" /> : null}
            </View>
          </View>
          {photos.length > 1 ? (
            <View style={styles.counter} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <AppText variant="label" color="white" style={styles.medium}>
                {photoIndex + 1} / {photos.length}
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          {isPreview ? (
            <View style={styles.previewNote}>
              <AppText variant="caption" color="inkSoft">
                {b.is_published ? 'This is how clients see your salon.' : 'Preview — clients can’t see your salon until it’s live.'}
              </AppText>
            </View>
          ) : null}
          {bookingWith ? (
            <View style={styles.previewNote}>
              <AppText variant="caption" color="inkSoft">
                Booking with {bookingWith.first_name}. Pick the services you’d like, then choose a time.
              </AppText>
            </View>
          ) : null}
          <View style={styles.titleBlock}>
            <AppText variant="title" style={styles.name} accessibilityRole="header">
              {b.name}
            </AppText>
            <Rating rating={listing.rating} count={listing.reviewCount} long variant="small" after={b.type ? `· ${b.type}` : undefined} />
            <AppText variant="small" color="muted">
              {[street, distance, status.label].filter(Boolean).join(' · ')}
            </AppText>
          </View>

          <Tabs tabs={TABS} value={tab} onChange={setTab} />

          {tab === 'services' ? (
            groups.length ? (
              groups.map((g) => (
                <View key={g.title} style={styles.group}>
                  <AppText variant="label" color="muted" style={styles.overline} accessibilityRole="header">
                    {g.title.toUpperCase()}
                  </AppText>
                  {g.items.map((s) => {
                    const on = picked.includes(s.id);
                    return (
                      <Pressable
                        key={s.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={`${s.name}, ${formatDuration(s.duration_min)}, ${formatPrice(s.price_cents)}`}
                        accessibilityHint={on ? 'Removes it from your booking' : 'Adds it to your booking'}
                        onPress={() => togglePick(s.id)}
                        style={[styles.service, on && styles.serviceOn]}>
                        <View style={styles.flex1}>
                          <AppText style={styles.semibold}>{s.name}</AppText>
                          <AppText variant="caption" color="muted">
                            {[formatDuration(s.duration_min), s.description].filter(Boolean).join(' · ')}
                          </AppText>
                          <AppText variant="small" style={styles.semibold}>
                            {formatPrice(s.price_cents)}
                          </AppText>
                        </View>
                        <View style={[styles.addBtn, on ? styles.addOn : styles.addOff]}>
                          {on ? <Check size={20} strokeWidth={2} color={colors.onGold} /> : <Plus size={20} strokeWidth={1.8} color={colors.ink} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))
            ) : (
              <AppText color="muted">No services listed yet.</AppText>
            )
          ) : null}

          {tab === 'team' ? (
            data.pros.length ? (
              <ListGroup>
                {data.pros.map((p) => {
                  const ratings = data.reviews.filter((r) => r.professional_id === p.id).map((r) => r.rating);
                  const avg = averageRating(ratings);
                  const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
                  return (
                    <ListRow
                      key={p.id}
                      label={name}
                      sublabel={[roleLabel(p.role), avg !== null ? `★ ${avg.toFixed(1)} (${ratings.length})` : null].filter(Boolean).join(' · ')}
                      icon={<Avatar name={name} uri={p.avatar_url} size={44} tone="photo" />}
                      onPress={() => router.push({ pathname: '/pro/[id]', params: { id: p.id } })}
                    />
                  );
                })}
              </ListGroup>
            ) : (
              <AppText color="muted">The team hasn’t been added yet.</AppText>
            )
          ) : null}

          {tab === 'reviews' ? (
            data.reviews.length ? (
              <View style={styles.group}>
                <Rating rating={listing.rating} count={listing.reviewCount} long variant="body" />
                {data.reviews.map((r) => (
                  <ReviewCard key={r.id} review={r} proName={proName(r.professional_id)} />
                ))}
              </View>
            ) : (
              <AppText color="muted">No reviews yet. Reviews appear after clients finish an appointment.</AppText>
            )
          ) : null}

          {tab === 'about' ? (
            <View style={styles.about}>
              {b.description ? <AppText>{b.description}</AppText> : null}

              <Section title="Hours">
                {weeklyHours(listing.hours).map((h) => (
                  <View key={h.day} style={styles.hoursRow}>
                    <AppText variant="small">{h.day}</AppText>
                    <AppText variant="small" color={h.text === 'Closed' ? 'muted' : 'ink'} style={styles.flexShrink}>
                      {h.text}
                    </AppText>
                  </View>
                ))}
              </Section>

              <Section title="Location">
                <AppText variant="small">
                  {[street, [b.city, b.state].filter(Boolean).join(', '), b.zip].filter(Boolean).join(' · ') || 'Address not added yet'}
                </AppText>
              </Section>

              {b.amenities.length ? (
                <Section title="Amenities">
                  <TagList items={b.amenities} />
                </Section>
              ) : null}
              {b.health_safety.length ? (
                <Section title="Health & safety">
                  <TagList items={b.health_safety} />
                </Section>
              ) : null}

              {b.phone || b.website || b.instagram || b.tiktok ? (
                <Section title="Contact">
                  <ListGroup>
                    {b.phone ? (
                      <ListRow
                        label="Call"
                        value={formatPhone(b.phone)}
                        icon={<Phone size={20} strokeWidth={1.8} color={colors.ink} />}
                        onPress={() => open(`tel:${b.phone}`)}
                      />
                    ) : null}
                    {b.website ? (
                      <ListRow
                        label="Website"
                        value={b.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                        icon={<Globe size={20} strokeWidth={1.8} color={colors.ink} />}
                        onPress={() => open(/^https?:\/\//.test(b.website!) ? b.website! : `https://${b.website}`)}
                      />
                    ) : null}
                    {b.instagram ? (
                      <ListRow
                        label="Instagram"
                        value={`@${b.instagram}`}
                        icon={<InstagramIcon size={20} color={colors.ink} />}
                        onPress={() => open(`https://instagram.com/${b.instagram}`)}
                      />
                    ) : null}
                    {b.tiktok ? (
                      <ListRow
                        label="TikTok"
                        value={`@${b.tiktok}`}
                        icon={<AtSign size={20} strokeWidth={1.8} color={colors.ink} />}
                        onPress={() => open(`https://www.tiktok.com/@${b.tiktok}`)}
                      />
                    ) : null}
                  </ListGroup>
                </Section>
              ) : null}

              <Section title="Cancellation policy">
                <AppText variant="small">
                  Free cancellation until {b.cancellation_hours} hours before your appointment. After that, or if you don’t show up,{' '}
                  {b.late_cancel_percent}% of the service price is charged. If the salon cancels, you get everything back.
                </AppText>
              </Section>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 14 }]}>
        <View style={styles.flex1}>
          <AppText variant="caption" color="muted">
            {picked.length ? `${picked.length} ${picked.length === 1 ? 'service' : 'services'}` : 'Choose a service'}
          </AppText>
          <AppText style={styles.barTotal} numberOfLines={1}>
            {picked.length ? `${formatPrice(total)} · ${formatDuration(minutes)}` : 'Tap + to add'}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !picked.length }}
          disabled={!picked.length}
          onPress={chooseTime}
          style={({ pressed }) => [styles.cta, !picked.length && styles.ctaOff, pressed && { opacity: 0.88 }]}>
          <AppText variant="button" color="white">
            Choose a time
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="smallStrong" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

function TagList({ items }: { items: string[] }) {
  return (
    <View style={styles.tags}>
      {items.map((t) => (
        <View key={t} style={styles.tag}>
          <AppText variant="caption">{t}</AppText>
        </View>
      ))}
    </View>
  );
}

function open(url: string) {
  Linking.openURL(url).catch(() => Alert.alert('Couldn’t open that link'));
}

/** '+12125550101' → '(212) 555-0101'. */
function formatPhone(p: string): string {
  const d = p.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loading: { padding: space.screen, gap: space.m },
  gallery: { height: 250, backgroundColor: colors.tile6 },
  noPhoto: { backgroundColor: colors.tile6 },
  photoBar: { position: 'absolute', left: space.screen, right: space.screen, flexDirection: 'row', justifyContent: 'space-between' },
  photoActions: { flexDirection: 'row', gap: space.s },
  counter: {
    position: 'absolute',
    right: space.screen,
    bottom: 36,
    backgroundColor: colors.inkGlassStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  medium: { fontFamily: fonts.medium },
  body: {
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.bg,
    paddingTop: 22,
    paddingHorizontal: space.screen,
    gap: space.l,
  },
  previewNote: { backgroundColor: colors.tint, borderRadius: radius.card, padding: space.m },
  titleBlock: { gap: 6 },
  name: { fontSize: 36, lineHeight: 38, letterSpacing: -0.5 },
  group: { gap: 10 },
  overline: { fontFamily: fonts.semibold, letterSpacing: 1.2 },
  service: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderRadius: radius.card,
    padding: 14,
  },
  serviceOn: { borderColor: colors.gold, borderWidth: 1.5, padding: 13.5 },
  flex1: { flex: 1, gap: 3 },
  flexShrink: { flexShrink: 1, textAlign: 'right' },
  semibold: { fontFamily: fonts.semibold },
  addBtn: { width: touch, height: touch, borderRadius: touch / 2, alignItems: 'center', justifyContent: 'center' },
  addOn: { backgroundColor: colors.gold },
  addOff: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  about: { gap: space.xl },
  section: { gap: space.s },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.m, minHeight: 28, alignItems: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: colors.tint, borderRadius: radius.pill, paddingHorizontal: space.m, paddingVertical: 6 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 14,
    paddingHorizontal: space.screen,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
  },
  barTotal: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  cta: {
    minHeight: 50,
    paddingHorizontal: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaOff: { opacity: 0.4 },
});
