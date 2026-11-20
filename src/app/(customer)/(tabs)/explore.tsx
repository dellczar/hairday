import { router, useLocalSearchParams } from 'expo-router';
import { SearchX, SlidersHorizontal } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BackButton, EmptyState, FiltersSheet, IconButton, SalonCard, SalonCardSkeleton, SalonMap, Skeleton, type MapPin } from '@/components';
import { useListings, useOrigin } from '@/hooks/useDiscovery';
import {
  activeFilterCount,
  categoryName,
  DEFAULT_FILTERS,
  resultsTitle,
  search,
  SORT_LABELS,
  whenLabel,
  type SearchFilters,
  type SortKey,
} from '@/lib/discovery';
import { formatDay } from '@/lib/hours';
import { formatPrice } from '@/lib/money';
import { colors, fonts, space } from '@/theme';

const SORT_FIRST: Record<SortKey, string> = { nearest: 'Nearest first', top: 'Top rated first', price: 'Lowest price first' };

/** Search results (Results.html): map with price pins + salon cards, Filters sheet (Filters.html). */
export default function Explore() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; q?: string }>();
  const paramKey = `${params.category ?? ''}|${params.q ?? ''}`;
  const fromParams = (): SearchFilters => ({ ...DEFAULT_FILTERS, categories: params.category ? [params.category] : [], query: params.q ?? '' });

  // Coming from a Home tile or the search box replaces the filters; otherwise they stay as set.
  const [state, setState] = useState(() => ({ key: paramKey, filters: fromParams() }));
  if (state.key !== paramKey) setState({ key: paramKey, filters: fromParams() });
  const filters = state.filters;
  const setFilters = (f: SearchFilters) => setState({ key: paramKey, filters: f });

  const listings = useListings();
  const origin = useOrigin(true); // first visit to Explore asks for location (SPEC §12)
  const [now] = useState(() => new Date());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const point = origin.data?.point ?? null;
  const results = useMemo(() => search(listings.data ?? [], filters, point, now), [listings.data, filters, point, now]);
  const pins: MapPin[] = results
    .filter((r) => r.business.lat !== null && r.business.lng !== null)
    .map((r) => ({
      id: r.business.id,
      name: r.business.name,
      point: { lat: r.business.lat!, lng: r.business.lng! },
      label: r.fromPriceCents !== null ? formatPrice(r.fromPriceCents) : '',
    }));

  const scroller = useRef<ScrollViewInstance>(null);
  const cardY = useRef<Record<string, number>>({});
  const listTop = useRef(0);
  const selectPin = (id: string) => {
    setSelected(id);
    const y = cardY.current[id];
    if (y !== undefined) scroller.current?.scrollTo({ y: listTop.current + y - space.m, animated: true });
  };

  const priceLabel = filters.categories.length === 1 ? categoryName(filters.categories[0]!) : undefined;
  const place = origin.data?.fromDevice ? 'Near you' : 'New York';
  const subtitle = `${place} · ${whenLabel(filters.when, formatDay)}`;
  const badge = activeFilterCount(filters);
  const cameFromHome = !!(params.category || params.q);

  const chooseSort = () => {
    const keys = Object.keys(SORT_LABELS) as SortKey[];
    const apply = (i: number) => keys[i] && setFilters({ ...filters, sort: keys[i] });
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'Sort by', options: [...keys.map((k) => SORT_LABELS[k]), 'Cancel'], cancelButtonIndex: keys.length },
        apply,
      );
    } else {
      Alert.alert('Sort by', undefined, [
        ...keys.map((k, i) => ({ text: SORT_LABELS[k], onPress: () => apply(i) })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {cameFromHome ? (
          <BackButton
            onPress={() => {
              router.setParams({ category: '', q: '' });
              router.navigate('/(customer)/(tabs)');
            }}
          />
        ) : null}
        <View style={styles.titles}>
          <AppText style={styles.title} accessibilityRole="header" numberOfLines={1}>
            {resultsTitle(filters)}
          </AppText>
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        </View>
        <View>
          <IconButton accessibilityLabel={badge ? `Filters, ${badge} on` : 'Filters'} onPress={() => setFiltersOpen(true)}>
            <SlidersHorizontal size={20} strokeWidth={1.8} color={colors.ink} />
          </IconButton>
          {badge ? (
            <View style={styles.badge} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <AppText variant="label" color="onGold" style={styles.badgeText}>
                {badge}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView
        ref={scroller}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={listings.isRefetching} onRefresh={() => void listings.refetch()} tintColor={colors.muted} />}>
        {listings.isPending ? (
          <>
            <Skeleton height={210} rounded={20} />
            <SalonCardSkeleton />
            <SalonCardSkeleton />
          </>
        ) : listings.isError ? (
          <EmptyState
            icon={<SearchX size={28} strokeWidth={1.8} color={colors.goldText} />}
            title="Couldn’t load salons"
            body="Check your connection and try again."
            actionLabel="Try again"
            onAction={() => void listings.refetch()}
          />
        ) : results.length === 0 ? (
          <EmptyState
            icon={<SearchX size={28} strokeWidth={1.8} color={colors.goldText} />}
            title="No salons match"
            body={
              filters.categories.length
                ? `No salons near you offer ${resultsTitle(filters).toLowerCase()} yet. Try another service or clear your filters.`
                : 'Try fewer filters or a different search.'
            }
            actionLabel="Clear filters"
            onAction={() => setFilters({ ...DEFAULT_FILTERS })}
          />
        ) : (
          <>
            <SalonMap pins={pins} selectedId={selected} onSelect={selectPin} me={origin.data?.fromDevice ? point : null} />
            <View style={styles.listHead}>
              <AppText variant="small" color="muted" style={styles.flexShrink}>
                {results.length} {results.length === 1 ? 'salon' : 'salons'} · {SORT_FIRST[filters.sort]}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Sort, ${SORT_LABELS[filters.sort]}`}
                onPress={chooseSort}
                style={styles.sort}
                hitSlop={6}>
                <AppText variant="small" style={styles.medium}>
                  Sort
                </AppText>
              </Pressable>
            </View>
            <View style={styles.list} onLayout={(e) => (listTop.current = e.nativeEvent.layout.y)}>
              {results.map((r) => (
                <View key={r.business.id} onLayout={(e) => (cardY.current[r.business.id] = e.nativeEvent.layout.y)}>
                  <SalonCard
                    salon={r}
                    priceLabel={priceLabel}
                    highlighted={r.business.id === selected}
                    now={now}
                    onPress={() =>
                      router.push({
                        pathname: '/salon/[id]',
                        params: { id: r.business.id, category: filters.categories.length === 1 ? filters.categories[0] : '' },
                      })
                    }
                  />
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <FiltersSheet
        visible={filtersOpen}
        value={filters}
        onClose={() => setFiltersOpen(false)}
        countFor={(f) => search(listings.data ?? [], f, point, now).length}
        onApply={(f) => {
          setFilters(f);
          setSelected(null);
          setFiltersOpen(false);
          scroller.current?.scrollTo({ y: 0, animated: false });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.screen, paddingBottom: space.m },
  titles: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 14 },
  content: { paddingHorizontal: space.screen, paddingBottom: space.xxl * 2, gap: space.l },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.m, marginBottom: -space.xs },
  sort: { minHeight: 32, justifyContent: 'center' },
  medium: { fontFamily: fonts.medium },
  flexShrink: { flexShrink: 1 },
  list: { gap: space.m },
});
