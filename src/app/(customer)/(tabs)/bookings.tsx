import { CalendarDays } from 'lucide-react-native';

import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { colors } from '@/theme';

// Phase 7: Upcoming / Past bookings (design/screens/MyBookings.html).
export default function Bookings() {
  return (
    <PlaceholderScreen
      text="My"
      accent="bookings."
      icon={<CalendarDays color={colors.goldText} size={28} strokeWidth={1.8} />}
      title="No bookings yet"
      body="When you book a salon, your appointments will show up here."
    />
  );
}
