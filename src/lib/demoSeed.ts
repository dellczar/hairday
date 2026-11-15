// Demo mode only: the same 3 New York salons as supabase/seed.sql, so Home and Explore have
// something to show before the Supabase project exists. All names and photos are made up.

import { CATEGORIES } from './catalog';
import type { TableName, Tables } from './types';

type Store = { [K in TableName]?: Tables[K][] };

const SEED_OWNER = '00000000-0000-4000-a000-000000000001';
export const SEED_SALON_IDS = {
  lisa: '10000000-0000-4000-a000-000000000001',
  crown: '10000000-0000-4000-a000-000000000002',
  fade: '10000000-0000-4000-a000-000000000003',
} as const;

type SalonSeed = {
  id: string;
  name: string;
  type: string;
  description: string;
  phone: string;
  website: string;
  instagram: string;
  address: [string, string, string, string];
  lat: number;
  lng: number;
  amenities: string[];
  safety: string[];
  /** [first weekday, last weekday, opens, closes] */
  hours: [number, number, string, string];
  services: [slug: string, name: string, description: string, cents: number, minutes: number][];
  pros: [first: string, last: string, role: Tables['professionals']['role'], instagram: string | null][];
  reviews: [name: string, rating: number, tags: string[], body: string, daysAgo: number, proIndex: number][];
};

const SALONS: SalonSeed[] = [
  {
    id: SEED_SALON_IDS.lisa,
    name: 'Lisa’s Salon',
    type: 'Hair salon',
    description: 'Cuts, color and blowouts in a calm West Village studio.',
    phone: '+12125550101',
    website: 'https://example.com/lisas',
    instagram: 'lisas.salon',
    address: ['214 Bleecker St', 'New York', 'NY', '10012'],
    lat: 40.7295,
    lng: -74.0028,
    amenities: ['Wi-Fi', 'Coffee', 'Wheelchair access'],
    safety: ['Tools sanitized after each client', 'Licensed professionals'],
    hours: [2, 6, '10:00', '19:00'],
    services: [
      ['haircut', 'Adult cut', 'Consultation, wash, cut and style.', 8500, 60],
      ['haircut', 'Blowout', 'Wash and blow-dry.', 6000, 45],
      ['color', 'Single-process color', 'All-over color, root to tip.', 14000, 120],
      ['hair-treatments', 'Gloss treatment', 'Adds shine and tone.', 5500, 30],
    ],
    pros: [
      ['April', 'Moreno', 'hair stylist', 'april.cuts'],
      ['Jun', 'Park', 'colorist', null],
    ],
    reviews: [
      ['Dana T.', 5, ['On time', 'Great result'], 'April listened to exactly what I wanted and the cut still looks great.', 12, 0],
      ['Anna D.', 5, ['Clean salon'], 'Friendly, fast and the salon is spotless. Booking again.', 30, 0],
      ['Priya S.', 4, ['Great result'], 'Lovely color from Jun. Ran a few minutes late.', 45, 1],
    ],
  },
  {
    id: SEED_SALON_IDS.crown,
    name: 'Crown & Coil',
    type: 'Braiding',
    description: 'Knotless braids, twists and natural hair care in Bed-Stuy.',
    phone: '+17185550102',
    website: 'https://example.com/crown',
    instagram: 'crownandcoil.bk',
    address: ['402 Tompkins Ave', 'Brooklyn', 'NY', '11216'],
    lat: 40.6862,
    lng: -73.9441,
    amenities: ['Wi-Fi', 'Kid friendly', 'Restroom'],
    safety: ['Tools sanitized after each client'],
    hours: [1, 6, '09:00', '20:00'],
    services: [
      ['braids', 'Knotless braids, medium', 'Mid-back length. Hair included.', 22000, 300],
      ['braids', 'Stitch cornrows', 'Up to 8 rows.', 9000, 90],
      ['hair-treatments', 'Wash & deep condition', 'For natural hair.', 6500, 60],
      ['kids-haircut', 'Kids braids', 'Ages 4–12.', 8000, 120],
    ],
    pros: [
      ['Amara', 'Okafor', 'braider', 'amara.braids'],
      ['Keisha', 'Brown', 'braider', null],
    ],
    reviews: [
      ['Tasha W.', 5, ['Great result', 'Friendly'], 'Neatest knotless braids I’ve had. Amara is a pro.', 6, 0],
      ['Joy E.', 5, ['On time'], 'Started right on time and finished when she said.', 21, 1],
    ],
  },
  {
    id: SEED_SALON_IDS.fade,
    name: 'Harlem Fade Co.',
    type: 'Barbershop',
    description: 'Fades, shape-ups and beard work. Walk-ins welcome.',
    phone: '+12125550103',
    website: 'https://example.com/fade',
    instagram: 'harlemfade',
    address: ['2290 Frederick Douglass Blvd', 'New York', 'NY', '10027'],
    lat: 40.8106,
    lng: -73.9529,
    amenities: ['Wi-Fi', 'Parking'],
    safety: ['Tools sanitized after each client', 'Hand sanitizer'],
    hours: [0, 6, '09:00', '21:00'],
    services: [
      ['barber', 'Skin fade', 'Fade with a sharp line-up.', 4500, 45],
      ['barber', 'Beard trim & shape-up', 'Hot towel included.', 2500, 30],
      ['kids-haircut', 'Kids cut', 'Ages 12 and under.', 3000, 30],
      ['barber', 'Cut + beard', 'Full service.', 6500, 60],
    ],
    pros: [
      ['Marcus', 'Reed', 'barber', 'marcusfades'],
      ['Luis', 'Vega', 'barber', null],
    ],
    reviews: [
      ['Chris M.', 5, ['Great result'], 'Cleanest fade in Harlem.', 3, 0],
      ['Andre L.', 4, ['Friendly'], 'Good cut, a short wait on a Saturday.', 18, 1],
      ['Sam K.', 5, ['On time', 'Great result'], 'Marcus took his time with the line-up. Worth it.', 40, 0],
    ],
  },
];

