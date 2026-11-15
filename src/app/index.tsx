import { Redirect } from 'expo-router';

import { useSession } from '@/hooks/useSession';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * Entry point. Owners who were last in Business mode go back there; signed-in users and
 * guests go to Home; everyone else to Welcome.
 */
export default function Index() {
  const { session, guest, loading, mode } = useSession();
  if (loading) return null;
  if (mode === 'business' && (session || !isSupabaseConfigured)) return <Redirect href="/(business)/(tabs)/business" />;
  return <Redirect href={session || guest ? '/(customer)/(tabs)' : '/(auth)/welcome'} />;
}
