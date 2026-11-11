import { Tabs } from 'expo-router';
import { CalendarDays, House, Search, UserRound } from 'lucide-react-native';

import { colors, fonts } from '@/theme';

// Tab bar from Main.html: Home / Explore / Bookings / Profile on white, navy active, muted inactive.
export default function CustomerTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.lineSoft },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <House color={color} size={24} strokeWidth={1.8} /> }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: ({ color }) => <Search color={color} size={24} strokeWidth={1.8} /> }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings', tabBarIcon: ({ color }) => <CalendarDays color={color} size={24} strokeWidth={1.8} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <UserRound color={color} size={24} strokeWidth={1.8} /> }} />
    </Tabs>
  );
}
