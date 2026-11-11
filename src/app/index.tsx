import { Redirect } from 'expo-router';

import { useSession } from '@/hooks/useSession';

/** Entry point: signed-in users and guests go to Home, everyone else to Welcome. */
export default function Index() {
  const { session, guest, loading } = useSession();
  if (loading) return null;
  return <Redirect href={session || guest ? '/(customer)/(tabs)' : '/(auth)/welcome'} />;
}
