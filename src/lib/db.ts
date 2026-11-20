import * as SecureStore from 'expo-secure-store';

import { CATEGORIES } from './catalog';
import { createChunkedStorage } from './chunkedStorage';
import { addDemoSalons } from './demoSeed';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { getAvailableSlots, isLive } from './availability';
import { zonedClock } from './hours';
import { bookingTotals, canReschedule, cancellationQuote, FREE_CANCEL_HOURS, isTipChoice } from './payments';
import type { BusyTime, CardSetup, HoldRequest, PayoutsStatus, ReviewRequest, TableName, Tables, WalkInRequest } from './types';

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
  /** When each professional at a salon is busy (bookings, live holds, time off). Public. */
  busyTimes(businessId: string, from: string, to: string): Promise<BusyTime[]>;
  /** Holds a time for 10 minutes (SPEC §9). The server re-checks it's free. Returns the booking id. */
  createHold(req: HoldRequest): Promise<string>;
  /** Lets go of the signed-in customer's hold. */
  releaseHold(bookingId: string): Promise<void>;
  /** Moves the customer's confirmed booking to another free time, until 24 hours before (same services and price). */
  rescheduleBooking(bookingId: string, professionalId: string, startsAt: string): Promise<void>;
  /** Posts a review of a finished visit (one per visit). The server files it under that visit's salon and professional. */
  postReview(req: ReviewRequest): Promise<void>;
  /** Review & pay: sets the tip and starts saving the customer's card (server function save-card). */
  startCardSetup(bookingId: string, tipPercent: number): Promise<CardSetup>;
  /** After the card is saved: the booking becomes confirmed (server function confirm-booking). */
  confirmBooking(bookingId: string): Promise<void>;
  /** Cancels, charging what the rules say; returns the cents charged (server function cancel-booking). */
  cancelBooking(bookingId: string): Promise<{ charged_cents: number }>;
  /** Payouts: a Stripe onboarding link ('start') or where setup stands ('status'). */
  payouts(businessId: string, action: 'start'): Promise<{ url?: string } & Partial<PayoutsStatus>>;
  payouts(businessId: string, action: 'status'): Promise<PayoutsStatus>;
  /** Owner: a walk-in on the calendar (no online payment). The server checks it doesn't overlap. */
  addWalkIn(req: WalkInRequest): Promise<string>;
  /** Owner: once an appointment has started, mark it completed or a no-show. */
  markBooking(bookingId: string, status: 'completed' | 'no_show'): Promise<void>;
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
    async busyTimes(businessId, from, to) {
      return (
        check(
          await sb().rpc('busy_times', {
            p_business: businessId,
            p_from: from,
            p_to: to,
          }),
        ) ?? []
      );
    },
    async createHold(req) {
      const { data, error } = await sb().rpc('create_hold', {
        p_business: req.business_id,
        p_professional: req.professional_id,
        p_service_ids: req.service_ids,
        p_starts_at: req.starts_at,
      });
      if (error) throw new Error(holdError(error));
      return data as string;
    },
    async releaseHold(bookingId) {
      check(await sb().rpc('release_hold', { p_booking: bookingId }));
    },
    async rescheduleBooking(bookingId, professionalId, startsAt) {
      const { error } = await sb().rpc('reschedule_booking', {
        p_booking: bookingId,
        p_professional: professionalId,
        p_starts_at: startsAt,
      });
      if (error) throw new Error(holdError(error));
    },
    async postReview(req) {
      const { data: b } = await sb()
        .from('bookings')
        .select('business_id, professional_id, customer_id')
        .eq('id', req.booking_id)
        .maybeSingle();
      if (!b) throw new Error('Booking not found.');
      const { error } = await sb()
        .from('reviews')
        .insert({ ...req, business_id: b.business_id, professional_id: b.professional_id, customer_id: b.customer_id });
      if (error) {
        throw new Error(
          error.code === '23505'
            ? 'You’ve already reviewed this visit.'
            : error.code === '42501'
              ? 'You can review a visit once it’s finished.'
              : friendlyDbError(error.message),
        );
      }
    },
    async startCardSetup(bookingId, tipPercent) {
      return callFunction<CardSetup>('save-card', {
        booking_id: bookingId,
        tip_percent: tipPercent,
      });
    },
    async confirmBooking(bookingId) {
      await callFunction('confirm-booking', { booking_id: bookingId });
    },
    async cancelBooking(bookingId) {
      return callFunction<{ charged_cents: number }>('cancel-booking', {
        booking_id: bookingId,
      });
    },
    payouts: ((businessId: string, action: 'start' | 'status') =>
      callFunction('connect-onboarding', {
        business_id: businessId,
        action,
      })) as Db['payouts'],
    async addWalkIn(req) {
      const { data, error } = await sb().rpc('add_walk_in', {
        p_business: req.business_id,
        p_professional: req.professional_id,
        p_client: req.client_id,
        p_service_ids: req.service_ids,
        p_starts_at: req.starts_at,
      });
      if (error) throw new Error(holdError(error));
      return data as string;
    },
    async markBooking(bookingId, status) {
      const { error } = await sb().rpc('mark_booking', { p_booking: bookingId, p_status: status });
      if (error) throw new Error(holdError(error));
    },
    async upload(folder, localUri) {
      const body = await (await fetch(localUri)).arrayBuffer();
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      check(await sb().storage.from(PHOTO_BUCKET).upload(path, body, { contentType: 'image/jpeg' }));
      return sb().storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
    },
  };
}

