import { router } from 'expo-router';
import { Landmark } from 'lucide-react-native';

import { Button } from '@/components';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { colors } from '@/theme';

// Phase 5: Stripe Connect onboarding, payout schedule, late-cancel setting (design/screens/Payouts.html).
export default function Payouts() {
  return (
    <PlaceholderScreen
      text="Get"
      accent="paid."
      icon={<Landmark color={colors.goldText} size={28} strokeWidth={1.8} />}
      title="Payouts come next"
      body="You’ll connect your bank through Stripe here. Your salon goes live on Hairday once payouts are set up.">
      <Button title="Back to business profile" variant="secondary" onPress={() => router.back()} />
    </PlaceholderScreen>
  );
}
