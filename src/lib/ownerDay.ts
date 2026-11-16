// The owner's day (OwnerToday.html, Calendar.html): who's booked, where the gaps are, and the three
// numbers at the top. Pure functions so they can be tested without a phone.

import { dayPlan, getAvailableSlots, type ProSchedule } from './availability';
import { addDays, zonedClock, zonedTimeToUtc } from './hours';

type Hours = { weekday: number; opens_at: string; closes_at: string };

/** A booking as the owner sees it. */
export type DayBooking = {
  id: string;
  professional_id: string;
  client_id: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
};

export type TimelineRow =
  | { kind: 'booking'; start: number; end: number; proId: string; booking: DayBooking }
  | { kind: 'open'; start: number; end: number; proId: string };

/** Gaps shorter than this aren't worth a walk-in. */
export const MIN_GAP = 30;

/** Bookings that take up time (not cancelled ones). */
export const isActive = (b: { status: string }) => b.status === 'confirmed' || b.status === 'completed' || b.status === 'no_show';

/**
 * Today's list: bookings and open gaps (at least MIN_GAP long, and not already over), in time order.
 * `proIds` limits it to some of the team (the staff chips).
 */
export function timeline(args: {
  date: string;
  timeZone: string;
  now: Date;
  businessHours: Hours[];
  pros: ProSchedule[];
  bookings: DayBooking[];
  proIds?: string[];
}): TimelineRow[] {
  const { date, timeZone, now } = args;
  // Each person's time is blocked by the bookings passed in (whatever their schedule already listed).
  const pros = (args.proIds ? args.pros.filter((p) => args.proIds!.includes(p.id)) : args.pros).map((p) => ({
    ...p,
    bookings: [...p.bookings, ...args.bookings.filter((b) => b.professional_id === p.id && isActive(b))],
  }));
  const plan = dayPlan({ date, timeZone, businessHours: args.businessHours, pros });
  const nowClock = zonedClock(now, timeZone);
  const nowMin = nowClock.date === date ? nowClock.minutes : nowClock.date > date ? 24 * 60 : 0;

  const rows: TimelineRow[] = [];
  for (const b of args.bookings) {
    if (!isActive(b) || !pros.some((p) => p.id === b.professional_id)) continue;
    const s = zonedClock(new Date(b.starts_at), timeZone);
    if (s.date !== date) continue;
    const e = zonedClock(new Date(b.ends_at), timeZone);
    rows.push({ kind: 'booking', start: s.minutes, end: e.date === date ? e.minutes : 24 * 60, proId: b.professional_id, booking: b });
  }
  for (const p of plan.pros) {
    for (const [a, z] of p.free) {
      const start = Math.max(a, Math.ceil(nowMin / 15) * 15);
      if (z - start >= MIN_GAP) rows.push({ kind: 'open', start, end: z, proId: p.id });
    }
  }
  return rows.sort((x, y) => x.start - y.start || (x.kind === 'booking' ? -1 : 1) || x.proId.localeCompare(y.proId));
}

/** The three numbers on Today: bookings, open slots, and clients visiting for the first time. */
export function dayStats(rows: TimelineRow[], firstVisit: (b: DayBooking) => boolean) {
  const bookings = rows.filter((r): r is Extract<TimelineRow, { kind: 'booking' }> => r.kind === 'booking');
  return {
    bookings: bookings.length,
    openSlots: rows.filter((r) => r.kind === 'open').length,
    newClients: bookings.filter((r) => firstVisit(r.booking)).length,
  };
}

/**
 * Is this booking the client's first visit here? `history` is every booking of this salon.
 * Walk-ins with no client never count as new.
 */
export function isFirstVisit(b: DayBooking, history: DayBooking[]): boolean {
  if (!b.client_id) return false;
  return !history.some((h) => h.id !== b.id && h.client_id === b.client_id && isActive(h) && h.starts_at < b.starts_at);
}

/**
 * Walk-in sheet → "Next open times": the first few free starts for this service and person, from now
 * (no lead time: the client is standing there) over the next 8 days (so the same weekday next week counts).
 */
export function nextOpenTimes(args: {
  from: Date;
  timeZone: string;
  durationMin: number;
  businessHours: Hours[];
  pro: ProSchedule;
  count?: number;
  days?: number;
}): { start: string; date: string; minutes: number }[] {
  const out: { start: string; date: string; minutes: number }[] = [];
  const first = zonedClock(args.from, args.timeZone).date;
  for (let d = 0; d < (args.days ?? 8) && out.length < (args.count ?? 4); d++) {
    const date = addDays(first, d);
    const slots = getAvailableSlots({
      date,
      timeZone: args.timeZone,
      now: args.from,
      durationMin: args.durationMin,
      businessHours: args.businessHours,
      pros: [args.pro],
      proId: args.pro.id,
      leadMin: 0,
    });
    for (const s of slots) {
      if (s.booked) continue;
      out.push({ start: s.start, date, minutes: s.minutes });
      if (out.length >= (args.count ?? 4)) break;
    }
  }
  return out;
}

/** "Open · 45 min" */
export function gapLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** The start of a salon day as an ISO instant, and the start of the next one (for loading bookings). */
export function dayBounds(date: string, timeZone: string): { from: string; to: string } {
  return { from: zonedTimeToUtc(date, 0, timeZone).toISOString(), to: zonedTimeToUtc(addDays(date, 1), 0, timeZone).toISOString() };
}

/** Clients A–Z with "6 visits · last Nov 14" (Clients.html). Visits are appointments that happened. */
export function clientSummaries<C extends { id: string; name: string; phone: string | null }>(
  clients: C[],
  bookings: { client_id: string | null; starts_at: string; ends_at: string; status: string }[],
  now: Date,
  timeZone: string,
): { client: C; visits: number; last: string | null; next: string | null; meta: string }[] {
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone, month: 'short', day: 'numeric' });
  return clients
    .map((client) => {
      const mine = bookings.filter((b) => b.client_id === client.id);
      const past = mine
        .filter((b) => (b.status === 'completed' || b.status === 'confirmed') && new Date(b.ends_at) <= now)
        .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
      const next = mine
        .filter((b) => b.status === 'confirmed' && new Date(b.starts_at) > now)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
      const last = past[0]?.starts_at ?? null;
      const parts = [
        past.length ? `${past.length} ${past.length === 1 ? 'visit' : 'visits'} · last ${day(last!)}` : next ? null : 'No visits yet',
        next ? `next ${day(next.starts_at)}` : null,
      ].filter(Boolean);
      const meta = parts.join(' · ') || client.phone || '';
      return { client, visits: past.length, last, next: next?.starts_at ?? null, meta: meta || 'No visits yet' };
    })
    .sort((a, b) => a.client.name.localeCompare(b.client.name, 'en', { sensitivity: 'base' }));
}
