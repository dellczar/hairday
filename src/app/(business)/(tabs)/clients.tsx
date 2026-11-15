import { Users } from 'lucide-react-native';

import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { colors } from '@/theme';

// Phase 6: search, A–Z list, add client, import from contacts (design/screens/Clients.html).
export default function Clients() {
  return (
    <PlaceholderScreen
      text="Your"
      accent="clients."
      icon={<Users color={colors.goldText} size={28} strokeWidth={1.8} />}
      title="No clients yet"
      body="Everyone who books with you is added here automatically. You’ll also be able to add clients yourself."
    />
  );
}
