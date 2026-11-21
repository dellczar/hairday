import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, MapPin, Search, Star } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedPressable, AppText, Headline, usePressScale } from '@/components';
import { useMyBookings } from '@/hooks/useBooking';
import { useListings, useOrigin } from '@/hooks/useDiscovery';
import { categoryName, DEFAULT_FILTERS, HOME_TILES, search, type SalonResult } from '@/lib/discovery';
import { formatMiles, type LatLng } from '@/lib/geo';
import { formatPrice } from '@/lib/money';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useSession } from '@/hooks/useSession';
import { colors, fonts, radius, space, type, type ColorName } from '@/theme';

const TILE_COLORS: ColorName[] = ['tile1', 'tile2', 'tile3', 'tile4', 'tile5', 'tile6'];

/** Category photos for the Home tiles (owner-supplied, Nov 2026). The tan color shows while each loads. */
const TILE_PHOTOS: Record<(typeof HOME_TILES)[number], number> = {
  haircut: require('../../../../assets/images/categories/haircut.jpg'),
  braids: require('../../../../assets/images/categories/braids.jpg'),
  nails: require('../../../../assets/images/categories/nails.jpg'),
  eyelashes: require('../../../../assets/images/categories/eyelashes.jpg'),
  brows: require('../../../../assets/images/categories/brows.jpg'),
  makeup: require('../../../../assets/images/categories/makeup.jpg'),
};