// Plain tan blocks in the design's placeholder shades (Main.html tiles) until salons upload real photos.
const SHADES = ['D8CCBF', 'C9B9A8', 'E2D6C9', 'BFAE9C', 'D3C4B4', 'C4B3A2'];
const photo = (i: number) => {
  const c = SHADES[i % SHADES.length];
  return `https://placehold.co/1200x800/${c}/${c}.png`;
};

/** Bump when the sample data changes, so phones that already have it get the new version. */
const SEED_VERSION = 'seed-v2';

const isSeedRow = (r: Record<string, unknown>) =>
  [r.id, r.business_id, r.professional_id].some(
    (v) => typeof v === 'string' && (v.startsWith('seed-') || Object.values(SEED_SALON_IDS).includes(v as never)),
  );

/** Adds the sample salons to a demo store that doesn't have them yet. */
export function addDemoSalons(store: Store, now: Date = new Date()): void {
  const current = store.business_photos?.find((p) => p.id === `${SEED_VERSION}-marker`);
  if (store.businesses?.some((b) => b.id === SEED_SALON_IDS.lisa) && current) return;
  // Older sample data (or none): take out the old sample rows, keep everything the owner made. Favorites stay.
  for (const t of Object.keys(store) as TableName[]) {
    if (t === 'categories' || t === 'favorites') continue;
    (store as Record<string, Record<string, unknown>[]>)[t] = ((store[t] ?? []) as Record<string, unknown>[]).filter((r) => !isSeedRow(r));
  }
  const push = <K extends TableName>(t: K, rows: Tables[K][]) => {
    const list = (store[t] ??= []) as Tables[K][];
    list.push(...rows);
  };
  const catId = (slug: string) => (store.categories?.find((c) => c.slug === slug)?.id ?? `cat-${slug}`) as string;
  if (!store.categories?.length) store.categories = CATEGORIES.map((c) => ({ id: `cat-${c.slug}`, ...c }));

  SALONS.forEach((s, si) => {
    const n = si + 1;
    const [line1, city, state, zip] = s.address;
    push('businesses', [
      {
        id: s.id,
        owner_id: SEED_OWNER,
        name: s.name,
        type: s.type,
        description: s.description,
        phone: s.phone,
        website: s.website,
        instagram: s.instagram,
        tiktok: null,
        address_line1: line1,
        address_line2: null,
        city,
        state,
        zip,
        lat: s.lat,
        lng: s.lng,
        time_zone: 'America/New_York',
        logo_url: null,
        amenities: s.amenities,
        health_safety: s.safety,
        cancellation_hours: 24,
        late_cancel_percent: 50,
        stripe_account_id: null,
        payouts_enabled: true,
        is_published: true,
        created_at: now.toISOString(),
      },
    ]);
    const [first, last, opens, closes] = s.hours;
    const days: number[] = [];
    for (let d = first; d <= last; d++) days.push(d);
    push(
      'business_hours',
      days.map((weekday) => ({ id: `seed-h-${n}-${weekday}`, business_id: s.id, weekday, opens_at: opens, closes_at: closes })),
    );
    push(
      'business_photos',
      [0, 1, 2].map((i) => ({
        id: si === 0 && i === 0 ? `${SEED_VERSION}-marker` : `seed-ph-${n}-${i}`,
        business_id: s.id,
        url: photo(si * 2 + i),
        sort_order: i,
      })),
    );
    const serviceIds = s.services.map((_, i) => `seed-s-${n}-${i}`);
    push(
      'services',
      s.services.map(([slug, name, description, price_cents, duration_min], i) => ({
        id: serviceIds[i]!,
        business_id: s.id,
        category_id: catId(slug),
        name,
        description,
        price_cents,
        duration_min,
        is_visible: true,
        sort_order: i + 1,
      })),
    );
    const proIds = s.pros.map((_, i) => `seed-p-${n}-${i}`);
    push(
      'professionals',
      s.pros.map(([first_name, last_name, role, instagram], i) => ({
        id: proIds[i]!,
        business_id: s.id,
        role,
        first_name,
        last_name,
        avatar_url: null,
        instagram,
        is_active: true,
      })),
    );
    push(
      'professional_services',
      proIds.flatMap((professional_id) => serviceIds.map((service_id) => ({ professional_id, service_id }))),
    );
    push(
      'availability',
      proIds.flatMap((pid, pi) =>
        days.map((weekday) => ({ id: `seed-a-${n}-${pi}-${weekday}`, professional_id: pid, weekday, starts_at: opens, ends_at: closes })),
      ),
    );
    push(
      'breaks',
      proIds.map((pid, pi) => ({ id: `seed-b-${n}-${pi}`, professional_id: pid, weekday: null, starts_at: '13:00', ends_at: '13:30' })),
    );
    push(
      'professional_photos',
      proIds.flatMap((pid, pi) =>
        [0, 1, 2].map((i) => ({ id: `seed-pp-${n}-${pi}-${i}`, professional_id: pid, url: photo(pi * 3 + i + 1), sort_order: i })),
      ),
    );
    push(
      'public_reviews',
      s.reviews.map(([reviewer_name, rating, tags, body, daysAgo, proIndex], i) => ({
        id: `seed-r-${n}-${i}`,
        business_id: s.id,
        professional_id: proIds[proIndex] ?? null,
        rating,
        tags,
        body,
        photo_url: null,
        created_at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
        reviewer_name,
      })),
    );
  });
}
