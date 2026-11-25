import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';

/**
 * First-launch intro (Booksy-style): shown once per phone, and the services the visitor picked,
 * which Home uses to choose "Popular near you". Stored on the phone only.
 */
const SEEN_KEY = 'hairday.introSeen';
const INTERESTS_KEY = 'hairday.interests';
const KEY = ['intro'];

export type IntroState = { seen: boolean; interests: string[] };

async function read(): Promise<IntroState> {
  try {
    const [seen, interests] = await Promise.all([SecureStore.getItemAsync(SEEN_KEY), SecureStore.getItemAsync(INTERESTS_KEY)]);
    const parsed: unknown = interests ? JSON.parse(interests) : [];
    return { seen: seen === '1', interests: Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [] };
  } catch {
    // Can't read the phone's storage: don't block the app with the intro.
    return { seen: true, interests: [] };
  }
}

export function useIntro() {
  return useQuery({ queryKey: KEY, queryFn: read, staleTime: Infinity });
}

export function useFinishIntro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (interests: string[]) => {
      await Promise.all([
        SecureStore.setItemAsync(SEEN_KEY, '1').catch(() => {}),
        SecureStore.setItemAsync(INTERESTS_KEY, JSON.stringify(interests)).catch(() => {}),
      ]);
      return { seen: true, interests } satisfies IntroState;
    },
    onSuccess: (state) => qc.setQueryData(KEY, state),
  });
}
