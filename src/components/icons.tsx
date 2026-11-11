import Svg, { Path, Rect } from 'react-native-svg';

// Brand marks that lucide doesn't include. Paths copied from design/screens/Welcome.html.
type P = { size?: number; color: string };

export function AppleIcon({ size = 18, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M16.4 12.6c0-2.4 2-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.8-3.5.8s-1.8-.8-3-.8C7 7.2 5.5 8.2 4.7 9.6c-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.4 3 2.4 1.2-.1 1.6-.8 3-.8s1.8.8 3 .8c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7 0 0-2.6-1-2.7-4zM14.2 5.6c.6-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.1 1.8-1 2.8 1 .1 2.1-.5 2.8-1.3z" />
    </Svg>
  );
}

export function GoogleIcon({ size = 18, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M20.5 12.2c0-.6-.1-1.2-.2-1.7H12v3.3h4.8a4.2 4.2 0 01-1.8 2.7v2.2h2.9c1.6-1.5 2.6-3.8 2.6-6.5z" />
      <Path d="M12 21c2.4 0 4.4-.8 5.9-2.2L15 16.6c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0012 21z" />
      <Path d="M7 13.8a5.4 5.4 0 010-3.5V8H4a9 9 0 000 8.1z" />
      <Path d="M12 6.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 004 8l3 2.3c.7-2.1 2.7-3.7 5-3.7z" />
    </Svg>
  );
}

export function MailIcon({ size = 18, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round">
      <Rect x={3} y={5} width={18} height={14} rx={2} />
      <Path d="M3 7l9 6 9-6" />
    </Svg>
  );
}