/** Calls a server function (supabase/functions/<name>); its errors are already written for people. */
async function callFunction<T = unknown>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke(name, { body });
  if (error) {
    const res = (error as { context?: Response }).context;
    let message = 'Something went wrong. Please try again.';
    try {
      const j = (await res?.json()) as { error?: string } | undefined;
      if (j?.error) message = j.error;
    } catch {
      if (/fetch|network/i.test(error.message)) message = 'No connection. Check your internet and try again.';
    }
    throw new Error(message);
  }
  return data as T;
}

/** create_hold() raises plain-English messages for the cases a customer can hit; show those as they are. */
function holdError(error: { message: string; code?: string }): string {
  if (error.code && ['23514', '23505', '42501'].includes(error.code)) return error.message;
  return friendlyDbError(error.message);
}

function friendlyDbError(message: string): string {
  if (/network|fetch/i.test(message)) return 'No connection. Check your internet and try again.';
  if (/row-level security|permission/i.test(message)) return 'You don’t have permission to change that.';
  return 'Something went wrong saving that. Try again.';
}

// ─────────────────────────────────────────────────────────── demo (on this phone only)

export const DEMO_USER_ID = '00000000-0000-4000-a000-00000000de00';

type Store = { [K in TableName]?: Tables[K][] };
export type Persist = {
  load(): Promise<string | null>;
  save(json: string): Promise<void>;
};

