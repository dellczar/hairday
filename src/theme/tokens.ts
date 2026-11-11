// Design tokens — the only place colors, radii and spacing are defined (docs/SPEC.md §5).
// Screens and components must read from here; never hard-code hex values elsewhere.

export const colors = {
  bg: '#F7F4EE', // ivory screen background
  surface: '#FFFFFF', // cards, inputs
  ink: '#171826', // logo navy: main text, dark buttons, dark cards (16:1 on bg)
  inkSoft: '#2B2E40', // body text inside tinted info boxes
  muted: '#5D6070', // secondary text (5.7:1 on bg)
  line: '#E5DFD5', // borders
  lineSoft: '#EFEAE2', // dividers inside cards
  cardLine: '#ECE6DC', // card borders
  tint: '#F3EADB', // chips, info boxes (warm gold tint)
  placeholder: '#CBBFB2', // photo loading blocks
  photo: '#6B5A4C', // dark photo placeholder (Welcome hero)
  gold: '#F4A942', // logo gold: highlights, selected time, main CTA
  onGold: '#171826', // ALWAYS navy on gold (8.9:1). Never white on gold.
  goldText: '#8F5A0E', // gold-coloured TEXT on light backgrounds (5.3:1)
  star: '#D58E39', // rating stars
  onDark: '#F7F4EE',
  onDarkMuted: '#AEB1C2',
  onDarkFaint: '#9A9DB0', // small print on navy (Welcome legal line)
  onDarkAccent: '#F4A942',
  onDarkLine: 'rgba(245,240,234,0.35)', // outlined buttons on navy
  onDarkLineStrong: 'rgba(245,240,234,0.4)', // Skip pill border
  onDarkFill: 'rgba(245,240,234,0.12)', // notice box on navy
  inkGlass: 'rgba(23,24,38,0.35)', // see-through navy over photos
  white: '#FFFFFF',
  danger: '#B3261E', // form errors (6.1:1 on bg)
} as const;

export const radius = {
  input: 14,
  card: 16,
  bigCard: 20,
  sheet: 28,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 24,
  screen: 20, // screen side padding
} as const;

/** Every tappable element is at least this tall/wide (pt). */
export const touch = 44;

export type ColorName = keyof typeof colors;
