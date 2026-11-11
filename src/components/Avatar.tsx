import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colors, fonts } from '@/theme';

import { AppText } from './AppText';

type Props = { name: string; uri?: string | null; size?: number };

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

/** Photo, or navy circle with gold initials (Main.html "DC"). */
export function Avatar({ name, uri, size = 48 }: Props) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[box, { backgroundColor: colors.placeholder }]}
        accessibilityLabel={name}
        contentFit="cover"
      />
    );
  }
  return (
    <View style={[styles.circle, box]} accessibilityLabel={name} accessible>
      <AppText style={{ fontFamily: fonts.semibold, fontSize: size * 0.36, color: colors.gold }}>{initials(name)}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
