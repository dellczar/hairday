import { addDemoSalons, SEED_SALON_IDS } from '../demoSeed';
import {
  activeFilterCount,
  averageRating,
  buildListings,
  DEFAULT_FILTERS,
  fromPrice,
  openOn,
  resultsTitle,
  search,
  type SalonListing,
} from '../discovery';
import { distanceMiles, formatMiles, NEW_YORK } from '../geo';
import { formatHour, openStatus, weeklyHours, zonedClock } from '../hours';
import type { TableName, Tables } from '../types';

// The 3 sample salons, loaded the same way the app loads them.
function sampleListings(): SalonListing[] {
  const store: { [K in TableName]?: Tables[K][] } = {};
  addDemoSalons(store, new Date('2026-11-15T12:00:00Z'));
  return buildListings({
    businesses: store.businesses ?? [],
    photos: store.business_photos ?? [],
    hours: store.business_hours ?? [],
    services: store.services ?? [],
    categories: store.categories ?? [],
    pros: store.professionals ?? [],
    reviews: store.public_reviews ?? [],
  });
}

// Times in New York (EST, UTC−5 in November).
const tuesdayNoon = new Date('2026-11-17T17:00:00Z'); // Tue 12:00 PM
const sundayNoon = new Date('2026-11-15T17:00:00Z'); // Sun 12:00 PM
const mondayNight = new Date('2026-11-16T02:30:00Z'); // Sun 9:30 PM

describe('salon clock', () => {
  it('reads the weekday and time on the salon’s clock, not the phone’s', () => {
    expect(zonedClock(tuesdayNoon, 'America/New_York')).toEqual({ weekday: 2, minutes: 720, date: '2026-11-17' });
    expect(zonedClock(mondayNight, 'America/New_York')).toEqual({ weekday: 0, minutes: 21 * 60 + 30, date: '2026-11-15' });
  });
  it('drops ":00" in short hours', () => {
    expect(formatHour(20 * 60)).toBe('8 PM');
    expect(formatHour(10 * 60 + 30)).toBe('10:30 AM');
  });
});

describe('open status', () => {
  const hours = [
    { weekday: 2, opens_at: '10:00', closes_at: '13:00' },
    { weekday: 2, opens_at: '14:00', closes_at: '19:00' },
    { weekday: 3, opens_at: '10:00', closes_at: '19:00' },
  ];
  const tz = 'America/New_York';
  it('says when it closes while open', () => {
    expect(openStatus(hours, new Date('2026-11-17T16:00:00Z'), tz)).toEqual({ open: true, label: 'Open until 1 PM' });
  });
  it('handles a lunch gap (two rows on one day)', () => {
    expect(openStatus(hours, new Date('2026-11-17T18:30:00Z'), tz)).toEqual({ open: false, label: 'Opens at 2 PM' });
  });
  it('points to tomorrow after closing', () => {
    expect(openStatus(hours, new Date('2026-11-18T01:00:00Z'), tz).label).toBe('Opens tomorrow 10 AM');
  });
  it('names the day when it’s further away', () => {
    expect(openStatus(hours, new Date('2026-11-19T17:00:00Z'), tz).label).toBe('Opens Tue 10 AM');
  });
  it('copes with no hours at all', () => {
    expect(openStatus([], tuesdayNoon, tz).label).toBe('Hours not set');
  });
  it('lists the week Monday first', () => {
    const week = weeklyHours(hours);
    expect(week[0]).toEqual({ day: 'Monday', text: 'Closed' });
    expect(week[1]).toEqual({ day: 'Tuesday', text: '10:00 AM – 1:00 PM, 2:00 – 7:00 PM' });
  });
});

describe('distance', () => {
  it('measures miles between two points', () => {
    // Union Square → Lisa's Salon (West Village) is a bit over a mile.
    const d = distanceMiles(NEW_YORK, { lat: 40.7295, lng: -74.0028 });
    expect(d).toBeGreaterThan(0.6);
    expect(d).toBeLessThan(1);
    expect(formatMiles(0.43)).toBe('0.4 mi');
    expect(formatMiles(12.6)).toBe('13 mi');
    expect(formatMiles(0.01)).toBe('0.1 mi');
  });
});

