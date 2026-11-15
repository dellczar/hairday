import { createDemoDb, DEMO_USER_ID, type Db } from '../db';
import {
  addTimeOff,
  createBusiness,
  deleteProfessional,
  deleteService,
  reorderServices,
  saveProfessional,
  saveSchedule,
  saveService,
} from '../owner';

jest.mock('expo-secure-store', () => ({}));
jest.mock('../supabase', () => ({
  isSupabaseConfigured: false,
  getSupabase: () => {
    throw new Error('not used');
  },
}));

function memoryDb(): { db: Db; saved: () => string | null } {
  let json: string | null = null;
  const db = createDemoDb({ load: async () => json, save: async (j) => void (json = j) });
  return { db, saved: () => json };
}

const newBiz = {
  name: 'Lisa’s Salon',
  type: 'Hair salon',
  logoUri: 'file:///logo.jpg',
  address_line1: '555 Main St',
  address_line2: 'Suite 6',
  city: 'New York',
  state: 'NY',
  zip: '10001',
  lat: null,
  lng: null,
  hours: [
    { weekday: 1, start: '10:00', end: '20:00' },
    { weekday: 2, start: '10:00', end: '20:00' },
  ],
};

describe('owner actions (on-phone demo data)', () => {
  it('creates a business owned by you, with hours and a logo, unpublished until payouts', async () => {
    const { db } = memoryDb();
    const biz = await createBusiness(newBiz, db);
    expect(biz.owner_id).toBe(DEMO_USER_ID);
    expect(biz.is_published).toBe(false);
    expect(biz.cancellation_hours).toBe(24);
    expect(biz.late_cancel_percent).toBe(50);
    expect(biz.logo_url).toBe('file:///logo.jpg');
    expect(await db.select('business_hours', { business_id: biz.id })).toHaveLength(2);
  });

  it('comes with the 10 categories', async () => {
    const { db } = memoryDb();
    expect(await db.select('categories')).toHaveLength(10);
  });

  it('gives a new professional the salon’s hours and their chosen services', async () => {
    const { db } = memoryDb();
    const biz = await createBusiness(newBiz, db);
    const cut = await saveService(
      {
        business_id: biz.id,
        category_id: 'cat-haircut',
        name: 'Adult cut',
        description: null,
        price_cents: 3000,
        duration_min: 30,
        is_visible: true,
      },
      0,
      db,
    );
    const pro = await saveProfessional(
      {
        business_id: biz.id,
        first_name: 'April',
        last_name: 'Olson',
        role: 'hair stylist',
        instagram: null,
        serviceIds: [cut.id],
        avatarUri: null,
      },
      db,
    );
    expect(await db.select('availability', { professional_id: pro.id })).toHaveLength(2);
    expect(await db.select('professional_services', { professional_id: pro.id })).toEqual([
      { professional_id: pro.id, service_id: cut.id },
    ]);

    // Editing replaces the service list instead of adding to it, and doesn't reset their hours.
    await saveProfessional(
      {
        id: pro.id,
        business_id: biz.id,
        first_name: 'April',
        last_name: 'Olson',
        role: 'colorist',
        instagram: null,
        serviceIds: [],
        avatarUri: null,
      },
      db,
    );
    expect(await db.select('professional_services', { professional_id: pro.id })).toHaveLength(0);
    expect((await db.select('professionals', { id: pro.id }))[0]?.role).toBe('colorist');
    expect(await db.select('availability', { professional_id: pro.id })).toHaveLength(2);
  });

  it('offers a newly added service with everyone on the team', async () => {
    const { db } = memoryDb();
    const biz = await createBusiness(newBiz, db);
    const a = await saveProfessional(
      { business_id: biz.id, first_name: 'A', last_name: null, role: 'barber', instagram: null, serviceIds: [], avatarUri: null },
      db,
    );
    const b = await saveProfessional(
      { business_id: biz.id, first_name: 'B', last_name: null, role: 'barber', instagram: null, serviceIds: [], avatarUri: null },
      db,
    );
    const fade = await saveService(
      {
        business_id: biz.id,
        category_id: 'cat-barber',
        name: 'Fade',
        description: null,
        price_cents: 3500,
        duration_min: 45,
        is_visible: true,
      },
      0,
      db,
    );
    const links = await db.select('professional_services', { service_id: fade.id });
    expect(links.map((l) => l.professional_id).sort()).toEqual([a.id, b.id].sort());
  });

  it('deleting a service or a professional removes what hangs off it', async () => {
    const { db } = memoryDb();
    const biz = await createBusiness(newBiz, db);
    const svc = await saveService(
      { business_id: biz.id, category_id: null, name: 'Cut', description: null, price_cents: 1000, duration_min: 30, is_visible: true },
      0,
      db,
    );
    const pro = await saveProfessional(
      { business_id: biz.id, first_name: 'A', last_name: null, role: 'barber', instagram: null, serviceIds: [svc.id], avatarUri: null },
      db,
    );
    await addTimeOff(pro.id, '2026-12-24T05:00:00.000Z', '2026-12-26T05:00:00.000Z', 'Holiday', db);

    await deleteService(svc.id, db);
    expect(await db.select('professional_services', { professional_id: pro.id })).toHaveLength(0);

    await deleteProfessional(pro.id, db);
    expect(await db.select('availability', { professional_id: pro.id })).toHaveLength(0);
    expect(await db.select('time_off', { professional_id: pro.id })).toHaveLength(0);
  });

  it('saves weekly hours and breaks by replacing the old ones', async () => {
    const { db } = memoryDb();
    const biz = await createBusiness(newBiz, db);
    const pro = await saveProfessional(
      { business_id: biz.id, first_name: 'A', last_name: null, role: 'barber', instagram: null, serviceIds: [], avatarUri: null },
      db,
    );
    await saveSchedule(
      pro.id,
      [{ weekday: 3, start: '09:00', end: '17:00' }],
      [{ weekday: null, starts_at: '13:00', ends_at: '13:30' }],
      db,
    );
    expect(await db.select('availability', { professional_id: pro.id })).toMatchObject([
      { weekday: 3, starts_at: '09:00', ends_at: '17:00' },
    ]);
    expect(await db.select('breaks', { professional_id: pro.id })).toMatchObject([{ weekday: null, starts_at: '13:00' }]);
  });

  it('reorders services', async () => {
    const { db } = memoryDb();
    const biz = await createBusiness(newBiz, db);
    const mk = (name: string, i: number) =>
      saveService(
        { business_id: biz.id, category_id: null, name, description: null, price_cents: 1000, duration_min: 30, is_visible: true },
        i,
        db,
      );
    const a = await mk('A', 0);
    const b = await mk('B', 1);
    await reorderServices([b.id, a.id], db);
    expect((await db.select('services', { business_id: biz.id }, 'sort_order')).map((s) => s.name)).toEqual(['B', 'A']);
  });

  it('keeps demo data between app launches', async () => {
    const { db, saved } = memoryDb();
    await createBusiness(newBiz, db);
    const again = createDemoDb({ load: async () => saved(), save: async () => {} });
    expect(await again.select('businesses', { owner_id: DEMO_USER_ID })).toHaveLength(1);
  });
});
