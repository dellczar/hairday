import type { Session } from '@supabase/supabase-js';

import { normalizeEmail } from './email';
import { getSupabase, isSupabaseConfigured } from './supabase';

export class AuthNotConfiguredError extends Error {
  constructor() {
    super('Sign-in isn’t connected yet. It starts working once the Supabase project is set up.');
  }
}

/** Sends a 6-digit code to the email (Supabase email OTP). Creates the account on first sign-in. */
export async function sendEmailCode(email: string): Promise<void> {
  if (!isSupabaseConfigured) throw new AuthNotConfiguredError();
  const { error } = await getSupabase().auth.signInWithOtp({
    email: normalizeEmail(email),
    options: { shouldCreateUser: true },
  });
  if (error) throw new Error(friendly(error.message));
}

export async function verifyEmailCode(email: string, code: string): Promise<Session> {
  if (!isSupabaseConfigured) throw new AuthNotConfiguredError();
  const { data, error } = await getSupabase().auth.verifyOtp({ email: normalizeEmail(email), token: code, type: 'email' });
  if (error || !data.session) throw new Error(friendly(error?.message ?? 'That code didn’t work.'));
  return data.session;
}

/**
 * Sign in with Apple (iOS). Apple only shares the name on the very first sign-in, so we save it then.
 * Returns null if the person closed the Apple sheet.
 */
export async function signInWithApple(): Promise<Session | null> {
  if (!isSupabaseConfigured) throw new AuthNotConfiguredError();
  const AppleAuthentication = await import('expo-apple-authentication');
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!cred.identityToken) throw new Error('Apple didn’t return a sign-in token. Try again.');
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken });
    if (error || !data.session) throw new Error('Apple sign-in didn’t work. Try again, or continue with email.');
    if (cred.fullName?.givenName || cred.fullName?.familyName) {
      await supabase
        .from('profiles')
        .update({ first_name: cred.fullName.givenName, last_name: cred.fullName.familyName })
        .eq('id', data.session.user.id);
    }
    return data.session;
  } catch (e) {
    if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'ERR_REQUEST_CANCELED') return null;
    throw e;
  }
}

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('expired') || m.includes('invalid')) return 'That code is wrong or has expired. Check the latest email, or send a new code.';
  if (m.includes('rate') || m.includes('seconds')) return 'Please wait a minute before asking for another code.';
  return 'Something went wrong. Check your connection and try again.';
}
