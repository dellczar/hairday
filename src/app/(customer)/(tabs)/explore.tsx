import { MapPin } from 'lucide-react-native';

import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { colors } from '@/theme';

// Phase 3: map + salon list (design/screens/Results.html).
export default function Explore() {
  return (
    <PlaceholderScreen
      text="Explore"
      accent="nearby."
      icon={<MapPin color={colors.goldText} size={28} strokeWidth={1.8} />}
      title="The map is coming soon"
      body="You’ll be able to find salons near you on a map and in a list."
    />
  );
}
