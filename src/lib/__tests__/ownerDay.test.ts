import type { ProSchedule } from '../availability';
import { dayStats, gapLabel, isFirstVisit, nextOpenTimes, timeline, type DayBooking } from '../ownerDay';

// Tuesday 2026-11-17 in New York (UTC−5). Salon open 10–7; April works 10–7 with lunch 1–1:30.
const TZ = 'America/New_York';
const DATE = '2026-11-17';
const hours = [{ weekday: 2, opens_at: '10:00', closes_at: '19:00' }];
const ny = (hhmm: string) => new Date(`${DATE}T${hhmm}:00-05:00`).toISOString();

const april: ProSchedule = {
  id: 'april',
  availability: [{ weekday: 2, starts_at: '10:00', ends_at: '19:00' }],
  breaks: [{ weekday: null, starts_at: '13:00', ends_at: '13:30' }],
  timeOff: [],
  bookings: [],
};
const jun: ProSchedule = { ...april, id: 'jun', availability: [{ weekday: 2, starts_at: '12:00', ends_at: '16:00' }], breaks: [] };

const b = (id: string, pro: string, from: string, to: string, client: string | null = null, status = 'confirmed'): DayBooking => ({
  id,
  professional_id: pro,
  client_id: client,
  starts_at: ny(from),
  ends_at: ny(to),
  status,
});

describe('owner day timeline', () => {
  const morning = new Date(`${DATE}T08:00:00-05:00`);

  it('lists bookings and the open gaps around them, skipping breaks', () => {
    const bookings = [b('1', 'april', '10:00', '10:30', 'dana'), b('2', 'april', '15:00', '16:00')];
    const rows = timeline({ date: DATE, timeZone: TZ, now: morning, businessHours: hours, pros: [april], bookings });
    expect(rows.map((r) => [r.kind, r.start, r.end])).toEqual([
      ['booking', 600, 630],
      ['open', 630, 780], // 10:30–1:00, then lunch
      ['open', 810, 900], // 1:30–3:00
      ['booking', 900, 960],
      ['open', 960, 1140], // 4:00–7:00
    ]);
  });

  it('leaves out gaps shorter than 30 minutes and cancelled bookings', () => {
    const bookings = [
      b('1', 'april', '10:00', '12:45'),
      b('2', 'april', '13:30', '19:00'),
      b('3', 'april', '10:00', '11:00', null, 'cancelled'),
    ];
    const rows = timeline({ date: DATE, timeZone: TZ, now: morning, businessHours: hours, pros: [april], bookings });
    expect(rows.filter((r) => r.kind === 'open')).toEqual([]); // 12:45–1:00 is only 15 minutes
    expect(rows.filter((r) => r.kind === 'booking')).toHaveLength(2);
  });

  it('doesn’t offer time that has already gone by', () => {
    const at2pm = new Date(`${DATE}T14:05:00-05:00`);
    const rows = timeline({ date: DATE, timeZone: TZ, now: at2pm, businessHours: hours, pros: [april], bookings: [] });
    expect(rows).toEqual([{ kind: 'open', start: 855, end: 1140, proId: 'april' }]); // from 2:15
  });

  it('filters by the staff chips', () => {
    const rows = timeline({
      date: DATE,
      timeZone: TZ,
      now: morning,
      businessHours: hours,
      pros: [april, jun],
      bookings: [],
      proIds: ['jun'],
    });
    expect(rows).toEqual([{ kind: 'open', start: 720, end: 960, proId: 'jun' }]);
  });

  it('is empty on a day the salon is closed', () => {
    const monday = '2026-11-16';
    expect(timeline({ date: monday, timeZone: TZ, now: morning, businessHours: hours, pros: [april], bookings: [] })).toEqual([]);
  });

  it('counts bookings, open slots and first-time clients', () => {
    const history = [
      b('old', 'april', '10:00', '10:30', 'dana'),
      b('1', 'april', '10:00', '10:30', 'dana'),
      b('2', 'april', '15:00', '16:00', 'anna'),
    ];
    history[0]!.starts_at = '2026-10-01T14:00:00.000Z';
    const rows = timeline({ date: DATE, timeZone: TZ, now: morning, businessHours: hours, pros: [april], bookings: history });
    expect(dayStats(rows, (x) => isFirstVisit(x, history))).toEqual({ bookings: 2, openSlots: 3, newClients: 1 });
  });
});

describe('walk-in times', () => {
  it('suggests the next free starts from now, with no hour of notice', () => {
    const at1015 = new Date(`${DATE}T10:15:00-05:00`);
    const pro = { ...april, bookings: [b('1', 'april', '10:30', '11:30')] };
    const times = nextOpenTimes({ from: at1015, timeZone: TZ, durationMin: 30, businessHours: hours, pro });
    expect(times.map((t) => t.minutes)).toEqual([690, 705, 720, 735]); // 11:30, 11:45, 12:00, 12:15
  });

  it('moves to the next open day when today is full', () => {
    const late = new Date(`${DATE}T18:50:00-05:00`);
    const times = nextOpenTimes({ from: late, timeZone: TZ, durationMin: 30, businessHours: hours, pro: april, count: 1 });
    expect(times[0]!.date).toBe('2026-11-24'); // the salon is open Tuesdays only in this test
  });

  it('labels gaps the way people say them', () => {
    expect(gapLabel(45)).toBe('45 min');
    expect(gapLabel(60)).toBe('1 hr');
    expect(gapLabel(150)).toBe('2 hr 30 min');
  });
});

describe('client list', () => {
  const { clientSummaries } = jest.requireActual('../ownerDay') as typeof import('../ownerDay');
  const now = new Date('2026-11-17T20:00:00Z');
  const clients = [
    { id: 'z', name: 'zoe Park', phone: null },
    { id: 'a', name: 'Anna Doyle', phone: '(212) 555-0123' },
    { id: 'n', name: 'Nia Brooks', phone: '(212) 555-0199' },
  ];
  const bookings = [
    { client_id: 'a', starts_at: '2026-11-03T15:00:00Z', ends_at: '2026-11-03T16:00:00Z', status: 'completed' },
    { client_id: 'a', starts_at: '2026-11-14T15:00:00Z', ends_at: '2026-11-14T16:00:00Z', status: 'confirmed' },
    { client_id: 'a', starts_at: '2026-11-10T15:00:00Z', ends_at: '2026-11-10T16:00:00Z', status: 'no_show' },
    { client_id: 'z', starts_at: '2026-11-20T15:00:00Z', ends_at: '2026-11-20T16:00:00Z', status: 'confirmed' },
  ];

  it('sorts A–Z and counts only visits that happened', () => {
    const list = clientSummaries(clients, bookings, now, 'America/New_York');
    expect(list.map((c) => c.client.id)).toEqual(['a', 'n', 'z']);
    expect(list[0]).toMatchObject({ visits: 2, meta: '2 visits · last Nov 14' });
    expect(list[1]!.meta).toBe('No visits yet');
    expect(list[2]!.meta).toBe('next Nov 20');
  });
});
