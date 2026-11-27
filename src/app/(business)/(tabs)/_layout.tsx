import { Redirect, Tabs } from 'expo-router';
import { CalendarDays, Clock, Store, Users } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';

import { useMyBusiness } from '@/hooks/useOwner';
import { tabLabel, useTabBarStyle } from '@/components';
import { colors } from '@/theme';

// Business tab bar (BizProfile.html): Today / Hours / Clients / Business.
export default function BusinessTabs() {
  const business = useMyBusiness();
  // Hooks run before the early returns below.
  const tabBarStyle = useTabBarStyle(colors.line);
  if (business.isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.muted} />
      </View>
    );
  }
  // No business yet → finish "Set up business" first.
  if (!business.data) return <Redirect href="/(business)/setup" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle,
        tabBarLabel: tabLabel,
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color }) => <CalendarDays color={color} size={22} strokeWidth={1.8} /> }} />
      <Tabs.Screen name="hours" options={{ title: 'Hours', tabBarIcon: ({ color }) => <Clock color={color} size={22} strokeWidth={1.8} /> }} />
      <Tabs.Screen name="clients" options={{ title: 'Clients', tabBarIcon: ({ color }) => <Users color={color} size={22} strokeWidth={1.8} /> }} />
      <Tabs.Screen name="business" options={{ title: 'Business', tabBarIcon: ({ color }) => <Store color={color} size={22} strokeWidth={1.8} /> }} />
    </Tabs>
  );
}
