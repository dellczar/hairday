// Times of day, weekdays and durations for owner schedules.
// Weekdays follow Postgres: 0 = Sunday … 6 = Saturday. Screens list Monday first, like the designs.

export type DayInfo = { weekday: number; short: string; full: string };

export const WEEK: DayInfo[] = [
  { weekday: 1, short: 'M', full: 'Monday' },
  { weekday: 2, short: 'T', full: 'Tuesday' },
  { weekday: 3, short: 'W', full: 'Wednesday' },
  { weekday: 4, short: 'T', full: 'Thursday' },
  { weekday: 5, short: 'F', full: 'Friday' },
  { weekday: 6, short: 'S', full: 'Saturday' },
  { weekday: 0, short: 'S', full: 'Sunday' },
];

/** '13:30' or '13:30:00' → 810 (minutes after midnight). */
export function toMinutes(time: string): number {
  const [h = '0', m = '0'] = time.split(':');
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

/** 810 → '13:30' (what we save to Postgres). */
export function fromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parts(min: number) {
  const h24 = Math.floor(min / 60) % 24;
  const m = min % 60;
  const period = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { clock: `${h12}:${String(m).padStart(2, '0')}`, period };
}

/** 810 or '13:30' → '1:30 PM'. */
export function formatTime(t: number | string): string {
  const p = parts(typeof t === 'number' ? t : toMinutes(t));
  return `${p.clock} ${p.period}`;
}

/** '10:00 AM – 8:00 PM', or '1:00 – 1:30 PM' when both ends share AM/PM (Availability.html). */
export function formatRange(start: number | string, end: number | string): string {
  const a = parts(typeof start === 'number' ? start : toMinutes(start));
  const b = parts(typeof end === 'number' ? end : toMinutes(end));
  return a.period === b.period ? `${a.clock} – ${b.clock} ${b.period}` : `${a.clock} ${a.period} – ${b.clock} ${b.period}`;
}

/** 45 → '45 min', 60 → '1 hr', 90 → '1 hr 30 min' (Services.html). */
export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** Times offered in pickers: every 15 minutes from 5:00 AM to 11:45 PM. */
export function timeOptions(step = 15, from = 5 * 60, to = 23 * 60 + 45): number[] {
  const out: number[] = [];
  for (let m = from; m <= to; m += step) out.push(m);
  return out;
}

/** 'Open 5 days a week. You can change this any time.' (Setup.html) */
export function openSummary(daysOpen: number, hours?: string): string {
  const when = hours ? `, ${hours}` : '';
  return `Open ${daysOpen} ${daysOpen === 1 ? 'day' : 'days'} a week${when}. You can change this any time.`;
}

/** Durations must be 15 min – 8 hr in 15-minute steps (database rule). */
export function clampDuration(min: number): number {
  return Math.min(480, Math.max(15, Math.round(min / 15) * 15));
}

/**
 * The moment a calendar day starts in a time zone, as an ISO string.
 * zonedDayStart('2026-03-08', 'America/New_York') → '2026-03-08T05:00:00.000Z'.
 * Used for whole-day time off, so it lines up with the salon's clock (not the phone's).
 */
export function zonedDayStart(date: string, timeZone: string): string {
  const [y, mo, d] = date.split('-').map((n) => parseInt(n, 10)) as [number, number, number];
  const utcGuess = Date.UTC(y, mo - 1, d, 0, 0, 0);
  // Offset of the zone at that instant, then correct once more in case the guess crossed a DST change.
  const offset = (t: number) => {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(t));
    const get = (type: string) => parseInt(f.find((p) => p.type === type)?.value ?? '0', 10);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return asUtc - t;
  };
  let t = utcGuess - offset(utcGuess);
  t = utcGuess - offset(t);
  return new Date(t).toISOString();
}

/** 'YYYY-MM-DD' for a Date, using its local calendar day. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** '2026-12-24' → 'Thu, Dec 24'. */
export function formatDay(date: string): string {
  const [y, m, d] = date.split('-').map((n) => parseInt(n, 10)) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Add whole days to 'YYYY-MM-DD'. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map((n) => parseInt(n, 10)) as [number, number, number];
  return isoDate(new Date(y, m - 1, d + days));
}
