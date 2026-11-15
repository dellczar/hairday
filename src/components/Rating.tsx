import { Star } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors, fonts, type TypeName } from '@/theme';

import { AppText } from './AppText';

type Props = {
  rating: number | null;
  count: number;
  /** Extra text after the count, e.g. "· 0.4 mi · Open until 8 PM". */
  after?: string;
  /** Write "reviews" after the number (Salon.html) instead of just "(79)". */
  long?: boolean;
  variant?: TypeName;
};

/** ★ 5.0 (79) · … — filled gold star, bold rating, muted rest (Results.html). */
export function Rating({ rating, count, after, long, variant = 'caption' }: Props) {
  const countText = long ? `(${count} ${count === 1 ? 'review' : 'reviews'})` : `(${count})`;
  const spoken = rating === null ? 'No reviews yet' : `Rated ${rating.toFixed(1)} out of 5, ${count} ${count === 1 ? 'review' : 'reviews'}`;
  return (
    <View style={styles.row} accessible accessibilityLabel={[spoken, after?.replace(/^·\s*/, '')].filter(Boolean).join(', ')}>
      {rating === null ? (
        <AppText variant={variant} color="muted">
          New on Hairday{after ? ` ${after}` : ''}
        </AppText>
      ) : (
        <>
          <Star size={14} color={colors.star} fill={colors.star} strokeWidth={0} />
          <AppText variant={variant} color="muted" style={styles.text}>
            <AppText variant={variant} style={styles.bold}>
              {rating.toFixed(1)}
            </AppText>{' '}
            {countText}
            {after ? ` ${after}` : ''}
          </AppText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  text: { flexShrink: 1 },
  bold: { fontFamily: fonts.semibold },
});
