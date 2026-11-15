// Search, filters and sorting for Home → Explore (Results.html, Filters.html). Pure functions, unit-tested.

import { CATEGORIES } from './catalog';
import { distanceMiles, type LatLng } from './geo';
import { toMinutes, zonedClock } from './hours';
import type { Business, BusinessHour, BusinessPhoto, Category, Professional, PublicReview, Service } from './types';

/** Everything a salon card, map pin and salon page need, loaded once. */
export type SalonListing = {
  business: Business;
  photos: BusinessPhoto[];
  hours: BusinessHour[];
  /** Visible services only. */
  services: (Service & { categorySlug: string | null })[];
  pros: Pick<Professional, 'id' | 'first_name' | 'last_name'>[];
  rating: number | null;
  reviewCount: number;
};

export type When = 'any' | 'today' | 'tomorrow' | { date: string };
export type SortKey = 'nearest' | 'top' | 'price';

export type SearchFilters = {
  /** Category slugs; empty = every service. */
  categories: string[];
  when: When;
  /** Cents. null = no limit. */
  priceMin: number | null;
  priceMax: number | null;
  sort: SortKey;
  /** Free text from the Home search box. */
  query: string;
};

export const DEFAULT_FILTERS: SearchFilters = { categories: [], when: 'any', priceMin: null, priceMax: null, sort: 'nearest', query: '' };

/** Service chips in the Filters sheet, in the design's order (Filters.html). */
export const FILTER_SERVICES: { slug: string; label: string }[] = [
  { slug: 'haircut', label: 'Haircut' },
  { slug: 'barber', label: 'Barber' },
  { slug: 'braids', label: 'Braids' },
  { slug: 'color', label: 'Color' },
  { slug: 'nails', label: 'Nails' },
  { slug: 'eyelashes', label: 'Lashes' },
  { slug: 'brows', label: 'Brows' },
  { slug: 'makeup', label: 'Makeup' },
];

/** The 6 tiles on Home (Main.html). */
export const HOME_TILES = ['haircut', 'braids', 'nails', 'eyelashes', 'brows', 'makeup'] as const;

export const SORT_LABELS: Record<SortKey, string> = { nearest: 'Nearest', top: 'Top rated', price: 'Lowest price' };

export function categoryName(slug: string): string {
  return FILTER_SERVICES.find((s) => s.slug === slug)?.label ?? CATEGORIES.find((c) => c.slug === slug)?.name ?? 'Service';
}

/** Joins the separate table reads into one listing per salon. */
export function buildListings(input: {
  businesses: Business[];
  photos: BusinessPhoto[];
  hours: BusinessHour[];
  services: Service[];
  categories: Category[];
  pros: Professional[];
  reviews: Pick<PublicReview, 'business_id' | 'rating'>[];
}): SalonListing[] {
  const slugOf = new Map(input.categories.map((c) => [c.id, c.slug]));
  return input.businesses.map((business) => {
    const ratings = input.reviews.filter((r) => r.business_id === business.id).map((r) => r.rating);
    return {
      business,
      photos: input.photos.filter((p) => p.business_id === business.id).sort((a, b) => a.sort_order - b.sort_order),
      hours: input.hours.filter((h) => h.business_id === business.id),
      services: input.services
        .filter((s) => s.business_id === business.id && s.is_visible)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((s) => ({ ...s, categorySlug: s.category_id ? (slugOf.get(s.category_id) ?? null) : null })),
      pros: input.pros
        .filter((p) => p.business_id === business.id && p.is_active)
        .map(({ id, first_name, last_name }) => ({ id, first_name, last_name })),
      rating: averageRating(ratings),
      reviewCount: ratings.length,
    };
  });
}

/** 4.94 → 4.9; null when there are no reviews yet. */
export function averageRating(ratings: number[]): number | null {
  if (!ratings.length) return null;
  return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
}

/** Services that count for the chosen categories (all of them when none are chosen). */
export function matchingServices(l: SalonListing, categories: string[]) {
  return categories.length ? l.services.filter((s) => s.categorySlug && categories.includes(s.categorySlug)) : l.services;
}

/** Lowest price among the matching services, in cents. */
export function fromPrice(l: SalonListing, categories: string[]): number | null {
  const prices = matchingServices(l, categories).map((s) => s.price_cents);
  return prices.length ? Math.min(...prices) : null;
}

