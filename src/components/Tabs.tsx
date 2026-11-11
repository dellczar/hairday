import { Pressable, StyleSheet, View } from 'react-native';

import { colors, fonts, touch } from '@/theme';

import { AppText } from './AppText';

type Props<K extends string> = {
  tabs: readonly { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
};

/** Underlined text tabs (Salon.html: Services / Team / Reviews / About). */
export function Tabs<K extends string>({ tabs, value, onChange }: Props<K>) {
  return (
    <View accessibilityRole="tablist" style={styles.row}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 22, borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: { minHeight: touch, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabOn: { borderBottomColor: colors.ink },
});
