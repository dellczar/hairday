import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getDb } from '@/lib/db';
import type { Profile } from '@/lib/types';

type Settings = Pick<Profile, 'notify_push' | 'notify_email'>;
const KEY = ['profile', 'notify'];
const DEFAULTS: Settings = { notify_push: true, notify_email: true };

/** Profile → Reminders: push and email switches (SPEC §11 "respect the user's toggles"). No SMS in v1. */
export function useNotifySettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Settings> => {
      const db = getDb();
      const me = await db.userId();
      if (!me) return DEFAULTS;
      const [p] = await db.select('profiles', { id: me });
      return p ? { notify_push: p.notify_push, notify_email: p.notify_email } : DEFAULTS;
    },
  });
}

export function useSaveNotifySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      const db = getDb();
      const me = await db.userId();
      if (!me) throw new Error('Please sign in.');
      const changed = await db.update('profiles', { id: me }, patch);
      // Demo mode keeps no profile row until the first change.
      if (!changed.length && db.demo) await db.insert('profiles', [{ id: me, ...DEFAULTS, ...patch }]);
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: KEY });
      const before = qc.getQueryData<Settings>(KEY);
      qc.setQueryData<Settings>(KEY, { ...DEFAULTS, ...before, ...patch });
      return { before };
    },
    onError: (_e, _p, ctx) => qc.setQueryData(KEY, ctx?.before),
    onSettled: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}