/** Home (Main.html): logo + location, headline, search, 6 service tiles. */
export default function Home() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  // Only uses location if the customer already allowed it on Explore; never asks from Home.
  const origin = useOrigin(false);
  const place = origin.data?.fromDevice ? 'Near you' : 'New York';

  const explore = (params: { category?: string; q?: string }) =>
    router.push({ pathname: '/(customer)/(tabs)/explore', params: { category: '', q: '', ...params } });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      <View style={styles.top}>
        <Image source={require('../../../../assets/brand/logo-on-light.png')} style={styles.logo} contentFit="contain" accessibilityLabel="Hairday" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Location: ${place}`}
          accessibilityHint="Shows salons on a map"
          onPress={() => explore({})}
          style={({ pressed }) => [styles.place, pressed && { opacity: 0.85 }]}>
          <MapPin size={16} strokeWidth={1.8} color={colors.ink} />
          <AppText variant="small" style={styles.medium}>
            {place}
          </AppText>
        </Pressable>
      </View>

      <View>
        <Headline text="Book your" accent="next look." size="hero" style={styles.hero} />
        <AppText color="muted" style={styles.lede}>
          Salons, barbers and stylists near you, booked in under a minute.
        </AppText>
      </View>

      <View style={styles.search}>
        <Search size={20} strokeWidth={1.8} color={colors.muted} />
        {/* Not tied to `value`: the box keeps its own text, so fast typing never drops letters. */}
        <TextInput
          defaultValue=""
          onChangeText={setQuery}
          placeholder="Service, salon or stylist"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Search"
          returnKeyType="search"
          autoCorrect={false}
          onSubmitEditing={() => query.trim() && explore({ q: query.trim() })}
          style={styles.searchInput}
          maxFontSizeMultiplier={2}
        />
      </View>

      <View style={styles.sectionHead}>
        <AppText style={styles.h2} accessibilityRole="header">
          Services
        </AppText>
        <Pressable accessibilityRole="link" onPress={() => explore({})} hitSlop={10} style={styles.seeAll}>
          <AppText variant="small" style={styles.medium}>
            See all
          </AppText>
        </Pressable>
      </View>

      <View style={styles.tiles}>
        {HOME_TILES.map((slug, i) => (
          <Tile
            key={slug}
            name={categoryName(slug)}
            photo={TILE_PHOTOS[slug]}
            tone={TILE_COLORS[i] ?? 'placeholder'}
            onPress={() => explore({ category: slug })}
          />
        ))}
      </View>
      <NextAppointment />
      <PopularNearYou origin={origin.data?.point ?? null} />
      <OwnerBanner />
    </ScrollView>
  );
}

/** "Popular near you": the best-rated salons, swiped sideways. Hidden while loading or when there are none. */
function PopularNearYou({ origin }: { origin: LatLng | null }) {
  const listings = useListings();
  const salons = useMemo(
    () => search(listings.data ?? [], { ...DEFAULT_FILTERS, sort: 'top' }, origin).slice(0, 8),
    [listings.data, origin],
  );
  if (!salons.length) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <AppText style={styles.h2} accessibilityRole="header">
          Popular near you
        </AppText>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/(customer)/(tabs)/explore', params: { category: '', q: '' } })}
          hitSlop={10}
          style={styles.seeAll}>
          <AppText variant="small" style={styles.medium}>
            See all
          </AppText>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel} style={styles.bleed}>
        {salons.map((s) => (
          <PopularCard key={s.business.id} salon={s} />
        ))}
      </ScrollView>
    </View>
  );
}

function PopularCard({ salon }: { salon: SalonResult }) {
  const press = usePressScale({}, 0.97);
  const b = salon.business;
  const photo = salon.photos[0]?.url;
  const meta = [salon.rating !== null ? `${salon.rating.toFixed(1)} (${salon.reviewCount})` : 'New', salon.distance !== null ? formatMiles(salon.distance) : null]
    .filter(Boolean)
    .join(' · ');
  const price = salon.fromPriceCents !== null ? `From ${formatPrice(salon.fromPriceCents)}` : null;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={[b.name, salon.rating !== null ? `Rated ${salon.rating.toFixed(1)}` : 'New on Hairday', salon.distance !== null ? formatMiles(salon.distance) : null, price]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint="Opens the salon page"
      onPress={() => router.push({ pathname: '/salon/[id]', params: { id: b.id } })}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[styles.popCard, press.style]}>
      <View style={styles.popPhoto}>
        {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessible={false} /> : null}
      </View>
      <View style={styles.popText}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {b.name}
        </AppText>
        <View style={styles.popMeta}>
          {salon.rating !== null ? <Star size={13} color={colors.star} fill={colors.star} strokeWidth={0} /> : null}
          <AppText variant="caption" color="muted" numberOfLines={1} style={styles.flexShrink}>
            {meta}
          </AppText>
        </View>
        {price ? (
          <AppText variant="caption" style={styles.medium}>
            {price}
          </AppText>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

/** "Own a salon?" banner: brings salon owners to sign-up. Hidden once someone is using Business mode. */
function OwnerBanner() {
  const { mode } = useSession();
  const press = usePressScale({}, 0.98);
  if (mode === 'business') return null;
  return (
    <View style={styles.owner}>
      <AppText style={styles.ownerTitle} color="onDark">
        Own a salon?
      </AppText>
      <AppText variant="small" color="onDarkMuted">
        List your business on Hairday and let clients book you any time.
      </AppText>
      <AnimatedPressable
        accessibilityRole="button"
        onPress={() =>
          isSupabaseConfigured ? router.push({ pathname: '/(auth)/email', params: { intent: 'business' } }) : router.push('/(business)/setup')
        }
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[styles.ownerBtn, press.style]}>
        <AppText variant="button" color="onGold">
          List your business
        </AppText>
      </AnimatedPressable>
    </View>
  );
}

/** A service tile on Home (Main.html): category photo, tan while it loads, and its name. */
function Tile({ name, photo, tone, onPress }: { name: string; photo: number; tone: ColorName; onPress: () => void }) {
  const press = usePressScale({}, 0.96);
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`${name} salons`}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[styles.tile, press.style]}>
      <View style={[styles.tilePhoto, { backgroundColor: colors[tone] }]}>
        {/* Decorative: the tile's label already names the category for screen readers. */}
        <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessible={false} />
      </View>
      <AppText variant="caption" style={styles.medium}>
        {name}
      </AppText>
    </AnimatedPressable>
  );
}

/** "Your next appointment" card (Main.html): only when the customer has an upcoming booking. */
function NextAppointment() {
  const q = useMyBookings();
  const [now, setNow] = useState(() => Date.now());
  const { refetch } = q;
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      refetch();
    }, [refetch]),
  );

  const press = usePressScale({}, 0.98);
  const next = (q.data ?? [])
    .filter((x) => x.booking.status === 'confirmed' && new Date(x.booking.ends_at).getTime() > now)
    .sort((a, b) => a.booking.starts_at.localeCompare(b.booking.starts_at))[0];
  if (!next) return null;

  const tz = next.business?.time_zone ?? 'America/New_York';
  const d = new Date(next.booking.starts_at);
  const month = d.toLocaleDateString('en-US', { timeZone: tz, month: 'short' }).toUpperCase();
  const day = d.toLocaleDateString('en-US', { timeZone: tz, day: 'numeric' });
  const weekday = d.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' });
  const time = d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
  const what = [next.services.join(', '), next.business?.name].filter(Boolean).join(' · ');
  const when = `${weekday}, ${time}${next.pro?.first_name ? ` with ${next.pro.first_name}` : ''}`;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`Your next appointment: ${what}, ${when}`}
      accessibilityHint="Opens My bookings"
      onPress={() => router.push('/(customer)/(tabs)/bookings')}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[styles.next, press.style]}>
      <View style={styles.date}>
        <AppText style={styles.month} color="onGold" maxFontSizeMultiplier={1.2}>
          {month}
        </AppText>
        <AppText style={styles.day} color="onGold" maxFontSizeMultiplier={1.2}>
          {day}
        </AppText>
      </View>
      <View style={styles.nextText}>
        <AppText variant="label" color="onDarkMuted">
          Your next appointment
        </AppText>
        <AppText variant="bodyStrong" color="onDark" numberOfLines={2}>
          {what}
        </AppText>
        <AppText variant="caption" color="onDarkMuted">
          {when}
        </AppText>
      </View>
      <ChevronRight size={20} strokeWidth={1.8} color={colors.onDark} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.screen, paddingBottom: space.xxl * 2, gap: space.xl },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: 100, height: 55, marginLeft: -8 },
  place: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  medium: { fontFamily: fonts.medium },
  hero: { fontSize: 44, lineHeight: 45 },
  lede: { marginTop: 10, lineHeight: 22 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: space.l,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
  },
  searchInput: { ...type.body, flex: 1, color: colors.ink, paddingVertical: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  h2: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  seeAll: { minHeight: 32, justifyContent: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, rowGap: space.m },
  tile: { width: '33.333%', paddingHorizontal: 6, gap: space.s },
  tilePhoto: { height: 84, borderRadius: radius.card, overflow: 'hidden' },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.ink,
    borderRadius: radius.bigCard,
    paddingVertical: 14,
    paddingHorizontal: space.l,
  },
  date: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  month: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 15, letterSpacing: 1 },
  day: { fontFamily: fonts.display, fontSize: 24, lineHeight: 26 },
  nextText: { flex: 1, gap: 2 },
  section: { gap: space.m },
  bleed: { marginHorizontal: -space.screen },
  carousel: { paddingHorizontal: space.screen, gap: space.m },
  popCard: {
    width: 220,
    backgroundColor: colors.surface,
    borderRadius: radius.bigCard,
    borderWidth: 1,
    borderColor: colors.cardLine,
    overflow: 'hidden',
  },
  popPhoto: { height: 130, backgroundColor: colors.placeholder },
  popText: { padding: space.m, gap: 3 },
  popMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flexShrink: { flexShrink: 1 },
  owner: { backgroundColor: colors.ink, borderRadius: radius.bigCard, padding: space.xl, gap: space.s },
  ownerTitle: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
  ownerBtn: {
    marginTop: space.s,
    alignSelf: 'flex-start',
    minHeight: 48,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    justifyContent: 'center',
  },
});
