import type { ProRole } from './types';

/** "What kind of business?" chips (Setup.html). Stored as businesses.type. */
export const BUSINESS_TYPES = ['Hair salon', 'Barbershop', 'Braiding', 'Nail salon', 'Lash & brow', 'Makeup'] as const;

/** Amenity chips (BizProfile.html). */
export const AMENITIES = ['Wi-Fi', 'Coffee', 'Wheelchair access', 'Parking', 'Kid friendly', 'Restroom'] as const;

/** Health & safety chips (SPEC §10, About tab). */
export const HEALTH_SAFETY = ['Tools sanitized after each client', 'Masks available', 'Licensed professionals', 'Hand sanitizer'] as const;

/** Role chips (Team.html), in the order shown. Labels are shorter than the database values. */
export const ROLES: { value: ProRole; label: string }[] = [
  { value: 'hair stylist', label: 'Hair stylist' },
  { value: 'barber', label: 'Barber' },
  { value: 'colorist', label: 'Colorist' },
  { value: 'braider', label: 'Braider' },
  { value: 'nail technician', label: 'Nail tech' },
  { value: 'lash artist', label: 'Lash artist' },
  { value: 'makeup artist', label: 'Makeup artist' },
  { value: 'cosmetologist', label: 'Cosmetologist' },
  { value: 'massage therapist', label: 'Massage therapist' },
  { value: 'other', label: 'Other' },
];

export function roleLabel(role: ProRole): string {
  return ROLES.find((r) => r.value === role)?.label ?? 'Professional';
}

/** Same 10 categories as the database (seeded by the first migration). */
export const CATEGORIES: { slug: string; name: string }[] = [
  { slug: 'haircut', name: 'Haircut' },
  { slug: 'barber', name: 'Barber' },
  { slug: 'kids-haircut', name: 'Kids haircut' },
  { slug: 'braids', name: 'Braids' },
  { slug: 'color', name: 'Color' },
  { slug: 'hair-treatments', name: 'Hair treatments' },
  { slug: 'eyelashes', name: 'Lashes' },
  { slug: 'brows', name: 'Brows' },
  { slug: 'makeup', name: 'Makeup' },
  { slug: 'nails', name: 'Nails' },
];

export type CatalogItem = { name: string; duration_min: number; price_cents: number };

/**
 * "Add from catalog" starting points. Prices and times are only suggestions —
 * the owner changes them in the edit sheet before saving.
 */
export const SERVICE_CATALOG: Record<string, CatalogItem[]> = {
  haircut: [
    { name: 'Adult cut', duration_min: 30, price_cents: 3000 },
    { name: 'Cut & shampoo', duration_min: 45, price_cents: 3500 },
    { name: 'Cut, shampoo & style', duration_min: 60, price_cents: 4000 },
    { name: 'Blowout', duration_min: 45, price_cents: 4500 },
    { name: 'Silk press', duration_min: 90, price_cents: 8500 },
  ],
  barber: [
    { name: 'Haircut', duration_min: 30, price_cents: 3000 },
    { name: 'Fade', duration_min: 45, price_cents: 3500 },
    { name: 'Cut & beard', duration_min: 45, price_cents: 4500 },
    { name: 'Beard trim', duration_min: 15, price_cents: 1500 },
    { name: 'Line-up', duration_min: 15, price_cents: 1500 },
  ],
  'kids-haircut': [{ name: 'Kids cut', duration_min: 30, price_cents: 2000 }],
  braids: [
    { name: 'Box braids', duration_min: 180, price_cents: 18000 },
    { name: 'Knotless braids', duration_min: 240, price_cents: 22000 },
    { name: 'Cornrows', duration_min: 90, price_cents: 7000 },
    { name: 'Twists', duration_min: 150, price_cents: 14000 },
    { name: 'Locs retwist', duration_min: 90, price_cents: 9000 },
  ],
  color: [
    { name: 'Single process color', duration_min: 90, price_cents: 9000 },
    { name: 'Root touch-up', duration_min: 60, price_cents: 7000 },
    { name: 'Highlights', duration_min: 120, price_cents: 15000 },
    { name: 'Balayage', duration_min: 180, price_cents: 20000 },
  ],
  'hair-treatments': [
    { name: 'Deep conditioning', duration_min: 30, price_cents: 3500 },
    { name: 'Scalp treatment', duration_min: 30, price_cents: 4000 },
    { name: 'Keratin treatment', duration_min: 150, price_cents: 20000 },
  ],
  eyelashes: [
    { name: 'Classic lash set', duration_min: 120, price_cents: 12000 },
    { name: 'Volume lash set', duration_min: 150, price_cents: 16000 },
    { name: 'Lash fill', duration_min: 60, price_cents: 6500 },
    { name: 'Lash lift', duration_min: 60, price_cents: 7500 },
  ],
  brows: [
    { name: 'Brow shaping', duration_min: 30, price_cents: 2500 },
    { name: 'Brow tint', duration_min: 15, price_cents: 2000 },
    { name: 'Brow lamination', duration_min: 45, price_cents: 6000 },
  ],
  makeup: [
    { name: 'Natural makeup', duration_min: 45, price_cents: 7000 },
    { name: 'Full glam', duration_min: 60, price_cents: 9000 },
    { name: 'Bridal makeup', duration_min: 90, price_cents: 18000 },
  ],
  nails: [
    { name: 'Manicure', duration_min: 30, price_cents: 2500 },
    { name: 'Gel manicure', duration_min: 45, price_cents: 4000 },
    { name: 'Pedicure', duration_min: 45, price_cents: 4000 },
    { name: 'Acrylic full set', duration_min: 75, price_cents: 6000 },
  ],
};

/** Which category the catalog opens on, based on the business type. */
export function defaultCategoryFor(type: string | null): string {
  switch (type) {
    case 'Barbershop':
      return 'barber';
    case 'Braiding':
      return 'braids';
    case 'Nail salon':
      return 'nails';
    case 'Lash & brow':
      return 'eyelashes';
    case 'Makeup':
      return 'makeup';
    default:
      return 'haircut';
  }
}

/** Which role a new professional starts with, based on the business type. */
export function defaultRoleFor(type: string | null): ProRole {
  switch (type) {
    case 'Barbershop':
      return 'barber';
    case 'Braiding':
      return 'braider';
    case 'Nail salon':
      return 'nail technician';
    case 'Lash & brow':
      return 'lash artist';
    case 'Makeup':
      return 'makeup artist';
    default:
      return 'hair stylist';
  }
}
