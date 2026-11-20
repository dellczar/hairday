import { Text, type ColorValue } from 'react-native';

import { fonts } from '@/theme';

/**
 * Tab bar label. It grows with the phone's text size but stops at 1.3x, so the four names
 * ("Bookings", "Business") still fit on a small 360-wide Android at the largest text setting,
 * the way the system tab bars behave. Screen readers read the full name either way.
 */
export function tabLabel({ color, children }: { color: ColorValue; children: string }) {
  return (
    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color }} numberOfLines={1} maxFontSizeMultiplier={1.3}>
      {children}
    </Text>
  );
}
