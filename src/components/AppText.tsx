import { Text, type TextProps } from 'react-native';

import { colors, type ColorName, type, type TypeName } from '@/theme';

export type AppTextProps = TextProps & {
  variant?: TypeName;
  color?: ColorName;
};

/** All text in the app goes through this, so fonts and colors always come from the theme. */
export function AppText({ variant = 'body', color = 'ink', style, ...rest }: AppTextProps) {
  return <Text {...rest} style={[type[variant], { color: colors[color] }, style]} />;
}