describe('search', () => {
  const all = sampleListings();
  const names = (r: { business: { name: string } }[]) => r.map((x) => x.business.name);

  it('shows every salon by default, nearest first', () => {
    const r = search(all, DEFAULT_FILTERS, NEW_YORK, tuesdayNoon);
    expect(names(r)).toEqual(['Lisa’s Salon', 'Crown & Coil', 'Harlem Fade Co.']);
    expect(r[0]!.distance).toBeLessThan(r[1]!.distance!);
  });

  it('filters by service and prices from the cheapest matching service', () => {
    const r = search(all, { ...DEFAULT_FILTERS, categories: ['braids'] }, NEW_YORK, tuesdayNoon);
    expect(names(r)).toEqual(['Crown & Coil']);
    expect(r[0]!.fromPriceCents).toBe(9000); // stitch cornrows, not the $220 knotless
  });

  it('matches any of several services', () => {
    expect(names(search(all, { ...DEFAULT_FILTERS, categories: ['braids', 'barber'] }, NEW_YORK, tuesdayNoon))).toEqual([
      'Crown & Coil',
      'Harlem Fade Co.',
    ]);
  });

  it('returns nothing for a service no salon offers', () => {
    expect(search(all, { ...DEFAULT_FILTERS, categories: ['nails'] }, NEW_YORK, tuesdayNoon)).toEqual([]);
  });

  it('keeps salons with a service inside the price range', () => {
    const r = search(all, { ...DEFAULT_FILTERS, priceMax: 3000 }, NEW_YORK, tuesdayNoon);
    expect(names(r)).toEqual(['Harlem Fade Co.']);
    expect(r[0]!.fromPriceCents).toBe(2500);
    expect(names(search(all, { ...DEFAULT_FILTERS, priceMin: 20000 }, NEW_YORK, tuesdayNoon))).toEqual(['Crown & Coil']);
  });

  it('hides salons closed on the chosen day', () => {
    // Sunday: only Harlem Fade Co. opens. Lisa's is Tue–Sat, Crown & Coil Mon–Sat.
    expect(names(search(all, { ...DEFAULT_FILTERS, when: 'today' }, NEW_YORK, sundayNoon))).toEqual(['Harlem Fade Co.']);
    expect(names(search(all, { ...DEFAULT_FILTERS, when: 'tomorrow' }, NEW_YORK, sundayNoon))).toEqual(['Crown & Coil', 'Harlem Fade Co.']);
    expect(names(search(all, { ...DEFAULT_FILTERS, when: { date: '2026-11-17' } }, NEW_YORK, sundayNoon))).toHaveLength(3);
  });

  it('hides salons that already closed today', () => {
    // Sunday 9:30 PM: Harlem Fade closed at 9.
    expect(search(all, { ...DEFAULT_FILTERS, when: 'today' }, NEW_YORK, mondayNight)).toEqual([]);
  });

  it('searches names, services and professionals', () => {
    expect(names(search(all, { ...DEFAULT_FILTERS, query: 'fade' }, NEW_YORK, tuesdayNoon))).toEqual(['Harlem Fade Co.']);
    expect(names(search(all, { ...DEFAULT_FILTERS, query: 'Amara' }, NEW_YORK, tuesdayNoon))).toEqual(['Crown & Coil']);
    expect(names(search(all, { ...DEFAULT_FILTERS, query: 'blowout' }, NEW_YORK, tuesdayNoon))).toEqual(['Lisa’s Salon']);
    expect(search(all, { ...DEFAULT_FILTERS, query: 'pedicure' }, NEW_YORK, tuesdayNoon)).toEqual([]);
  });

  it('sorts by rating and by price', () => {
    expect(names(search(all, { ...DEFAULT_FILTERS, sort: 'top' }, NEW_YORK, tuesdayNoon))[0]).toBe('Crown & Coil'); // 5.0 from 2 reviews
    expect(names(search(all, { ...DEFAULT_FILTERS, sort: 'price' }, NEW_YORK, tuesdayNoon))).toEqual([
      'Harlem Fade Co.',
      'Lisa’s Salon',
      'Crown & Coil',
    ]);
  });

  it('still lists salons when the location is unknown', () => {
    const r = search(all, DEFAULT_FILTERS, null, tuesdayNoon);
    expect(r).toHaveLength(3);
    expect(r.every((x) => x.distance === null)).toBe(true);
  });

  it('works out a salon’s lowest price', () => {
    const lisa = all.find((l) => l.business.id === SEED_SALON_IDS.lisa)!;
    expect(fromPrice(lisa, [])).toBe(5500);
    expect(openOn(lisa, 'any', tuesdayNoon)).toBe(true);
  });
});

describe('labels', () => {
  it('names the results', () => {
    expect(resultsTitle(DEFAULT_FILTERS)).toBe('All salons');
    expect(resultsTitle({ ...DEFAULT_FILTERS, categories: ['haircut'] })).toBe('Haircut');
    expect(resultsTitle({ ...DEFAULT_FILTERS, categories: ['haircut', 'color'] })).toBe('Haircut + 1 more');
    expect(resultsTitle({ ...DEFAULT_FILTERS, query: ' april ' })).toBe('“april”');
  });
  it('counts filters in use', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, categories: ['haircut', 'color'], when: 'today', priceMax: 5000 })).toBe(3);
  });
  it('averages ratings to one decimal', () => {
    expect(averageRating([5, 5, 4])).toBe(4.7);
    expect(averageRating([])).toBeNull();
  });
});
