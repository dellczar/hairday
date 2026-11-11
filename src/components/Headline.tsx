import { Text, type TextStyle } from 'react-native';

import { colors, fonts, type } from '@/theme';

type Props = {
  /** Plain part of the headline, e.g. "Book your" */
  text: string;
  /** The one italic word(s) in gold, e.g. "next look." */
  accent: string;
  /** Put the accent on its own line (as in most designs). */
  breakBefore?: boolean;
  onDark?: boolean;
  size?: 'hero' | 'title';
  style?: TextStyle;
};

/**
 * Serif headline with one italic accent word — "Book your *next look.*"
 * Accent is goldText on light screens and gold on navy screens (SPEC §5).
 */
export function Headline({ text, accent, breakBefore = false, onDark = false, size = 'title', style }: Props) {
  return (
    <Text
      accessibilityRole="header"
      style={[type[size], { color: onDark ? colors.onDark : colors.ink }, style]}>
      {text}
      {breakBefore ? '\n' : ' '}
      <Text style={{ fontFamily: fonts.displayItalic, color: onDark ? colors.gold : colors.goldText }}>{accent}</Text>
    </Text>
  );
}
