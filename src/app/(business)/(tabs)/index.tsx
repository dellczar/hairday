import { router } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';

import { Button } from '@/components';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { colors } from '@/theme';

// Phase 6: stats, staff chips and the day timeline (design/screens/OwnerToday.html).
export default function Today() {
  return (
    <PlaceholderScreen
      text="Your"
      accent="day."
      icon={<CalendarDays color={colors.goldText} size={28} strokeWidth={1.8} />}
      title="No appointments yet"
      body="Once clients can book you, today’s appointments and open gaps show up here.">
      <Button title="Set up your business profile" variant="secondary" onPress={() => router.navigate('/(business)/(tabs)/business')} />
    </PlaceholderScreen>
  );
}
