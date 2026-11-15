import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Star, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, BackButton, EmptyState, FavoriteButton, ReviewCard, Skeleton, Tabs } from '@/components';
import { InstagramIcon } from '@/components/icons';
import { usePro } from '@/hooks/useDiscovery';
import { roleLabel } from '@/lib/catalog';
import { averageRating } from '@/lib/discovery';
import { formatDuration } from '@/lib/hours';
import { formatPrice } from '@/lib/money';
import { colors, fonts, radius, space } from '@/theme';

type Tab = 'portfolio' | 'services' | 'reviews';
const TABS: { key: Tab; label: string }[] = [
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'services', label: 'Services' },
  { key: 'reviews', label: 'Reviews' },
];

/** Professional page (Pro.html): photo, role, rating, Instagram; Portfolio / Services / Reviews; Book with [name]. */
export default function ProPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const q = usePro(id);
  const [tab, setTab] = useState<Tab>('portfolio');

  if (q.isPending) {
    return (
      <View style={[styles.screen, styles.pad, { paddingTop: insets.top + 8, gap: space.l }]}>
        <Skeleton height={44} width={44} rounded={22} />
        <Skeleton height={84} />
        <Skeleton height={240} />
      </View>
    );
  }
  const d = q.data;
  if (!d) {
    return (
      <View style={[styles.screen, styles.pad, { paddingTop: insets.top + 8 }]}>
        <BackButton />
        <EmptyState
          icon={<UserRound size={28} strokeWidth={1.8} color={colors.goldText} />}
          title="Professional not found"
          body={q.isError ? 'Check your connection and try again.' : 'They may no longer take bookings on Hairday.'}
        />
      </View>
    );
  }

  const { pro, business } = d;
  const name = [pro.first_name, pro.last_name].filter(Boolean).join(' ');
  const rating = averageRating(d.reviews.map((r) => r.rating));

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.pad, styles.content, { paddingTop: insets.top + 8, paddingBottom: 110 + insets.bottom }]}>
        <View style={styles.topBar}>
          <BackButton />
          <FavoriteButton target={{ professional_id: pro.id }} name={name} />
        </View>

        <View style={styles.head}>
          <Avatar name={name} uri={pro.avatar_url} size={84} tone="photo" />
          <View style={styles.headText}>
            <AppText variant="title" style={styles.name} accessibilityRole="header">
              {name}
            </AppText>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`${roleLabel(pro.role)} at ${business?.name ?? 'their salon'}`}
              accessibilityHint="Opens the salon page"
              disabled={!business}
              onPress={() => business && router.push({ pathname: '/salon/[id]', params: { id: business.id } })}>
              <AppText variant="small" color="muted">
                {roleLabel(pro.role)}
                {business ? ` · ${business.name}` : ''}
              </AppText>
            </Pressable>
            <View style={styles.pills}>
              <View
                style={styles.pill}
                accessible
                accessibilityLabel={rating === null ? 'No reviews yet' : `Rated ${rating.toFixed(1)}, ${d.reviews.length} reviews`}>
                <Star size={14} color={colors.star} fill={colors.star} strokeWidth={0} />
                <AppText variant="caption">
                  {rating === null ? (
                    'New'
                  ) : (
                    <>
                      <AppText variant="caption" style={styles.bold}>
                        {rating.toFixed(1)}
                      </AppText>{' '}
                      ({d.reviews.length})
                    </>
                  )}
                </AppText>
              </View>
              {pro.instagram ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`Instagram, @${pro.instagram}`}
                  onPress={() => Linking.openURL(`https://instagram.com/${pro.instagram}`).catch(() => {})}
                  style={styles.pill}
                  hitSlop={7}>
                  <InstagramIcon size={14} color={colors.ink} />
                  <AppText variant="caption">Instagram</AppText>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        <Tabs tabs={TABS} value={tab} onChange={setTab} />

        {tab === 'portfolio' ? (
          d.photos.length ? (
            <View style={styles.grid}>
              {d.photos.map((p, i) => (
                <View key={p.id} style={styles.cell}>
                  <Image
                    source={{ uri: p.url }}
                    style={styles.photo}
                    contentFit="cover"
                    transition={150}
                    accessibilityLabel={`Work by ${pro.first_name}, photo ${i + 1}`}
                  />
                </View>
              ))}
            </View>
          ) : (
            <AppText color="muted">{pro.first_name} hasn’t added photos yet.</AppText>
          )
        ) : null}

        {tab === 'services' ? (
          d.services.length ? (
            <View style={styles.list}>
              {d.services.map((s) => (
                <View
                  key={s.id}
                  style={styles.service}
                  accessible
                  accessibilityLabel={`${s.name}, ${formatDuration(s.duration_min)}, ${formatPrice(s.price_cents)}`}>
                  <View style={styles.flex1}>
                    <AppText style={styles.bold}>{s.name}</AppText>
                    <AppText variant="caption" color="muted">
                      {[formatDuration(s.duration_min), s.description].filter(Boolean).join(' · ')}
                    </AppText>
                  </View>
                  <AppText style={styles.bold}>{formatPrice(s.price_cents)}</AppText>
                </View>
              ))}
            </View>
          ) : (
            <AppText color="muted">No services listed yet.</AppText>
          )
        ) : null}

        {tab === 'reviews' ? (
          d.reviews.length ? (
            <View style={styles.list}>
              {d.reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </View>
          ) : (
            <AppText color="muted">No reviews for {pro.first_name} yet.</AppText>
          )
        ) : null}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => Alert.alert('Almost there', `Booking with ${pro.first_name} is built in the next phase.`)}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.88 }]}>
          <AppText variant="button" color="white">
            Book with {pro.first_name}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: space.screen },
  content: { gap: space.l },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.l },
  headText: { flex: 1, gap: 6 },
  name: { fontSize: 32, lineHeight: 34, letterSpacing: -0.5 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  bold: { fontFamily: fonts.semibold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  cell: { width: '33.333%', padding: 3 },
  photo: { height: 112, borderRadius: 14, backgroundColor: colors.placeholder },
  list: { gap: space.s },
  service: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderRadius: radius.card,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.m,
  },
  flex1: { flex: 1, gap: 3 },
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
  },
  cta: { minHeight: 52, borderRadius: radius.pill, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
