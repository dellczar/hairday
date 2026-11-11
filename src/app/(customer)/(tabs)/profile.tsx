import { router } from 'expo-router';
import { UserRound } from 'lucide-react-native';

import { AppText, Button } from '@/components';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { useSession } from '@/hooks/useSession';
import { colors } from '@/theme';

// Phase 2/7/8 fill this in (design/screens/Profile.html).
export default function Profile() {
  const { session, signOut } = useSession();
  const email = session?.user.email;
  return (
    <PlaceholderScreen
      text="Your"
      accent="profile."
      icon={<UserRound color={colors.goldText} size={28} strokeWidth={1.8} />}
      title={email ? 'You’re signed in' : 'Browsing as a guest'}
      body={email ? `Signed in as ${email}.` : 'Sign in to book, save favorites and manage appointments.'}>
      {email ? (
        <Button
          title="Sign out"
          variant="secondary"
          onPress={async () => {
            await signOut();
            router.replace('/(auth)/welcome');
          }}
        />
      ) : (
        <Button
          title="Sign in"
          onPress={async () => {
            await signOut(); // clears guest mode
            router.replace('/(auth)/welcome');
          }}
        />
      )}
      <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
        Favorites, payment methods, notifications and account deletion come in later phases.
      </AppText>
    </PlaceholderScreen>
  );
}
