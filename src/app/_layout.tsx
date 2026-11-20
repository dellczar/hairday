import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts } from '@expo-google-fonts/inter';
import { StripeProvider } from '@stripe/stripe-react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useNotificationTaps } from '@/hooks/useNotificationTaps';
import { SessionProvider, useSession } from '@/hooks/useSession';
import { APPLE_MERCHANT_ID, STRIPE_PUBLISHABLE_KEY } from '@/lib/stripe';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const [loaded, error] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} merchantIdentifier={APPLE_MERCHANT_ID} urlScheme="hairday">
            <SessionProvider>
              <HideSplashWhenReady />
              <NotificationTaps />
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
            </SessionProvider>
          </StripeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * The logo stays up until fonts are loaded (above) and we know whether someone is signed in, so
 * there's no blank screen in between. Never longer than 5 seconds, in case the check stalls.
 */
function HideSplashWhenReady() {
  const { loading } = useSession();
  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 5000);
    return () => clearTimeout(t);
  }, [loading]);
  return null;
}

function NotificationTaps() {
  useNotificationTaps();
  return null;
}
