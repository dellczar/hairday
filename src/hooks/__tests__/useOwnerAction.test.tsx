import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useOwnerAction } from '../useOwner';

jest.mock('expo-secure-store', () => ({}));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: false, getSupabase: () => { throw new Error('not used'); } }));

// Regression: React Query calls mutationFn(variables, context). Our owner actions take an
// optional second `db` argument, so the context must never reach them.
test('passes only the arguments to the action', async () => {
  // gcTime Infinity: React Query then schedules no cleanup timer, so Jest exits cleanly.
  const qc = new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity }, queries: { gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const action = jest.fn(async (...args: unknown[]) => args.length);
  const { result } = await renderHook(() => useOwnerAction(action as (x: string) => Promise<number>), { wrapper });
  let count = -1;
  await act(async () => {
    count = await result.current.mutateAsync('b');
  });
  expect(count).toBe(1);
  expect(action).toHaveBeenCalledWith('b');
});
