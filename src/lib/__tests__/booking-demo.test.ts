import { getAvailableSlots } from '../availability';
import { createDemoDb, DEMO_USER_ID, type Db } from '../db';
import { SEED_SALON_IDS } from '../demoSeed';

jest.mock('expo-secure-store', () => ({}));
jest.mock('../supabase', () => ({
  isSupabaseConfigured: false,
  getSupabase: () => {
    throw new Error('not used');
  },
}));

// Monday 2026-11-16, 10 AM in New York. Lisa's Salon is open Tuesday 10–7.
const MONDAY = new Date('2026-11-16T15:00:00Z');
const TUE_11AM = '2026-11-17T16:00:00.000Z';
const TUE_11_30 = '2026-11-17T16:30:00.000Z';

function memoryDb(): Db {
  let json: string | null = null;
  return createDemoDb({ load: async () => json, save: async (j) => void (json = j) });
}

async function lisa(db: Db) {
  const [april] = await db.select('professionals', { business_id: SEED_SALON_IDS.lisa, first_name: 'April' });
  const [blowout] = await db.select('services', { business_id: SEED_SALON_IDS.lisa, name: 'Blowout' });
  return { april: april!, blowout: blowout! };
}

describe('holding a time (demo mode)', () => {
  beforeEach(() => jest.useFakeTimers({ now: MONDAY, doNotFake: ['nextTick', 'setImmediate'] }));
  afterEach(() => jest.useRealTimers());

  it('holds a free time with the price and length from the salon’s menu', async () => {
    const db = memoryDb();
    const { april, blowout } = await lisa(db);
    const id = await db.createHold({
      business_id: SEED_SALON_IDS.lisa,
      professional_id: april.id,
      service_ids: [blowout.id],
      starts_at: TUE_11AM,
    });
    const [b] = await db.select('bookings', { id });
    expect(b).toMatchObject({
      status: 'pending_payment',
      customer_id: DEMO_USER_ID,
      total_cents: 6000,
      ends_at: '2026-11-17T16:45:00.000Z',
    });
    expect(await db.select('booking_services', { booking_id: id })).toHaveLength(1);
  });

  it('shows the hold as busy, so the time is crossed out for others', async () => {
    const db = memoryDb();
    const { april, blowout } = await lisa(db);
    await db.createHold({ business_id: SEED_SALON_IDS.lisa, professional_id: april.id, service_ids: [blowout.id], starts_at: TUE_11AM });
    const busy = await db.busyTimes(SEED_SALON_IDS.lisa, '2026-11-17T00:00:00Z', '2026-11-18T00:00:00Z');
    expect(busy).toEqual([{ professional_id: april.id, starts_at: TUE_11AM, ends_at: '2026-11-17T16:45:00.000Z', kind: 'booking' }]);
    const [hours, availability, breaks] = await Promise.all([
      db.select('business_hours', { business_id: SEED_SALON_IDS.lisa }),
      db.select('availability', { professional_id: april.id }),
      db.select('breaks', { professional_id: april.id }),
    ]);
    const slots = getAvailableSlots({
      date: '2026-11-17',
      timeZone: 'America/New_York',
      now: MONDAY,
      durationMin: 45,
      businessHours: hours,
      proId: april.id,
      pros: [{ id: april.id, availability, breaks, timeOff: [], bookings: busy }],
    });
    expect(slots.find((s) => s.start === TUE_11AM)?.booked).toBe(true);
  });

  it('rejects a time that was taken in the meantime', async () => {
    const db = memoryDb();
    const { april, blowout } = await lisa(db);
    // Someone else's confirmed booking at 11:30.
    await db.insert('bookings', [
      {
        business_id: SEED_SALON_IDS.lisa,
        professional_id: april.id,
        customer_id: 'someone-else',
        status: 'confirmed',
        starts_at: TUE_11_30,
        ends_at: '2026-11-17T17:30:00.000Z',
      },
    ]);
    await expect(
      db.createHold({ business_id: SEED_SALON_IDS.lisa, professional_id: april.id, service_ids: [blowout.id], starts_at: TUE_11AM }),
    ).rejects.toThrow(/just booked/);
  });

  it('rejects times outside opening hours or off the grid', async () => {
    const db = memoryDb();
    const { april, blowout } = await lisa(db);
    const hold = (starts_at: string) =>
      db.createHold({ business_id: SEED_SALON_IDS.lisa, professional_id: april.id, service_ids: [blowout.id], starts_at });
    await expect(hold('2026-11-16T20:00:00.000Z')).rejects.toThrow(/isn’t available/); // Monday: closed
    await expect(hold('2026-11-17T16:10:00.000Z')).rejects.toThrow(/isn’t available/); // 11:10
    await expect(hold('2026-11-17T23:30:00.000Z')).rejects.toThrow(/isn’t available/); // 6:30 PM, ends after 7
  });

  it('a new hold replaces your old one, and you can let it go', async () => {
    const db = memoryDb();
    const { april, blowout } = await lisa(db);
    const first = await db.createHold({
      business_id: SEED_SALON_IDS.lisa,
      professional_id: april.id,
      service_ids: [blowout.id],
      starts_at: TUE_11AM,
    });
    const second = await db.createHold({
      business_id: SEED_SALON_IDS.lisa,
      professional_id: april.id,
      service_ids: [blowout.id],
      starts_at: '2026-11-17T20:00:00.000Z',
    });
    expect((await db.select('bookings', { id: first }))[0]!.status).toBe('cancelled');
    await db.releaseHold(second);
    expect((await db.select('bookings', { id: second }))[0]!.status).toBe('cancelled');
    expect(await db.busyTimes(SEED_SALON_IDS.lisa, '2026-11-17T00:00:00Z', '2026-11-18T00:00:00Z')).toEqual([]);
  });

  it('a hold stops blocking after 10 minutes', async () => {
    const db = memoryDb();
    const { april, blowout } = await lisa(db);
    await db.createHold({ business_id: SEED_SALON_IDS.lisa, professional_id: april.id, service_ids: [blowout.id], starts_at: TUE_11AM });
    jest.setSystemTime(new Date(MONDAY.getTime() + 11 * 60_000));
    expect(await db.busyTimes(SEED_SALON_IDS.lisa, '2026-11-17T00:00:00Z', '2026-11-18T00:00:00Z')).toEqual([]);
  });

  it('rejects a service the professional doesn’t do', async () => {
    const db = memoryDb();
    const { april } = await lisa(db);
    const [fade] = await db.select('services', { business_id: SEED_SALON_IDS.fade, name: 'Skin fade' });
    await expect(
      db.createHold({ business_id: SEED_SALON_IDS.lisa, professional_id: april.id, service_ids: [fade!.id], starts_at: TUE_11AM }),
    ).rejects.toThrow(/isn’t available any more/);
  });
});
