import { Text, type TextProps } from 'react-native';

import { colors, type ColorName, type, type TypeName } from '@/theme';

export type AppTextProps = TextProps & {
  variant?: TypeName;
  color?: ColorName;
};

/** All text in the app goes through this, so fonts and colors always come from the theme. */
export function AppText({ variant = 'body', color = 'ink', style, ...rest }: AppTextProps) {
  return <Text maxFontSizeMultiplier={maxScale[variant]} {...rest} style={[type[variant], { color: colors[color] }, style]} />;
}

/**
 * How far each style may grow with the phone's text-size setting. Body text can double; the big
 * serif headings are already large, so they stop at 1.4x to keep words from breaking mid-word.
 */
const maxScale: Record<TypeName, number> = {
  hero: 1.4,
  title: 1.4,
  cardTitle: 1.4,
  digit: 1.6,
  body: 2,
  bodyStrong: 2,
  small: 2,
  smallStrong: 2,
  caption: 2,
  label: 2,
  button: 2,
};
