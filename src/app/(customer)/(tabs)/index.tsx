import { Image } from 'expo-image';
import { router } from 'expo-router';
import { MapPin, Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Headline } from '@/components';
import { useOrigin } from '@/hooks/useDiscovery';
import { categoryName, HOME_TILES } from '@/lib/discovery';
import { colors, fonts, radius, space, type, type ColorName } from '@/theme';

const TILE_COLORS: ColorName[] = ['tile1', 'tile2', 'tile3', 'tile4', 'tile5', 'tile6'];

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
          <Pressable
            key={slug}
            accessibilityRole="button"
            accessibilityLabel={`${categoryName(slug)} salons`}
            onPress={() => explore({ category: slug })}
            style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}>
            <View style={[styles.tilePhoto, { backgroundColor: colors[TILE_COLORS[i] ?? 'placeholder'] }]} />
            <AppText variant="caption" style={styles.medium}>
              {categoryName(slug)}
            </AppText>
          </Pressable>
        ))}
      </View>
      {/* "Your next appointment" appears here once bookings exist (Phase 4). */}
    </ScrollView>
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
  tilePhoto: { height: 84, borderRadius: radius.card },
});