/** What the database fills in when a column is left out (same defaults as the migration). */
const DEFAULTS: { [K in TableName]?: () => Partial<Tables[K]> } = {
  businesses: () => ({
    type: null,
    description: null,
    phone: null,
    website: null,
    instagram: null,
    tiktok: null,
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    zip: null,
    lat: null,
    lng: null,
    time_zone: 'America/New_York',
    logo_url: null,
    amenities: [],
    health_safety: [],
    cancellation_hours: 24,
    late_cancel_percent: 50,
    stripe_account_id: null,
    payouts_enabled: false,
    is_published: false,
    created_at: new Date().toISOString(),
  }),
  clients: () => ({ profile_id: null, email: null, phone: null, notes: null, created_at: new Date().toISOString() }),
  services: () => ({
    category_id: null,
    description: null,
    is_visible: true,
    sort_order: 0,
  }),
  professionals: () => ({
    role: 'hair stylist',
    last_name: null,
    avatar_url: null,
    instagram: null,
    is_active: true,
  }),
  reviews: () => ({ tags: [], body: null, photo_url: null, created_at: new Date().toISOString() }),
  business_photos: () => ({ sort_order: 0 }),
  professional_photos: () => ({ sort_order: 0 }),
  time_off: () => ({ note: null }),
  bookings: () => ({
    customer_id: null,
    client_id: null,
    status: 'pending_payment',
    source: 'online',
    subtotal_cents: 0,
    fee_cents: 0,
    tip_cents: 0,
    total_cents: 0,
    stripe_payment_intent_id: null,
    cancelled_at: null,
    cancelled_by: null,
    refund_cents: 0,
    created_at: new Date().toISOString(),
    tip_percent: 0,
    payment_status: 'none',
    stripe_setup_intent_id: null,
    stripe_payment_method_id: null,
    card_label: null,
    charge_cents: 0,
    charged_at: null,
    payment_error: null,
  }),
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
    { table: 'bookings', column: 'business_id' },
  ],
  bookings: [{ table: 'booking_services', column: 'booking_id' }],
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

  const api: Db = {
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
        ...(table === 'professional_services' || table === 'booking_services' ? {} : { id: uuid() }),
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
    async busyTimes(businessId, from, to) {
      return demoBusyTimes(api, businessId, from, to);
    },
    async createHold(req) {
      return demoCreateHold(api, req);
    },
    async releaseHold(bookingId) {
      const now = new Date().toISOString();
      await api.update(
        'bookings',
        { id: bookingId, customer_id: DEMO_USER_ID, status: 'pending_payment' },
        { status: 'cancelled', cancelled_at: now, cancelled_by: DEMO_USER_ID },
      );
    },
    async rescheduleBooking(bookingId, professionalId, startsAt) {
      const [b] = await api.select('bookings', { id: bookingId, customer_id: DEMO_USER_ID });
      if (!b) throw new Error('Booking not found.');
      if (b.status !== 'confirmed' || b.payment_status !== 'card_saved') throw new Error('This booking can’t be changed any more.');
      if (!canReschedule(b, new Date()))
        throw new Error(`It’s less than ${FREE_CANCEL_HOURS} hours away, so it can’t be moved. You can still cancel it.`);
      const items = await api.select('booking_services', { booking_id: bookingId });
      const { ends_at } = await demoCheckSlot(
        api,
        { business_id: b.business_id, professional_id: professionalId, service_ids: items.map((i) => i.service_id), starts_at: startsAt },
        bookingId,
      );
      await api.update('bookings', { id: bookingId }, { professional_id: professionalId, starts_at: startsAt, ends_at });
      await api.update('booking_services', { booking_id: bookingId }, { professional_id: professionalId });
    },
    async postReview(req) {
      const [b] = await api.select('bookings', { id: req.booking_id, customer_id: DEMO_USER_ID });
      if (!b || b.status !== 'completed') throw new Error('You can review a visit once it’s finished.');
      if ((await api.select('reviews', { booking_id: b.id })).length) throw new Error('You’ve already reviewed this visit.');
      const [r] = await api.insert('reviews', [
        { ...req, business_id: b.business_id, professional_id: b.professional_id, customer_id: DEMO_USER_ID },
      ]);
      // What public_reviews would show everyone else.
      await api.insert('public_reviews', [
        {
          id: r!.id,
          business_id: b.business_id,
          professional_id: b.professional_id,
          rating: req.rating,
          tags: req.tags,
          body: req.body,
          photo_url: req.photo_url,
          created_at: r!.created_at,
          reviewer_name: 'You (demo)',
        },
      ]);
    },
    // Demo mode has no Stripe: "saving a card" is pretend and nothing is ever charged.
    async startCardSetup(bookingId, tipPercent) {
      if (!isTipChoice(tipPercent)) throw new Error('Pick a tip.');
      const [b] = await api.select('bookings', {
        id: bookingId,
        customer_id: DEMO_USER_ID,
      });
      if (!b || !isLive(b) || b.status !== 'pending_payment') throw new Error('Your hold ran out. Pick the time again.');
      const t = bookingTotals(b.subtotal_cents, tipPercent);
      await api.update(
        'bookings',
        { id: bookingId },
        {
          tip_percent: tipPercent,
          tip_cents: t.tip,
          fee_cents: t.fee,
          total_cents: t.total,
        },
      );
      return { demo: true };
    },
    async confirmBooking(bookingId) {
      const [b] = await api.select('bookings', {
        id: bookingId,
        customer_id: DEMO_USER_ID,
      });
      if (!b || !isLive(b)) throw new Error('Your hold ran out. Pick the time again.');
      // Like the database trigger: booking online makes you a client of that salon.
      const [existing] = await api.select('clients', { business_id: b.business_id, profile_id: DEMO_USER_ID });
      const client =
        existing ?? (await api.insert('clients', [{ business_id: b.business_id, profile_id: DEMO_USER_ID, name: 'You (demo)' }]))[0]!;
      await api.update(
        'bookings',
        { id: bookingId },
        { status: 'confirmed', payment_status: 'card_saved', card_label: 'Visa ending 4242 (demo)', client_id: client.id },
      );
    },
    async cancelBooking(bookingId) {
      const [b] = await api.select('bookings', { id: bookingId });
      if (!b) throw new Error('Booking not found.');
      if (b.status === 'cancelled') return { charged_cents: b.charge_cents };
      if (new Date(b.starts_at).getTime() <= Date.now()) throw new Error('This appointment has already started.');
      const by = b.customer_id === DEMO_USER_ID ? 'customer' : 'salon';
      const quote = b.status === 'pending_payment' ? { charge: 0 } : cancellationQuote(b, new Date(), by);
      await api.update(
        'bookings',
        { id: bookingId },
        {
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: DEMO_USER_ID,
          charge_cents: quote.charge,
          payment_status: b.payment_status === 'card_saved' ? (quote.charge > 0 ? 'charged' : 'not_charged') : b.payment_status,
        },
      );
      return { charged_cents: quote.charge };
    },
    payouts: (async (businessId: string, action: 'start' | 'status') => {
      if (action === 'start') {
        await api.update('businesses', { id: businessId }, { stripe_account_id: 'acct_demo', payouts_enabled: true });
      }
      const [b] = await api.select('businesses', { id: businessId });
      return {
        started: !!b?.stripe_account_id,
        payouts_enabled: !!b?.payouts_enabled,
        schedule: 'daily',
      };
    }) as Db['payouts'],
    async addWalkIn(req) {
      return demoAddWalkIn(api, req);
    },
    async markBooking(bookingId, status) {
      const [b] = await api.select('bookings', { id: bookingId });
      if (!b) throw new Error('Booking not found.');
      if (!['confirmed', 'completed', 'no_show'].includes(b.status) || ['charging', 'charged'].includes(b.payment_status))
        throw new Error('This booking can’t be changed any more.');
      if (new Date(b.starts_at).getTime() > Date.now()) throw new Error('You can mark it once the appointment has started.');
      await api.update('bookings', { id: bookingId }, { status });
    },
  };
  return api;
}

