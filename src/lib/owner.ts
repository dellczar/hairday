import { getDb, type Db } from './db';
import type { Availability, Break, Business, BusinessHour, Professional, ProRole, Service } from './types';

/** Everything Business mode saves. Each function is one owner action (a Save button). */

export type DayHours = { weekday: number; start: string; end: string };

export type NewBusiness = {
  name: string;
  type: string;
  logoUri: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  hours: DayHours[];
};

export async function createBusiness(input: NewBusiness, db: Db = getDb()): Promise<Business> {
  const owner_id = await db.userId();
  if (!owner_id) throw new Error('Sign in first to set up your business.');
  const { logoUri, hours, ...fields } = input;
  const [biz] = await db.insert('businesses', [{ ...fields, owner_id }]);
  if (!biz) throw new Error('Couldn’t create your business. Try again.');
  await replaceBusinessHours(biz.id, hours, db);
  if (logoUri) {
    const logo_url = await db.upload(`${biz.id}/logo`, logoUri);
    await db.update('businesses', { id: biz.id }, { logo_url });
    biz.logo_url = logo_url;
  }
  return biz;
}

export async function updateBusiness(id: string, patch: Partial<Business>, db: Db = getDb()): Promise<void> {
  await db.update('businesses', { id }, patch);
}

export async function setBusinessLogo(id: string, uri: string, db: Db = getDb()): Promise<void> {
  const logo_url = await db.upload(`${id}/logo`, uri);
  await db.update('businesses', { id }, { logo_url });
}

export async function replaceBusinessHours(business_id: string, hours: DayHours[], db: Db = getDb()): Promise<void> {
  await db.remove('business_hours', { business_id });
  if (hours.length) {
    await db.insert(
      'business_hours',
      hours.map((h): Partial<BusinessHour> => ({ business_id, weekday: h.weekday, opens_at: h.start, closes_at: h.end })),
    );
  }
}

export async function addBusinessPhoto(business_id: string, uri: string, sort_order: number, db: Db = getDb()): Promise<void> {
  const url = await db.upload(`${business_id}/photos`, uri);
  await db.insert('business_photos', [{ business_id, url, sort_order }]);
}

export async function removeBusinessPhoto(id: string, db: Db = getDb()): Promise<void> {
  await db.remove('business_photos', { id });
}

// ─────────────────────────────────────────────────────────── services

export type ServiceInput = Pick<Service, 'business_id' | 'category_id' | 'name' | 'description' | 'price_cents' | 'duration_min' | 'is_visible'> & {
  id?: string;
};

export async function saveService(input: ServiceInput, sort_order: number, db: Db = getDb()): Promise<Service> {
  const { id, ...fields } = input;
  if (id) {
    const [row] = await db.update('services', { id }, fields);
    if (!row) throw new Error('That service no longer exists.');
    return row;
  }
  const [row] = await db.insert('services', [{ ...fields, sort_order }]);
  if (!row) throw new Error('Couldn’t add the service. Try again.');
  // A new service is offered by everyone on the team until the owner says otherwise.
  const pros = await db.select('professionals', { business_id: input.business_id });
  if (pros.length) await db.insert('professional_services', pros.map((p) => ({ professional_id: p.id, service_id: row.id })));
  return row;
}

export async function deleteService(id: string, db: Db = getDb()): Promise<void> {
  await db.remove('services', { id });
}

/** Saves a new order after the owner moves a service up or down. */
export async function reorderServices(ids: string[], db: Db = getDb()): Promise<void> {
  await Promise.all(ids.map((id, i) => db.update('services', { id }, { sort_order: i })));
}

// ─────────────────────────────────────────────────────────── team

export type ProInput = {
  id?: string;
  business_id: string;
  first_name: string;
  last_name: string | null;
  role: ProRole;
  instagram: string | null;
  /** Off = not taking bookings (hidden from clients). Defaults to on. */
  is_active?: boolean;
  serviceIds: string[];
  /** A new photo picked on the phone (local file), if any. */
  avatarUri: string | null;
};

/** Saves a professional and which services they offer. A new professional starts with the salon's opening hours. */
export async function saveProfessional(input: ProInput, db: Db = getDb()): Promise<Professional> {
  const { id, serviceIds, avatarUri, ...fields } = input;
  let pro: Professional | undefined;
  if (id) [pro] = await db.update('professionals', { id }, fields);
  else [pro] = await db.insert('professionals', [fields]);
  if (!pro) throw new Error('Couldn’t save this professional. Try again.');

  if (avatarUri) {
    const avatar_url = await db.upload(`${input.business_id}/team/${pro.id}`, avatarUri);
    await db.update('professionals', { id: pro.id }, { avatar_url });
    pro.avatar_url = avatar_url;
  }

  await db.remove('professional_services', { professional_id: pro.id });
  if (serviceIds.length) await db.insert('professional_services', serviceIds.map((service_id) => ({ professional_id: pro.id, service_id })));

  if (!id) {
    const hours = await db.select('business_hours', { business_id: input.business_id });
    if (hours.length) {
      await db.insert('availability', hours.map((h) => ({ professional_id: pro.id, weekday: h.weekday, starts_at: h.opens_at, ends_at: h.closes_at })));
    }
  }
  return pro;
}

export async function deleteProfessional(id: string, db: Db = getDb()): Promise<void> {
  await db.remove('professionals', { id });
}

export async function addProPhoto(business_id: string, professional_id: string, uri: string, sort_order: number, db: Db = getDb()): Promise<void> {
  const url = await db.upload(`${business_id}/team/${professional_id}`, uri);
  await db.insert('professional_photos', [{ professional_id, url, sort_order }]);
}

export async function removeProPhoto(id: string, db: Db = getDb()): Promise<void> {
  await db.remove('professional_photos', { id });
}

// ─────────────────────────────────────────────────────────── schedules

export type BreakInput = Pick<Break, 'weekday' | 'starts_at' | 'ends_at'>;

/** Replaces one professional's weekly hours and breaks (Availability "Save"). */
export async function saveSchedule(professional_id: string, days: DayHours[], breaks: BreakInput[], db: Db = getDb()): Promise<void> {
  await db.remove('availability', { professional_id });
  if (days.length) {
    await db.insert('availability', days.map((d): Partial<Availability> => ({ professional_id, weekday: d.weekday, starts_at: d.start, ends_at: d.end })));
  }
  await db.remove('breaks', { professional_id });
  if (breaks.length) await db.insert('breaks', breaks.map((b) => ({ professional_id, ...b })));
}

export async function addTimeOff(professional_id: string, starts_at: string, ends_at: string, note: string | null, db: Db = getDb()): Promise<void> {
  await db.insert('time_off', [{ professional_id, starts_at, ends_at, note }]);
}

export async function removeTimeOff(id: string, db: Db = getDb()): Promise<void> {
  await db.remove('time_off', { id });
}
