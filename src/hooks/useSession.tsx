import type { Session } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

type SessionState = {
  session: Session | null;
  /** True until the stored session has been read from the phone. */
  loading: boolean;
  /** Visitor tapped "Skip" — browse without an account (asked to sign in at checkout). */
  guest: boolean;
  setGuest: (guest: boolean) => void;
  /** Which side of the app is showing. Owners switch from Profile ("Switch to Business") and back. */
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  signOut: () => Promise<void>;
};

export type AppMode = 'customer' | 'business';
const MODE_KEY = 'hairday.mode';

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [guest, setGuest] = useState(false);
  const [mode, setModeState] = useState<AppMode>('customer');
  const [modeLoaded, setModeLoaded] = useState(false);

  // Remember the last mode, so an owner reopening the app lands back in Business mode.
  useEffect(() => {
    SecureStore.getItemAsync(MODE_KEY)
      .then((m) => m === 'business' && setModeState('business'))
      .catch(() => {})
      .finally(() => setModeLoaded(true));
  }, []);
  const setMode = (m: AppMode) => {
    setModeState(m);
    SecureStore.setItemAsync(MODE_KEY, m).catch(() => {});
  };

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setLoading(false));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    setGuest(false);
    setMode('customer');
    if (isSupabaseConfigured) await getSupabase().auth.signOut();
    setSession(null);
  };

  return (
    <SessionContext.Provider value={{ session, loading: loading || !modeLoaded, guest, setGuest, mode, setMode, signOut }}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
