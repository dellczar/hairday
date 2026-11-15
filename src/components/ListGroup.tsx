import { ChevronRight } from 'lucide-react-native';
import { Children, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, space } from '@/theme';

import { AppText } from './AppText';

/** White rounded card holding rows separated by thin lines (BizProfile.html, Setup.html step 3). */
export function ListGroup({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[styles.group, style]}>
      {rows.map((row, i) => (
        <View key={row.key ?? i} style={i < rows.length - 1 ? styles.divider : undefined}>
          {row}
        </View>
      ))}
    </View>
  );
}

type RowProps = {
  label: string;
  sublabel?: string;
  value?: string;
  /** Gold-text value, e.g. "Finish setup". */
  valueAccent?: boolean;
  icon?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  accessibilityHint?: string;
};

/** One row: label, optional value on the right, chevron when tappable. Min height 54. */
export function ListRow({ label, sublabel, value, valueAccent, icon, right, onPress, accessibilityHint }: RowProps) {
  const body = (
    <>
      {icon}
      <View style={styles.labels}>
        <AppText>{label}</AppText>
        {sublabel ? (
          <AppText variant="caption" color="muted">
            {sublabel}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant={valueAccent ? 'smallStrong' : 'caption'} color={valueAccent ? 'goldText' : 'muted'} numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {right}
      {onPress ? <ChevronRight size={16} strokeWidth={1.8} color={colors.muted} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.cardLine, borderRadius: 18, paddingHorizontal: 14 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: 6 },
  labels: { flex: 1, gap: 2 },
  value: { maxWidth: '50%' },
});
