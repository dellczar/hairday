import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space } from '@/theme';

import { EmptyState } from './EmptyState';
import { Headline } from './Headline';

type Props = { text: string; accent: string; title: string; body: string; icon?: ReactNode; children?: ReactNode };

/** Temporary screen for tabs that are built in later phases. */
export function PlaceholderScreen({ text, accent, title, body, icon, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxl }]}>
      <Headline text={text} accent={accent} breakBefore />
      <EmptyState icon={icon} title={title} body={body} />
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.screen, paddingBottom: space.xxl, gap: space.l },
});
