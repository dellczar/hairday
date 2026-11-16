import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, Star, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Avatar, Button, Chip, EmptyState, Headline, IconButton, Input, Skeleton } from '@/components';
import { useHeldBooking, usePostReview } from '@/hooks/useBooking';
import { getDb } from '@/lib/db';
import { pickPhoto } from '@/lib/photos';
import { MAX_REVIEW_LENGTH, RATING_WORDS, REVIEW_TAGS } from '@/lib/reviews';
import { colors, fonts, radius, space } from '@/theme';

/** Leave a review (Review.html): stars with a word per level, quick tags, optional text and photo. */
export default function LeaveReview() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const insets = useSafeAreaInsets();
  const q = useHeldBooking(bookingId);
  const post = usePostReview();
  const [rating, setRating] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(customer)/(tabs)/bookings'));
  const d = q.data;
  const tz = d?.business?.time_zone ?? 'America/New_York';

  const onPost = async () => {
    if (!d) return;
    try {
      let photoUrl: string | null = null;
      if (photo) {
        setUploading(true);
        const me = await getDb().userId();
        photoUrl = await getDb().upload(`reviews/${me}`, photo);
      }
      await post.mutateAsync({ booking_id: d.booking.id, rating, tags, body: body.trim() || null, photo_url: photoUrl });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      close();
      Alert.alert('Thanks for your review', 'It helps other people find a great salon.');
    } catch (e) {
      Alert.alert('Couldn’t post it', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (q.isPending) {
    return (
      <View style={[styles.screen, styles.pad, { paddingTop: insets.top + 8, gap: space.l }]}>
        <Skeleton height={44} width={44} rounded={22} />
        <Skeleton height={220} />
      </View>
    );
  }
  if (!d || d.booking.status !== 'completed') {
    return (
      <View style={[styles.screen, styles.pad, { paddingTop: insets.top + 8 }]}>
        <IconButton accessibilityLabel="Close" onPress={close}>
          <X size={20} strokeWidth={1.8} color={colors.ink} />
        </IconButton>
        <EmptyState title="Nothing to review yet" body="You can leave a review once your visit is finished." />
      </View>
    );
  }

  const name = d.pro?.first_name ?? d.business?.name ?? 'the salon';
  const date = new Date(d.booking.starts_at).toLocaleDateString('en-US', { timeZone: tz, month: 'short', day: 'numeric' });

  return (
    <View style={styles.screen}>
      {/* The button sits at the end of the content (Review.html), so the keyboard never squeezes the form. */}
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.pad, styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        <IconButton accessibilityLabel="Close" onPress={close}>
          <X size={20} strokeWidth={1.8} color={colors.ink} />
        </IconButton>

        <View style={styles.top}>
          <Avatar name={[d.pro?.first_name, d.pro?.last_name].filter(Boolean).join(' ') || name} uri={d.pro?.avatar_url} size={72} />
          <Headline text={'How was your visit\nwith'} accent={`${name}?`} style={styles.h1} />
          <AppText variant="small" color="muted" style={styles.center}>
            {[d.items.map((i) => i.name).join(', '), date, d.business?.name].filter(Boolean).join(' · ')}
          </AppText>
        </View>

        <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              accessibilityRole="radio"
              accessibilityState={{ checked: rating === n }}
              accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}, ${RATING_WORDS[n]}`}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setRating(n);
              }}
              style={styles.star}>
              <Star
                size={38}
                strokeWidth={1.4}
                color={n <= rating ? colors.gold : colors.placeholder}
                fill={n <= rating ? colors.gold : 'transparent'}
              />
            </Pressable>
          ))}
        </View>
        <AppText style={styles.word} accessibilityLiveRegion="polite">
          {RATING_WORDS[rating]}
        </AppText>

        <View style={styles.tags}>
          {REVIEW_TAGS.map((t) => (
            <Chip
              key={t}
              label={t}
              selected={tags.includes(t)}
              onPress={() => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}
            />
          ))}
        </View>

        <Input
          label="Tell others about it (optional)"
          value={body}
          onChangeText={(t) => setBody(t.slice(0, MAX_REVIEW_LENGTH))}
          placeholder="What did you love?"
          multiline
          style={styles.body}
        />

        {photo ? (
          <View style={styles.photoRow}>
            <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" accessibilityLabel="Your photo" />
            <Pressable onPress={() => setPhoto(null)} accessibilityRole="button" style={styles.remove}>
              <AppText style={styles.link} color="goldText">
                Remove photo
              </AppText>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={async () => setPhoto(await pickPhoto({ title: 'Add a photo of your look' }))}
            accessibilityRole="button"
            style={({ pressed }) => [styles.addPhoto, pressed && styles.pressed]}>
            <Camera size={18} strokeWidth={1.8} color={colors.ink} />
            <AppText style={styles.link}>Add a photo of your look</AppText>
          </Pressable>
        )}
        <View style={styles.grow} />
        <Button title="Post review" onPress={onPost} loading={post.isPending || uploading} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: space.screen },
  content: { gap: 20, flexGrow: 1 },
  grow: { flexGrow: 1 },
  top: { alignItems: 'center', gap: 8 },
  h1: { fontSize: 34, lineHeight: 37, textAlign: 'center', marginTop: 6 },
  center: { textAlign: 'center' },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  star: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  word: { textAlign: 'center', fontFamily: fonts.semibold, fontSize: 15, marginTop: -8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, justifyContent: 'center' },
  body: { minHeight: 104, textAlignVertical: 'top', paddingTop: space.m },
  addPhoto: {
    minHeight: 48,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.placeholder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s,
  },
  link: { fontFamily: fonts.semibold, fontSize: 14 },
  pressed: { opacity: 0.7 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.l },
  photo: { width: 96, height: 96, borderRadius: radius.card, backgroundColor: colors.tile1 },
  remove: { minHeight: 44, justifyContent: 'center' },
});
