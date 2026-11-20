import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { colors, fonts, touch } from '@/theme';

import { AppText } from './AppText';

type Props<K extends string> = {
  tabs: readonly { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
};

/**
 * Underlined text tabs (Salon.html: Services / Team / Reviews / About). With large text the row
 * scrolls sideways instead of pushing the last tabs off the screen.
 */
export function Tabs<K extends string>({ tabs, value, onChange }: Props<K>) {
  return (
    <View>
      {/* The grey line sits under the tabs so the selected tab's underline covers it (Salon.html). */}
      <View style={styles.line} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={styles.row}>
        {tabs.map((t) => {
          const on = t.key === value;
          return (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(t.key)}
              style={[styles.tab, on && styles.tabOn]}>
              <AppText color={on ? 'ink' : 'muted'} style={{ fontFamily: on ? fonts.semibold : fonts.medium }}>
                {t.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, backgroundColor: colors.line },
  row: { flexDirection: 'row', gap: 22 },
  tab: { minHeight: touch, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.ink },
});
