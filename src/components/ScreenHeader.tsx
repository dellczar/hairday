import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { fonts, space } from '@/theme';

import { AppText } from './AppText';
import { BackButton } from './BackButton';

/** Back button, 17 pt title and an optional action on the right (Services.html, Team.html, Availability.html). */
export function ScreenHeader({ title, right, onBack, showBack = true }: { title: string; right?: ReactNode; onBack?: () => void; showBack?: boolean }) {
  return (
    <View style={styles.row}>
      {showBack ? <BackButton onPress={onBack} /> : null}
      <AppText accessibilityRole="header" style={styles.title} numberOfLines={1}>
        {title}
      </AppText>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 44 },
  title: { flex: 1, fontSize: 17, lineHeight: 22, fontFamily: fonts.semibold },
});
