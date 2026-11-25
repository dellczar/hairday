import { Redirect } from 'expo-router';

import { useIntro } from '@/hooks/useIntro';
import { useSession } from '@/hooks/useSession';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * Entry point. Owners who were last in Business mode go back there; signed-in users and
 * guests go to Home; a first-time visitor sees the intro once; everyone else goes to Welcome.
 */
export default function Index() {
  const { session, guest, loading, mode } = useSession();
  const intro = useIntro();
  if (loading || intro.isPending) return null;
  if (mode === 'business' && (session || !isSupabaseConfigured)) return <Redirect href="/(business)/(tabs)/business" />;
  if (session || guest) return <Redirect href="/(customer)/(tabs)" />;
  return <Redirect href={intro.data?.seen ? '/(auth)/welcome' : '/intro'} />;
}
