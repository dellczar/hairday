import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { colors } from '@/theme';

import { IconButton } from './IconButton';

export function BackButton({ onPress }: { onPress?: () => void }) {
  return (
    <IconButton accessibilityLabel="Back" onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}>
      <ChevronLeft size={22} strokeWidth={1.8} color={colors.ink} />
    </IconButton>
  );
}