/** The salon calendar day the "When" choice points at, or null for "any day". */
function whenDate(when: When, now: Date, timeZone: string): { weekday: number; isToday: boolean } | null {
  if (when === 'any') return null;
  const today = zonedClock(now, timeZone);
  if (when === 'today') return { weekday: today.weekday, isToday: true };
  if (when === 'tomorrow') return { weekday: (today.weekday + 1) % 7, isToday: false };
  const [y, m, d] = when.date.split('-').map((n) => parseInt(n, 10)) as [number, number, number];
  return { weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), isToday: when.date === today.date };
}

/** Open at some point that day (and, for today, not already closed). */
export function openOn(l: SalonListing, when: When, now: Date): boolean {
  const day = whenDate(when, now, l.business.time_zone);
  if (!day) return true;
  const rows = l.hours.filter((h) => h.weekday === day.weekday);
  if (!day.isToday) return rows.length > 0;
  const minutes = zonedClock(now, l.business.time_zone).minutes;
  return rows.some((h) => toMinutes(h.closes_at) > minutes);
}

function matchesQuery(l: SalonListing, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = [
    l.business.name,
    l.business.type ?? '',
    l.business.city ?? '',
    ...l.services.map((s) => `${s.name} ${s.categorySlug ? categoryName(s.categorySlug) : ''}`),
    ...l.pros.map((p) => `${p.first_name} ${p.last_name ?? ''}`),
  ]
    .join(' ')
    .toLowerCase();
  return words.every((w) => haystack.includes(w));
}

export type SalonResult = SalonListing & { distance: number | null; fromPriceCents: number | null };

/** Filters and sorts the salons for the results list. `origin` is the customer's location (null = unknown). */
export function search(listings: SalonListing[], f: SearchFilters, origin: LatLng | null, now: Date = new Date()): SalonResult[] {
  const results: SalonResult[] = [];
  for (const l of listings) {
    const services = matchingServices(l, f.categories);
    if (!services.length) continue;
    if (!matchesQuery(l, f.query)) continue;
    if (!openOn(l, f.when, now)) continue;
    const inRange = services.filter(
      (s) => (f.priceMin === null || s.price_cents >= f.priceMin) && (f.priceMax === null || s.price_cents <= f.priceMax),
    );
    if (!inRange.length) continue;
    const { lat, lng } = l.business;
    results.push({
      ...l,
      distance: origin && lat !== null && lng !== null ? distanceMiles(origin, { lat, lng }) : null,
      fromPriceCents: Math.min(...inRange.map((s) => s.price_cents)),
    });
  }
  const far = Number.POSITIVE_INFINITY;
  const byName = (a: SalonResult, b: SalonResult) => a.business.name.localeCompare(b.business.name);
  const sorters: Record<SortKey, (a: SalonResult, b: SalonResult) => number> = {
    nearest: (a, b) => (a.distance ?? far) - (b.distance ?? far) || byName(a, b),
    top: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.reviewCount - a.reviewCount || byName(a, b),
    price: (a, b) => (a.fromPriceCents ?? far) - (b.fromPriceCents ?? far) || byName(a, b),
  };
  return results.sort(sorters[f.sort]);
}

/** Header line on Explore: "Haircut", "Braids + 1 more", "“april”" or "All salons". */
export function resultsTitle(f: SearchFilters): string {
  if (f.query.trim()) return `“${f.query.trim()}”`;
  if (!f.categories.length) return 'All salons';
  const first = categoryName(f.categories[0]!);
  return f.categories.length === 1 ? first : `${first} + ${f.categories.length - 1} more`;
}

/** "Today", "Tomorrow", "Thu, Dec 24" or "Any day" (Explore subtitle). */
export function whenLabel(when: When, formatDay: (iso: string) => string): string {
  if (when === 'any') return 'Any day';
  if (when === 'today') return 'Today';
  if (when === 'tomorrow') return 'Tomorrow';
  return formatDay(when.date);
}

/** How many filters differ from the defaults (badge on the Filters button). */
export function activeFilterCount(f: SearchFilters): number {
  return (
    (f.categories.length ? 1 : 0) + (f.when !== 'any' ? 1 : 0) + (f.priceMin !== null || f.priceMax !== null ? 1 : 0) + (f.sort !== 'nearest' ? 1 : 0)
  );
}
