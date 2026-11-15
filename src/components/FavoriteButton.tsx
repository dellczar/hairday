import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { Alert } from 'react-native';

import { isFavorite, useFavorites, useToggleFavorite, type FavoriteTarget } from '@/hooks/useDiscovery';
import { useSession } from '@/hooks/useSession';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors } from '@/theme';

import { IconButton } from './IconButton';

type Props = { target: FavoriteTarget; name: string; /** 'white' = no border, for use over photos (Salon.html). */ tone?: 'light' | 'white' };

/** Heart button (Salon.html, Pro.html). Guests are asked to sign in first. */
export function FavoriteButton({ target, name, tone = 'light' }: Props) {
  const { session, signOut } = useSession();
  const favorites = useFavorites();
  const toggle = useToggleFavorite();
  const on = isFavorite(favorites.data, target);
  const signedIn = !!session || !isSupabaseConfigured; // demo mode stands in for an account

  const press = () => {
    if (!signedIn) {
      Alert.alert('Sign in to save favorites', 'Your saved salons and professionals show up on your Profile.', [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Sign in',
          onPress: async () => {
            await signOut(); // leaves guest mode
            router.replace('/(auth)/welcome');
          },
        },
      ]);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    toggle.mutate(target, { onError: (e) => Alert.alert('Couldn’t save', e instanceof Error ? e.message : 'Try again.') });
  };

  return (
    <IconButton
      accessibilityLabel={on ? `Remove ${name} from favorites` : `Save ${name} to favorites`}
      accessibilityState={{ selected: on }}
      onPress={press}
      tone={tone}>
      <Heart size={20} strokeWidth={1.8} color={on ? colors.goldText : colors.ink} fill={on ? colors.gold : 'transparent'} />
    </IconButton>
  );
}
