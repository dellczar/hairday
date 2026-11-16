// Which start times can a customer book? (SPEC §8)
//
// Free time for a professional on a date =
//   their weekly availability ∩ the salon's opening hours − breaks − time off − live bookings.
// A start time is offered only if the whole duration fits inside one free stretch, it's on the
// 15-minute grid, and it's at least an hour from now. Everything is worked out on the salon's
// clock, so daylight-saving days (23 or 25 hours long) come out right.
//
// The database checks the same rules again when a time is held (create_hold in
// supabase/migrations/20261116000000_booking.sql), so a stale screen can never book a bad time.

import { toMinutes, zonedClock, zonedTimeToUtc } from './hours';

type Hours = { weekday: number; opens_at: string; closes_at: string };
type Window = { weekday: number; starts_at: string; ends_at: string };
type BreakRow = { weekday: number | null; starts_at: string; ends_at: string };
/** Anything with a start and end instant: a booking, a hold, time off. */
type Busy = { starts_at: string; ends_at: string };

export type ProSchedule = {
  id: string;
  availability: Window[];
  breaks: BreakRow[];
  timeOff: Busy[];
  /** Confirmed bookings and unexpired holds. */
  bookings: Busy[];
};

export type Period = 'morning' | 'afternoon' | 'evening';

export type Slot = {
  /** ISO instant the appointment starts. */
  start: string;
  /** Minutes after midnight on the salon's clock (for labels and grouping). */
  minutes: number;
  period: Period;
  /** Who would do it. null when the time is shown crossed out. */
  proId: string | null;
  /** Within working hours, but already taken — shown crossed out (Book.html). */
  booked: boolean;
};

export type SlotQuery = {
  /** The salon's calendar day, 'YYYY-MM-DD'. */
  date: string;
  timeZone: string;
  now: Date;
  /** Total length of the chosen services. */
  durationMin: number;
  businessHours: Hours[];
  /** Professionals who offer every chosen service. */
  pros: ProSchedule[];
  /** One professional, or 'any' (SPEC: "Anyone"). */
  proId: string | 'any';
  /** Earliest start, in minutes from now. */
  leadMin?: number;
  step?: number;
};

type Range = [number, number]; // minutes on the salon's clock, end exclusive

/** a ∩ b for two lists of non-overlapping ranges. */
function intersect(a: Range[], b: Range[]): Range[] {
  const out: Range[] = [];
  for (const [a1, a2] of a) for (const [b1, b2] of b) if (Math.max(a1, b1) < Math.min(a2, b2)) out.push([Math.max(a1, b1), Math.min(a2, b2)]);
  return out;
}

/** ranges − cut. */
function subtract(ranges: Range[], cut: Range[]): Range[] {
  let cur = ranges;
  for (const [c1, c2] of cut) {
    const next: Range[] = [];
    for (const [r1, r2] of cur) {
      if (c2 <= r1 || c1 >= r2) next.push([r1, r2]);
      else {
        if (c1 > r1) next.push([r1, c1]);
        if (c2 < r2) next.push([c2, r2]);
      }
    }
    cur = next;
  }
  return cur;
}

const DAY = 24 * 60;

/** Instant ranges (time off, bookings) as minutes on this salon day; may start below 0 or end past 24 h. */
function toDayRanges(items: Busy[], dayStart: Date, timeZone: string, date: string): Range[] {
  const dayStartMs = dayStart.getTime();
  return items.map((b) => {
    const s = new Date(b.starts_at);
    const e = new Date(b.ends_at);
    return [localMinutes(s, dayStartMs, timeZone, date), localMinutes(e, dayStartMs, timeZone, date)] as Range;
  });
}

/** Wall-clock minutes of an instant relative to the given salon day (negative = the day before). */
function localMinutes(at: Date, dayStartMs: number, timeZone: string, date: string): number {
  const c = zonedClock(at, timeZone);
  if (c.date === date) return c.minutes;
  return at.getTime() < dayStartMs ? -1 : DAY + 1;
}

function periodOf(min: number): Period {
  if (min < 12 * 60) return 'morning';
  if (min < 17 * 60) return 'afternoon';
  return 'evening';
}

/** Where a professional can work that day, before bookings: their hours ∩ salon hours − breaks − time off. */
function workingRanges(pro: ProSchedule, weekday: number, salon: Range[], dayStart: Date, q: DayQuery): Range[] {
  const own = pro.availability.filter((a) => a.weekday === weekday).map((a) => [toMinutes(a.starts_at), toMinutes(a.ends_at)] as Range);
  const breaks = pro.breaks
    .filter((b) => b.weekday === null || b.weekday === weekday)
    .map((b) => [toMinutes(b.starts_at), toMinutes(b.ends_at)] as Range);
  return subtract(subtract(intersect(own, salon), breaks), toDayRanges(pro.timeOff, dayStart, q.timeZone, q.date));
}

