import * as SecureStore from 'expo-secure-store';

import { CATEGORIES } from './catalog';
import { createChunkedStorage } from './chunkedStorage';
import { addDemoSalons } from './demoSeed';
import { getSupabase, isSupabaseConfigured } from './supabase';
import type { TableName, Tables } from './types';

/**
 * The few table operations the screens need, behind one small interface.
 *
 * - With Supabase set up, every call goes to the real database (Row Level Security applies).
 * - Until then ("demo mode"), the same calls work on data kept on this phone only, so the
 *   owner screens can be tried before the Supabase project exists. See docs/DECISIONS.md.
 */

/** Column = value. An array means "any of these values"; null means "is empty". */
export type Filter<T> = { [K in keyof T]?: T[K] | T[K][] | null };

export interface Db {
  readonly demo: boolean;
  /** Signed-in user's id (in demo mode, a fixed id for "you"). */
  userId(): Promise<string | null>;
  select<K extends TableName>(table: K, filter?: Filter<Tables[K]>, orderBy?: keyof Tables[K] & string): Promise<Tables[K][]>;
  insert<K extends TableName>(table: K, rows: Partial<Tables[K]>[]): Promise<Tables[K][]>;
  update<K extends TableName>(table: K, filter: Filter<Tables[K]>, patch: Partial<Tables[K]>): Promise<Tables[K][]>;
  remove<K extends TableName>(table: K, filter: Filter<Tables[K]>): Promise<void>;
  /** Upload a photo from the phone; returns the URL to save on the row. `folder` starts with the business id. */
  upload(folder: string, localUri: string): Promise<string>;
}

// ─────────────────────────────────────────────────────────── Supabase

export const PHOTO_BUCKET = 'photos';

function supabaseDb(): Db {
  const sb = () => getSupabase();
  // supabase-js's builder types can't follow a dynamic table name; the Tables map above keeps callers typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above
  const from = (t: TableName): any => sb().from(t);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same reason: a query builder of any table
  const applyFilter = (q: any, filter: Record<string, unknown> = {}) => {
    for (const [col, val] of Object.entries(filter)) {
      if (val === undefined) continue;
      if (val === null) q = q.is(col, null);
      else if (Array.isArray(val)) q = q.in(col, val);
      else q = q.eq(col, val);
    }
    return q;
  };
  const check = <T>({ data, error }: { data: T | null; error: { message: string } | null }): T => {
    if (error) throw new Error(friendlyDbError(error.message));
    return data as T;
  };
  return {
    demo: false,
    async userId() {
      const { data } = await sb().auth.getSession();
      return data.session?.user.id ?? null;
    },
    async select(table, filter, orderBy) {
      let q = applyFilter(from(table).select('*'), filter);
      if (orderBy) q = q.order(orderBy);
      return check(await q);
    },
    async insert(table, rows) {
      return check(await from(table).insert(rows).select());
    },
    async update(table, filter, patch) {
      return check(await applyFilter(from(table).update(patch), filter).select());
    },
    async remove(table, filter) {
      check(await applyFilter(from(table).delete(), filter));
    },
    async upload(folder, localUri) {
      const body = await (await fetch(localUri)).arrayBuffer();
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      check(await sb().storage.from(PHOTO_BUCKET).upload(path, body, { contentType: 'image/jpeg' }));
      return sb().storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
    },
  };
}

function friendlyDbError(message: string): string {
  if (/network|fetch/i.test(message)) return 'No connection. Check your internet and try again.';
  if (/row-level security|permission/i.test(message)) return 'You don’t have permission to change that.';
  return 'Something went wrong saving that. Try again.';
}

// ─────────────────────────────────────────────────────────── demo (on this phone only)

export const DEMO_USER_ID = '00000000-0000-4000-a000-00000000de00';

type Store = { [K in TableName]?: Tables[K][] };
export type Persist = { load(): Promise<string | null>; save(json: string): Promise<void> };

/** What the database fills in when a column is left out (same defaults as the migration). */
const DEFAULTS: { [K in TableName]?: () => Partial<Tables[K]> } = {
  businesses: () => ({
    type: null, description: null, phone: null, website: null, instagram: null, tiktok: null,
    address_line1: null, address_line2: null, city: null, state: null, zip: null, lat: null, lng: null,
    time_zone: 'America/New_York', logo_url: null, amenities: [], health_safety: [],
    cancellation_hours: 24, late_cancel_percent: 50, stripe_account_id: null,
    payouts_enabled: false, is_published: false, created_at: new Date().toISOString(),
  }),
  services: () => ({ category_id: null, description: null, is_visible: true, sort_order: 0 }),
  professionals: () => ({ role: 'hair stylist', last_name: null, avatar_url: null, instagram: null, is_active: true }),
  business_photos: () => ({ sort_order: 0 }),
  professional_photos: () => ({ sort_order: 0 }),
  time_off: () => ({ note: null }),
};

