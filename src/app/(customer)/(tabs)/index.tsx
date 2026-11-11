import { Scissors } from 'lucide-react-native';

import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { colors } from '@/theme';

// Phase 3 builds the real Home screen (design/screens/Main.html).
export default function Home() {
  return (
    <PlaceholderScreen
      text="Book your"
      accent="next look."
      icon={<Scissors color={colors.goldText} size={28} strokeWidth={1.8} />}
      title="Salons are on their way"
      body="Search, service tiles and your next appointment will show up here."
    />
  );
}