const fits = (ranges: Range[], start: number, end: number) => ranges.some(([a, b]) => start >= a && end <= b);

export type DayQuery = Pick<SlotQuery, 'date' | 'timeZone' | 'businessHours' | 'pros'>;

export type ProDay = {
  id: string;
  /** Minutes on the salon's clock when they can work: their hours ∩ salon hours − breaks − time off. */
  working: [number, number][];
  /** working − bookings: the gaps that are still open. */
  free: [number, number][];
  /** Bookings that day (for "Anyone", SPEC §8). */
  load: number;
};

/** Who can work when on one salon day, and what's still open. Empty when the salon is closed. */
export function dayPlan(q: DayQuery): { open: [number, number][]; pros: ProDay[] } {
  const dayStart = zonedTimeToUtc(q.date, 0, q.timeZone);
  const weekday = zonedClock(new Date(dayStart.getTime() + 12 * 3_600_000), q.timeZone).weekday; // noon is safely inside the day
  const salon = q.businessHours.filter((h) => h.weekday === weekday).map((h) => [toMinutes(h.opens_at), toMinutes(h.closes_at)] as Range);
  if (!salon.length) return { open: [], pros: [] }; // closed that day
  const pros = q.pros.map((pro) => {
    const working = workingRanges(pro, weekday, salon, dayStart, q);
    const taken = toDayRanges(pro.bookings, dayStart, q.timeZone, q.date);
    const load = taken.filter(([a, b]) => b > 0 && a < DAY).length;
    return { id: pro.id, working, free: subtract(working, taken), load };
  });
  return { open: salon, pros };
}

/** Every bookable (and crossed-out) start time for one day. */
export function getAvailableSlots(q: SlotQuery): Slot[] {
  const step = q.step ?? 15;
  const lead = q.leadMin ?? 60;
  if (q.durationMin <= 0) return [];
  const day = dayPlan({ ...q, pros: q.proId === 'any' ? q.pros : q.pros.filter((p) => p.id === q.proId) });
  const salon = day.open;
  if (!salon.length) return []; // closed that day

  // "Anyone" goes to whoever has the fewest bookings that day (SPEC §8).
  const plans = day.pros.map((p) => ({ pro: { id: p.id }, working: p.working, free: p.free, load: p.load }));
  plans.sort((a, b) => a.load - b.load || a.pro.id.localeCompare(b.pro.id));

  const earliest = q.now.getTime() + lead * 60_000;
  const slots: Slot[] = [];
  const first = Math.min(...salon.map(([a]) => a));
  const last = Math.max(...salon.map(([, b]) => b));
  for (let m = Math.ceil(first / step) * step; m + q.durationMin <= last; m += step) {
    const startAt = zonedTimeToUtc(q.date, m, q.timeZone);
    // Skip wall-clock times that don't exist (the hour clocks jump forward) and anything too soon.
    if (zonedClock(startAt, q.timeZone).minutes !== m || startAt.getTime() < earliest) continue;
    const end = m + q.durationMin;
    const freePro = plans.find((p) => fits(p.free, m, end));
    if (freePro) slots.push({ start: startAt.toISOString(), minutes: m, period: periodOf(m), proId: freePro.pro.id, booked: false });
    else if (plans.some((p) => fits(p.working, m, end)))
      slots.push({ start: startAt.toISOString(), minutes: m, period: periodOf(m), proId: null, booked: true });
  }
  return slots;
}

/** Slots split into Morning / Afternoon / Evening, skipping empty groups. */
export function groupSlots(slots: Slot[]): { period: Period; label: string; slots: Slot[] }[] {
  const labels: Record<Period, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
  return (['morning', 'afternoon', 'evening'] as Period[])
    .map((period) => ({ period, label: labels[period], slots: slots.filter((s) => s.period === period) }))
    .filter((g) => g.slots.length);
}

/** Only holds younger than this still block a time (SPEC §9: released after 10 minutes). */
export const HOLD_MINUTES = 10;

/** Bookings that still block time: confirmed ones, and holds that haven't run out. */
export function isLive(b: { status: string; created_at: string }, now: Date = new Date()): boolean {
  if (b.status === 'confirmed') return true;
  return b.status === 'pending_payment' && now.getTime() - new Date(b.created_at).getTime() < HOLD_MINUTES * 60_000;
}
