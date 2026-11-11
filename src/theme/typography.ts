import type { TextStyle } from 'react-native';

// Font family names as registered by useFonts in src/app/_layout.tsx.
export const fonts = {
  display: 'InstrumentSerif_400Regular',
  displayItalic: 'InstrumentSerif_400Regular_Italic',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
} as const;

// Type scale (docs/SPEC.md §5). Labels never go below 12.
export const type = {
  hero: { fontFamily: fonts.display, fontSize: 42, lineHeight: 43, letterSpacing: -1 },
  title: { fontFamily: fonts.display, fontSize: 40, lineHeight: 41, letterSpacing: -1 },
  cardTitle: { fontFamily: fonts.display, fontSize: 26, lineHeight: 28, letterSpacing: -0.5 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  smallStrong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  label: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  button: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  digit: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 30 },
} as const satisfies Record<string, TextStyle>;

export type TypeName = keyof typeof type;
