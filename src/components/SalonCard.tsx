import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatMiles } from '@/lib/geo';
import { openStatus } from '@/lib/hours';
import { formatPrice } from '@/lib/money';
import type { SalonResult } from '@/lib/discovery';
import { colors, fonts, radius, space } from '@/theme';

import { AppText } from './AppText';

type Props = {
  salon: SalonResult;
  /** "Haircut from $30" — the service word in front of "from". */
  priceLabel?: string;
  /** Outlined in gold when its map pin is tapped. */
  highlighted?: boolean;
  now?: Date;
  onPress: () => void;
};

/** Search result card (Results.html): 3 photos, name, rating · distance · open-until, from-price and Book. */
export function SalonCard({ salon, priceLabel, highlighted, now = new Date(), onPress }: Props) {
  const b = salon.business;
  const status = openStatus(salon.hours, now, b.time_zone);
  const meta = [salon.distance !== null ? formatMiles(salon.distance) : null, status.label].filter(Boolean).join(' · ');
  const photos = [0, 1, 2].map((i) => salon.photos[i]?.url ?? null);
  const price = salon.fromPriceCents !== null ? formatPrice(salon.fromPriceCents) : null;
  const rating = salon.rating === null ? 'New on Hairday' : `Rated ${salon.rating.toFixed(1)}, ${salon.reviewCount} reviews`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[b.name, rating, meta, price && `${priceLabel ? `${priceLabel} from` : 'From'} ${price}`].filter(Boolean).join(', ')}
      accessibilityHint="Opens the salon page"
      onPress={onPress}
      style={({ pressed }) => [styles.card, highlighted && styles.highlighted, pressed && { opacity: 0.92 }]}>
      <View style={styles.photos}>
        {photos.map((uri, i) => (
          <View key={i} style={styles.photo}>
            {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
          </View>
        ))}
      </View>
      <View style={styles.text}>
        <AppText style={styles.name} numberOfLines={2}>
          {b.name}
        </AppText>
        <View style={styles.metaRow}>
          {salon.rating !== null ? (
            <AppText variant="caption" color="muted" style={styles.flexShrink}>
              <AppText variant="caption" color="star">
                ★{' '}
              </AppText>
              <AppText variant="caption" style={styles.bold}>
                {salon.rating.toFixed(1)}
              </AppText>{' '}
              ({salon.reviewCount}) · {meta}
            </AppText>
          ) : (
            <AppText variant="caption" color="muted">
              New on Hairday · {meta}
            </AppText>
          )}
        </View>
      </View>
      <View style={styles.bottom}>
        <AppText variant="small" style={styles.flexShrink}>
          {price ? (
            <>
              {priceLabel ? `${priceLabel} from` : 'From'}{' '}
              <AppText variant="small" style={styles.bold}>
                {price}
              </AppText>
            </>
          ) : null}
        </AppText>
        <View style={styles.book} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <AppText variant="smallStrong" color="white">
            Book
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.bigCard,
    padding: space.m,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.cardLine,
  },
  highlighted: { borderColor: colors.gold, borderWidth: 1.5, padding: space.m - 0.5 },
  photos: { flexDirection: 'row', gap: 6 },
  photo: { flex: 1, height: 88, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.placeholder },
  text: { gap: 3, paddingHorizontal: space.xs },
  name: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  flexShrink: { flexShrink: 1 },
  bold: { fontFamily: fonts.semibold },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.m, paddingHorizontal: space.xs },
  book: {
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minHeight: 40,
    justifyContent: 'center',
  },
});