const overlaps = (a: { starts_at: string; ends_at: string }, from: string, to: string) =>
  new Date(a.starts_at).getTime() < new Date(to).getTime() && new Date(a.ends_at).getTime() > new Date(from).getTime();

/** Same answer as busy_times() in the database, from the data on this phone. */
async function demoBusyTimes(db: Db, businessId: string, from: string, to: string): Promise<BusyTime[]> {
  const pros = await db.select('professionals', { business_id: businessId });
  const proIds = pros.map((p) => p.id);
  if (!proIds.length) return [];
  const [bookings, timeOff] = await Promise.all([
    db.select('bookings', { business_id: businessId }),
    db.select('time_off', { professional_id: proIds }),
  ]);
  return [
    ...bookings
      .filter((b) => isLive(b) && overlaps(b, from, to))
      .map((b) => ({
        professional_id: b.professional_id,
        starts_at: b.starts_at,
        ends_at: b.ends_at,
        kind: 'booking' as const,
      })),
    ...timeOff
      .filter((t) => overlaps(t, from, to))
      .map((t) => ({
        professional_id: t.professional_id,
        starts_at: t.starts_at,
        ends_at: t.ends_at,
        kind: 'time_off' as const,
      })),
  ];
}

/**
 * Demo version of bookable_end() plus the double-booking check: the same rules, using the same slot
 * calculator the screen uses. `ignore` is a booking that's being moved (it doesn't block itself).
 */
async function demoCheckSlot(db: Db, req: HoldRequest, ignore?: string) {
  const [business] = await db.select('businesses', { id: req.business_id });
  if (!business) throw new Error('This salon isn’t taking bookings right now.');
  const services = (
    await db.select('services', {
      id: req.service_ids,
      business_id: req.business_id,
    })
  ).filter((s) => s.is_visible);
  if (!req.service_ids.length || services.length !== new Set(req.service_ids).size)
    throw new Error('One of those services isn’t available any more.');
  const links = await db.select('professional_services', {
    professional_id: req.professional_id,
    service_id: req.service_ids,
  });
  if (links.length !== services.length) throw new Error('That professional doesn’t offer all of those services.');

  const minutes = services.reduce((sum, s) => sum + s.duration_min, 0);
  const date = zonedClock(new Date(req.starts_at), business.time_zone).date;
  const [hours, availability, breaks] = await Promise.all([
    db.select('business_hours', { business_id: req.business_id }),
    db.select('availability', { professional_id: req.professional_id }),
    db.select('breaks', { professional_id: req.professional_id }),
  ]);
  const busy = await demoBusyTimes(
    db,
    req.business_id,
    new Date(new Date(req.starts_at).getTime() - 86_400_000).toISOString(),
    new Date(new Date(req.starts_at).getTime() + 2 * 86_400_000).toISOString(),
  );
  const [moving] = ignore ? await db.select('bookings', { id: ignore }) : [];
  const mine = busy.filter((b) => b.professional_id === req.professional_id && !(moving && sameStretch(b, moving)));
  const slots = getAvailableSlots({
    date,
    timeZone: business.time_zone,
    now: new Date(),
    durationMin: minutes,
    businessHours: hours,
    pros: [
      {
        id: req.professional_id,
        availability,
        breaks,
        timeOff: mine.filter((b) => b.kind === 'time_off'),
        bookings: mine.filter((b) => b.kind === 'booking'),
      },
    ],
    proId: req.professional_id,
  });
  const slot = slots.find((s) => new Date(s.start).getTime() === new Date(req.starts_at).getTime());
  if (!slot) throw new Error('That time isn’t available. Pick another.');
  if (slot.booked) throw new Error('Someone just booked that time. Pick another.');
  return { services, minutes, ends_at: new Date(new Date(req.starts_at).getTime() + minutes * 60_000).toISOString() };
}

