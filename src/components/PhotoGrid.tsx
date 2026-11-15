import { Image } from 'expo-image';
import { Plus } from 'lucide-react-native';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

type Props = {
  photos: { id: string; url: string }[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  adding?: boolean;
  addLabel: string;
  /** What each photo is, for screen readers ("Salon photo"). */
  photoLabel: string;
};

/** 4-across row of photos with a dashed "+" tile (BizProfile.html, Team.html). Tap a photo to remove it. */
export function PhotoGrid({ photos, onAdd, onRemove, adding, addLabel, photoLabel }: Props) {
  return (
    <View style={styles.grid}>
      {photos.map((p, i) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={`${photoLabel} ${i + 1}`}
          accessibilityHint="Double-tap to remove"
          onPress={() =>
            Alert.alert('Remove this photo?', undefined, [
              { text: 'Keep', style: 'cancel' },
              { text: 'Remove', style: 'destructive', onPress: () => onRemove(p.id) },
            ])
          }
          style={styles.cell}>
          <Image source={{ uri: p.url }} style={styles.photo} contentFit="cover" transition={150} />
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel={addLabel} onPress={onAdd} disabled={adding} style={[styles.cell, styles.add]}>
        {adding ? <ActivityIndicator color={colors.muted} /> : <Plus size={20} strokeWidth={1.8} color={colors.muted} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: '23.5%', height: 76, borderRadius: 12, overflow: 'hidden' },
  photo: { width: '100%', height: '100%', backgroundColor: colors.placeholder },
  add: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.placeholder, alignItems: 'center', justifyContent: 'center' },
});
