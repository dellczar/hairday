import { createDemoDb, DEMO_USER_ID, type Db } from '../db';
import { SEED_SALON_IDS } from '../demoSeed';
import { amountDue, bookingTotals, BOOKING_FEE_CENTS, cancellationQuote, cardLabel, DEFAULT_TIP, isTipChoice, tipCents } from '../payments';

jest.mock('expo-secure-store', () => ({}));
jest.mock('../supabase', () => ({
  isSupabaseConfigured: false,
  getSupabase: () => {
    throw new Error('not used');
  },
}));

describe('money rules (shared with the server functions)', () => {
  it('has no booking fee for now (Open question 1)', () => {
    expect(BOOKING_FEE_CENTS).toBe(0);
    expect(bookingTotals(3000, 18)).toEqual({ subtotal: 3000, tip: 540, fee: 0, total: 3540 });
  });

  it('works out tips as a share of the services, rounded to the cent', () => {
    expect(DEFAULT_TIP).toBe(18);
    expect(tipCents(3000, 15)).toBe(450);
    expect(tipCents(3000, 20)).toBe(600);
    expect(tipCents(3000, 0)).toBe(0);
    expect(tipCents(4550, 18)).toBe(819); // 818.999… → 819
  });

  it('only accepts the four tip buttons', () => {
    expect([15, 18, 20, 0].every(isTipChoice)).toBe(true);
    expect(isTipChoice(50)).toBe(false);
    expect(isTipChoice('18')).toBe(false);
  });

  const booking = { subtotal_cents: 3000, starts_at: '2026-11-20T19:30:00.000Z' };

  it('cancelling 24 hours or more ahead is free', () => {
    expect(cancellationQuote(booking, new Date('2026-11-19T19:30:00.000Z'), 'customer')).toEqual({ charge: 0, late: false });
    expect(cancellationQuote(booking, new Date('2026-11-10T12:00:00.000Z'), 'customer')).toEqual({ charge: 0, late: false });
  });

  it('cancelling within 24 hours costs half the services, never the tip', () => {
    expect(cancellationQuote(booking, new Date('2026-11-19T19:30:01.000Z'), 'customer')).toEqual({ charge: 1500, late: true });
    expect(
      cancellationQuote({ subtotal_cents: 4550, starts_at: booking.starts_at }, new Date('2026-11-20T18:00:00Z'), 'customer').charge,
    ).toBe(2275);
  });

  it('the salon cancelling never costs the customer anything', () => {
    expect(cancellationQuote(booking, new Date('2026-11-20T19:00:00.000Z'), 'salon')).toEqual({ charge: 0, late: false });
  });

  it('charges the whole visit after the appointment, or half the services for a no-show', () => {
    const b = { subtotal_cents: 3000, tip_cents: 540, fee_cents: 0 };
    expect(amountDue({ ...b, status: 'confirmed' })).toBe(3540);
    expect(amountDue({ ...b, status: 'completed' })).toBe(3540);
    expect(amountDue({ ...b, status: 'no_show' })).toBe(1500);
  });

  it('names cards the way people say them', () => {
    expect(cardLabel('visa', '4242')).toBe('Visa ending 4242');
    expect(cardLabel('amex', '0005')).toBe('American Express ending 0005');
    expect(cardLabel('something_new', null)).toBe('Card');
  });
});

// Monday 2026-11-16, 10 AM in New York. Lisa's Salon is open Tuesday 10–7.
const MONDAY = new Date('2026-11-16T15:00:00Z');
const TUE_11AM = '2026-11-17T16:00:00.000Z';

function memoryDb(): Db {
  let json: string | null = null;
  return createDemoDb({ load: async () => json, save: async (j) => void (json = j) });
}

async function holdBlowout(db: Db, starts_at = TUE_11AM) {
  const [april] = await db.select('professionals', { business_id: SEED_SALON_IDS.lisa, first_name: 'April' });
  const [blowout] = await db.select('services', { business_id: SEED_SALON_IDS.lisa, name: 'Blowout' });
  return db.createHold({ business_id: SEED_SALON_IDS.lisa, professional_id: april!.id, service_ids: [blowout!.id], starts_at });
}

describe('booking and cancelling (demo mode)', () => {
  beforeEach(() => jest.useFakeTimers({ now: MONDAY, doNotFake: ['nextTick', 'setImmediate'] }));
  afterEach(() => jest.useRealTimers());

  it('confirming saves the tip and the card, and charges nothing yet', async () => {
    const db = memoryDb();
    const id = await holdBlowout(db);
    expect(await db.startCardSetup(id, 20)).toEqual({ demo: true });
    await db.confirmBooking(id);
    const [b] = await db.select('bookings', { id });
    expect(b).toMatchObject({
      status: 'confirmed',
      payment_status: 'card_saved',
      customer_id: DEMO_USER_ID,
      subtotal_cents: 6000,
      tip_percent: 20,
      tip_cents: 1200,
      total_cents: 7200,
      charge_cents: 0,
    });
  });

  it('won’t take a tip that isn’t one of the buttons', async () => {
    const db = memoryDb();
    const id = await holdBlowout(db);
    await expect(db.startCardSetup(id, 99)).rejects.toThrow(/tip/);
  });

  it('won’t confirm once the 10-minute hold has run out', async () => {
    const db = memoryDb();
    const id = await holdBlowout(db);
    jest.setSystemTime(new Date(MONDAY.getTime() + 11 * 60_000));
    await expect(db.startCardSetup(id, 18)).rejects.toThrow(/ran out/);
  });

  it('cancelling more than a day ahead charges nothing', async () => {
    const db = memoryDb();
    const id = await holdBlowout(db, '2026-11-18T16:00:00.000Z'); // Wednesday, two days out
    await db.startCardSetup(id, 18);
    await db.confirmBooking(id);
    expect(await db.cancelBooking(id)).toEqual({ charged_cents: 0 });
    const [b] = await db.select('bookings', { id });
    expect(b).toMatchObject({ status: 'cancelled', payment_status: 'not_charged', charge_cents: 0 });
  });

  it('cancelling the day before charges half the services', async () => {
    const db = memoryDb();
    const id = await holdBlowout(db); // Tuesday 11 AM, 25 hours away
    await db.startCardSetup(id, 18);
    await db.confirmBooking(id);
    jest.setSystemTime(new Date('2026-11-16T17:00:00Z')); // now 23 hours away
    expect(await db.cancelBooking(id)).toEqual({ charged_cents: 3000 });
    const [b] = await db.select('bookings', { id });
    expect(b).toMatchObject({ status: 'cancelled', payment_status: 'charged', charge_cents: 3000 });
  });

  it('turning on payouts in demo mode marks the salon ready', async () => {
    const db = memoryDb();
    const [biz] = await db.insert('businesses', [{ owner_id: DEMO_USER_ID, name: 'My Salon' }]);
    expect(await db.payouts(biz!.id, 'status')).toMatchObject({ started: false, payouts_enabled: false });
    await db.payouts(biz!.id, 'start');
    expect(await db.payouts(biz!.id, 'status')).toMatchObject({ started: true, payouts_enabled: true });
  });
});
