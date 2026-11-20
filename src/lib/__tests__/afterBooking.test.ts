import { createDemoDb, DEMO_USER_ID, type Db } from '../db';
import { SEED_SALON_IDS } from '../demoSeed';
import { emailHtml, messageFor, when } from '../messages';
import { canReschedule } from '../payments';

jest.mock('expo-secure-store', () => ({}));
jest.mock('../supabase', () => ({
  isSupabaseConfigured: false,
  getSupabase: () => {
    throw new Error('not used');
  },
}));

describe('reschedule window', () => {
  const b = { starts_at: '2026-11-20T19:30:00.000Z' };
  it('can be moved until 24 hours before, like free cancelling', () => {
    expect(canReschedule(b, new Date('2026-11-19T19:30:00.000Z'))).toBe(true);
    expect(canReschedule(b, new Date('2026-11-19T19:30:01.000Z'))).toBe(false);
    expect(canReschedule(b, new Date('2026-11-20T19:00:00.000Z'))).toBe(false);
  });
});

describe('notification wording', () => {
  const c = {
    salonName: 'Lisa’s Salon',
    timeZone: 'America/New_York',
    startsAt: '2026-11-17T19:30:00.000Z', // Tue 2:30 PM in New York
    services: ['Adult cut'],
    proName: 'April',
    customerName: 'Dana Torres',
    address: '555 Main St, New York',
    bookingId: 'b1',
  };

  it('shows times in the salon’s time zone', () => {
    expect(when(c.startsAt, c.timeZone)).toBe('Tue, Nov 17 at 2:30 PM');
  });

  it('tells customers what, where and when, and opens My bookings', () => {
    const m = messageFor('booking_confirmed', c);
    expect(m).toMatchObject({ audience: 'customer', path: '/(customer)/(tabs)/bookings', title: 'You’re booked' });
    expect(m.body).toBe('Adult cut with April at Lisa’s Salon, Tue, Nov 17 at 2:30 PM. Your card is charged after your visit.');
    expect(messageFor('reminder_2h', c)).toMatchObject({
      title: 'Today at 2:30 PM',
      body: 'Adult cut with April at Lisa’s Salon, 555 Main St, New York.',
    });
  });

  it('says exactly what a cancellation cost', () => {
    expect(messageFor('booking_cancelled', { ...c, chargedCents: 3000, cardLabel: 'Visa ending 4242' }).body).toMatch(
      /is cancelled\. \$30 was charged to Visa ending 4242\.$/,
    );
    expect(messageFor('booking_cancelled', { ...c, chargedCents: 0 }).body).toMatch(/Nothing was charged\.$/);
    expect(messageFor('booking_cancelled', { ...c, cancelledBySalon: true }).body).toMatch(/^Lisa’s Salon had to cancel/);
  });

  it('opens the review screen from a review request', () => {
    expect(messageFor('review_request', c)).toMatchObject({ path: '/review/b1', title: 'How was Lisa’s Salon?' });
  });

  it('sends owners to their calendar, naming the client', () => {
    expect(messageFor('owner_new_booking', c)).toMatchObject({
      audience: 'owner',
      path: '/(business)/calendar',
      body: 'Dana Torres: Adult cut with April, Tue, Nov 17 at 2:30 PM.',
    });
    expect(messageFor('owner_daily', { salonName: 'Lisa’s Salon', timeZone: c.timeZone, count: 3, firstStartsAt: c.startsAt }).body).toBe(
      '3 appointments today. First one at 2:30 PM.',
    );
  });

  it('escapes names in emails', () => {
    expect(emailHtml(messageFor('owner_new_booking', { ...c, customerName: '<b>Eve</b>' }))).toContain('&lt;b&gt;Eve&lt;/b&gt;');
  });
});

// Monday 2026-11-16, 10 AM in New York. Lisa's Salon is open Tuesday and Wednesday 10–7.
const MONDAY = new Date('2026-11-16T15:00:00Z');
const WED_11AM = '2026-11-18T16:00:00.000Z';
const WED_2PM = '2026-11-18T19:00:00.000Z';

function memoryDb(): Db {
  let json: string | null = null;
  return createDemoDb({ load: async () => json, save: async (j) => void (json = j) });
}

async function bookBlowout(db: Db, starts_at = WED_11AM) {
  const [april] = await db.select('professionals', { business_id: SEED_SALON_IDS.lisa, first_name: 'April' });
  const [blowout] = await db.select('services', { business_id: SEED_SALON_IDS.lisa, name: 'Blowout' });
  const id = await db.createHold({ business_id: SEED_SALON_IDS.lisa, professional_id: april!.id, service_ids: [blowout!.id], starts_at });
  await db.startCardSetup(id, 18);
  await db.confirmBooking(id);
  return { id, april: april!.id };
}

describe('reschedule and reviews (demo mode)', () => {
  beforeEach(() => jest.useFakeTimers({ now: MONDAY, doNotFake: ['nextTick', 'setImmediate'] }));
  afterEach(() => jest.useRealTimers());

  it('moves a booking to another free time, keeping price and card', async () => {
    const db = memoryDb();
    const { id, april } = await bookBlowout(db);
    await db.rescheduleBooking(id, april, WED_2PM);
    const [b] = await db.select('bookings', { id });
    expect(b).toMatchObject({
      starts_at: WED_2PM,
      ends_at: '2026-11-18T19:45:00.000Z',
      status: 'confirmed',
      payment_status: 'card_saved',
      subtotal_cents: 6000,
    });
  });

  it('can move a booking by a few minutes, overlapping its own old time', async () => {
    const db = memoryDb();
    const { id, april } = await bookBlowout(db);
    await expect(db.rescheduleBooking(id, april, '2026-11-18T16:15:00.000Z')).resolves.toBeUndefined();
  });

  it('won’t move it onto someone else’s booking', async () => {
    const db = memoryDb();
    const { april } = await bookBlowout(db, WED_2PM);
    const { id } = await bookBlowout(db);
    await expect(db.rescheduleBooking(id, april, WED_2PM)).rejects.toThrow(/booked that time/);
  });

  it('won’t move it within 24 hours', async () => {
    const db = memoryDb();
    const { id, april } = await bookBlowout(db);
    jest.setSystemTime(new Date('2026-11-17T17:00:00Z')); // 23 hours to go
    await expect(db.rescheduleBooking(id, april, WED_2PM)).rejects.toThrow(/less than 24 hours/);
  });

  it('takes one review per finished visit, and shows it on the salon', async () => {
    const db = memoryDb();
    const { id } = await bookBlowout(db);
    const req = { booking_id: id, rating: 5, tags: ['On time'], body: 'Great', photo_url: null };
    await expect(db.postReview(req)).rejects.toThrow(/once it’s finished/);
    await db.update('bookings', { id }, { status: 'completed' });
    await db.postReview(req);
    await expect(db.postReview(req)).rejects.toThrow(/already reviewed/);
    expect(await db.select('reviews', { customer_id: DEMO_USER_ID })).toHaveLength(1);
    expect((await db.select('public_reviews', { business_id: SEED_SALON_IDS.lisa })).some((r) => r.body === 'Great')).toBe(true);
  });
});
