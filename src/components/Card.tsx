import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, space } from '@/theme';

type Props = ViewProps & { tone?: 'light' | 'dark' | 'tint'; big?: boolean };

export function Card({ tone = 'light', big = false, style, ...rest }: Props) {
  return (
    <View
      {...rest}
      style={[
        styles.base,
        { borderRadius: big ? radius.bigCard : radius.card },
        tone === 'light' && styles.light,
        tone === 'dark' && styles.dark,
        tone === 'tint' && styles.tint,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { padding: space.l },
  light: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardLine },
  dark: { backgroundColor: colors.ink },
  tint: { backgroundColor: colors.tint },
});