/** The same busy stretch: how busy_times() reports a booking (it never shares ids). */
export const sameStretch = (
  a: { professional_id: string; starts_at: string; ends_at: string },
  b: { professional_id: string; starts_at: string; ends_at: string },
) =>
  a.professional_id === b.professional_id &&
  new Date(a.starts_at).getTime() === new Date(b.starts_at).getTime() &&
  new Date(a.ends_at).getTime() === new Date(b.ends_at).getTime();

/** Demo version of create_hold(). */
async function demoCreateHold(db: Db, req: HoldRequest): Promise<string> {
  // Your own hold doesn't count against you: holding a new time replaces it.
  await db.update(
    'bookings',
    { customer_id: DEMO_USER_ID, status: 'pending_payment' },
    {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: DEMO_USER_ID,
    },
  );
  const { services, minutes } = await demoCheckSlot(db, req);
  const price = services.reduce((sum, s) => sum + s.price_cents, 0);
  const [booking] = await db.insert('bookings', [
    {
      business_id: req.business_id,
      professional_id: req.professional_id,
      customer_id: DEMO_USER_ID,
      starts_at: req.starts_at,
      ends_at: new Date(new Date(req.starts_at).getTime() + minutes * 60_000).toISOString(),
      subtotal_cents: price,
      total_cents: price,
    },
  ]);
  await db.insert(
    'booking_services',
    services.map((s) => ({
      booking_id: booking!.id,
      service_id: s.id,
      professional_id: req.professional_id,
      price_cents: s.price_cents,
      duration_min: s.duration_min,
    })),
  );
  return booking!.id;
}

/** Demo version of add_walk_in(): menu prices and lengths, and no overlapping appointments. */
async function demoAddWalkIn(db: Db, req: WalkInRequest): Promise<string> {
  const [pro] = await db.select('professionals', { id: req.professional_id, business_id: req.business_id });
  if (!pro || !pro.is_active) throw new Error('Pick someone from your team.');
  const services = await db.select('services', { id: req.service_ids, business_id: req.business_id });
  if (!req.service_ids.length || services.length !== new Set(req.service_ids).size) throw new Error('Pick a service from your menu.');
  const minutes = services.reduce((s, x) => s + x.duration_min, 0);
  const price = services.reduce((s, x) => s + x.price_cents, 0);
  const start = new Date(req.starts_at).getTime();
  const end = start + minutes * 60_000;
  const theirs = await db.select('bookings', { professional_id: req.professional_id });
  if (theirs.some((b) => isLive(b) && new Date(b.starts_at).getTime() < end && new Date(b.ends_at).getTime() > start))
    throw new Error('That time overlaps another appointment.');
  const [booking] = await db.insert('bookings', [
    {
      business_id: req.business_id,
      professional_id: req.professional_id,
      client_id: req.client_id,
      starts_at: new Date(start).toISOString(),
      ends_at: new Date(end).toISOString(),
      status: 'confirmed',
      source: 'walk_in',
      subtotal_cents: price,
      total_cents: price,
    },
  ]);
  await db.insert(
    'booking_services',
    services.map((s) => ({
      booking_id: booking!.id,
      service_id: s.id,
      professional_id: req.professional_id,
      price_cents: s.price_cents,
      duration_min: s.duration_min,
    })),
  );
  return booking!.id;
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
      instance = createDemoDb({
        load: () => kv.getItem(DEMO_KEY),
        save: (json) => kv.setItem(DEMO_KEY, json),
      });
    }
  }
  return instance;
}

/** Wipes demo data (used by "Reset demo data" on the Profile tab). */
export async function resetDemoData(): Promise<void> {
  await createChunkedStorage(SecureStore).removeItem(DEMO_KEY);
  instance = null;
}