/** Child rows deleted along with a parent (the migration's `on delete cascade`). */
const CASCADE: { [K in TableName]?: { table: TableName; column: string }[] } = {
  businesses: [
    { table: 'business_photos', column: 'business_id' },
    { table: 'business_hours', column: 'business_id' },
    { table: 'services', column: 'business_id' },
    { table: 'professionals', column: 'business_id' },
    { table: 'public_reviews', column: 'business_id' },
    { table: 'favorites', column: 'business_id' },
  ],
  services: [{ table: 'professional_services', column: 'service_id' }],
  professionals: [
    { table: 'professional_services', column: 'professional_id' },
    { table: 'professional_photos', column: 'professional_id' },
    { table: 'availability', column: 'professional_id' },
    { table: 'breaks', column: 'professional_id' },
    { table: 'time_off', column: 'professional_id' },
    { table: 'favorites', column: 'professional_id' },
  ],
};

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function matches(row: Record<string, unknown>, filter: Record<string, unknown> = {}): boolean {
  return Object.entries(filter).every(([col, val]) => {
    if (val === undefined) return true;
    if (val === null) return row[col] === null || row[col] === undefined;
    if (Array.isArray(val)) return val.includes(row[col]);
    return row[col] === val;
  });
}

export function createDemoDb(persist: Persist): Db {
  let store: Store | null = null;
  const load = async (): Promise<Store> => {
    if (store) return store;
    let saved: Store = {};
    try {
      saved = JSON.parse((await persist.load()) ?? '{}') as Store;
    } catch {
      saved = {};
    }
    if (!saved.categories?.length) saved.categories = CATEGORIES.map((c) => ({ id: `cat-${c.slug}`, ...c }));
    addDemoSalons(saved); // the 3 sample salons customers can browse
    store = saved;
    return store;
  };
  const save = async () => persist.save(JSON.stringify(store));
  // Each table is an array of plain objects; the generic Tables map keeps callers typed.
  const rowsOf = (s: Store, t: TableName) => (s[t] ??= []) as unknown as Record<string, unknown>[];

  const removeRows = (s: Store, table: TableName, filter: Record<string, unknown>) => {
    const rows = rowsOf(s, table);
    const gone = rows.filter((r) => matches(r, filter));
    (s as Record<string, unknown>)[table] = rows.filter((r) => !matches(r, filter));
    for (const child of CASCADE[table] ?? []) {
      const ids = gone.map((r) => r.id).filter(Boolean);
      if (ids.length) removeRows(s, child.table, { [child.column]: ids });
    }
  };

  return {
    demo: true,
    async userId() {
      return DEMO_USER_ID;
    },
    async select(table, filter, orderBy) {
      const rows = rowsOf(await load(), table).filter((r) => matches(r, filter));
      const sorted = orderBy ? [...rows].sort((a, b) => ((a[orderBy] as number) > (b[orderBy] as number) ? 1 : -1)) : rows;
      return structuredCloneSafe(sorted) as never;
    },
    async insert(table, rows) {
      const s = await load();
      const withDefaults = rows.map((r) => ({
        ...(DEFAULTS[table]?.() ?? {}),
        ...(table === 'professional_services' ? {} : { id: uuid() }),
        ...r,
      }));
      rowsOf(s, table).push(...(withDefaults as Record<string, unknown>[]));
      await save();
      return structuredCloneSafe(withDefaults) as never;
    },
    async update(table, filter, patch) {
      const s = await load();
      const changed: Record<string, unknown>[] = [];
      for (const r of rowsOf(s, table)) {
        if (matches(r, filter)) {
          Object.assign(r, patch);
          changed.push(r);
        }
      }
      await save();
      return structuredCloneSafe(changed) as never;
    },
    async remove(table, filter) {
      removeRows(await load(), table, filter as Record<string, unknown>);
      await save();
    },
    async upload(_folder, localUri) {
      return localUri; // demo mode keeps the photo on the phone
    },
  };
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const DEMO_KEY = 'hairday.demo-data';

let instance: Db | null = null;

/** The app's data access. Real database when Supabase is configured; otherwise on-phone demo data. */
export function getDb(): Db {
  if (!instance) {
    if (isSupabaseConfigured) instance = supabaseDb();
    else {
      const kv = createChunkedStorage(SecureStore);
      instance = createDemoDb({ load: () => kv.getItem(DEMO_KEY), save: (json) => kv.setItem(DEMO_KEY, json) });
    }
  }
  return instance;
}

/** Wipes demo data (used by "Reset demo data" on the Profile tab). */
export async function resetDemoData(): Promise<void> {
  await createChunkedStorage(SecureStore).removeItem(DEMO_KEY);
  instance = null;
}
