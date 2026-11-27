import { Text, useWindowDimensions, type ColorValue, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '@/theme';

/**
 * Tab bar label. It grows with the phone's text size but stops at 1.3x, so the four names
 * ("Bookings", "Business") still fit on a small 360-wide Android at the largest text setting,
 * the way the system tab bars behave. Screen readers read the full name either way.
 */
export function tabLabel({ color, children }: { color: ColorValue; children: string }) {
  return (
    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color }} numberOfLines={1} maxFontSizeMultiplier={MAX_LABEL_SCALE}>
      {children}
    </Text>
  );
}

/** Labels stop growing here (see tabLabel). */
const MAX_LABEL_SCALE = 1.3;

/**
 * Tab bar style that makes room for bigger labels. The bar's normal height (49 + the phone's bottom
 * inset) only fits 12 pt labels at normal text size; at large text the bottom of "Home" or "Bookings"
 * was cut off by the phone's own buttons. It adds up to 8 points as the text size grows to 1.3x.
 */
export function useTabBarStyle(borderTopColor: ColorValue): ViewStyle {
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const extra = Math.ceil((Math.min(Math.max(fontScale, 1), MAX_LABEL_SCALE) - 1) * 26);
  return { backgroundColor: colors.surface, borderTopColor, height: 49 + extra + insets.bottom, paddingTop: extra / 2 };
}
