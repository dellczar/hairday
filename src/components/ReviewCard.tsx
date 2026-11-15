import { StyleSheet, View } from 'react-native';

import type { PublicReview } from '@/lib/types';
import { colors, fonts, radius, space } from '@/theme';

import { AppText } from './AppText';

/** "2 weeks ago", "3 days ago", "Today". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} ${Math.floor(days / 7) === 1 ? 'week' : 'weeks'} ago`;
  if (days < 365) return `${Math.floor(days / 30)} ${Math.floor(days / 30) === 1 ? 'month' : 'months'} ago`;
  return `${Math.floor(days / 365)} ${Math.floor(days / 365) === 1 ? 'year' : 'years'} ago`;
}

/** One review (Pro.html Reviews tab): "Dana T. · 5 stars", when, text, tag chips. */
export function ReviewCard({ review, proName }: { review: PublicReview; proName?: string }) {
  const stars = `${review.rating} ${review.rating === 1 ? 'star' : 'stars'}`;
  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={[
        `${review.reviewer_name}, ${stars}`,
        timeAgo(review.created_at),
        proName && `with ${proName}`,
        review.body,
        review.tags.join(', '),
      ]
        .filter(Boolean)
        .join('. ')}>
      <View style={styles.head}>
        <AppText variant="caption" style={styles.bold}>
          {review.reviewer_name} · {stars}
        </AppText>
        <AppText variant="caption" color="muted">
          {timeAgo(review.created_at)}
        </AppText>
      </View>
      {proName ? (
        <AppText variant="caption" color="muted">
          with {proName}
        </AppText>
      ) : null}
      {review.body ? <AppText variant="small">{review.body}</AppText> : null}
      {review.tags.length ? (
        <View style={styles.tags}>
          {review.tags.map((t) => (
            <View key={t} style={styles.tag}>
              <AppText variant="label">{t}</AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardLine, borderRadius: radius.card, padding: 14, gap: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s, flexWrap: 'wrap' },
  bold: { fontFamily: fonts.semibold },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: colors.tint, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
});
