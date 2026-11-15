import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, fonts, radius } from '@/theme';

import { AppText } from './AppText';

type Props = {
  label: string;
  /** Text in the middle, e.g. "45 min". */
  display: string;
  onLess: () => void;
  onMore: () => void;
  canLess: boolean;
  canMore: boolean;
  lessLabel: string;
  moreLabel: string;
};

/** − value + control (Services.html "Duration"). */
export function Stepper({ label, display, onLess, onMore, canLess, canMore, lessLabel, moreLabel }: Props) {
  const tap = (fn: () => void) => () => {
    Haptics.selectionAsync().catch(() => {});
    fn();
  };
  return (
    <View style={styles.wrap}>
      <AppText variant="smallStrong">{label}</AppText>
      <View style={styles.box} accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: display }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? canMore && onMore() : canLess && onLess())}>
        <Pressable accessibilityLabel={lessLabel} accessibilityRole="button" disabled={!canLess} onPress={tap(onLess)} style={[styles.btn, !canLess && styles.off]}>
          <AppText style={styles.sign}>−</AppText>
        </Pressable>
        <AppText variant="bodyStrong">{display}</AppText>
        <Pressable accessibilityLabel={moreLabel} accessibilityRole="button" disabled={!canMore} onPress={tap(onMore)} style={[styles.btn, !canMore && styles.off]}>
          <AppText style={styles.sign}>+</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  box: {
    height: 54,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  btn: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.4 },
  sign: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 24 },
});
