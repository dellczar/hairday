import { getAvailableSlots, groupSlots, isLive, type ProSchedule, type SlotQuery } from '../availability';
import { formatTime } from '../hours';

const TZ = 'America/New_York';
// Tuesday 2026-11-17 (EST, UTC−5). "now" is the Monday before, so nothing is too soon.
const DATE = '2026-11-17';
const MONDAY = new Date('2026-11-16T15:00:00Z');

const tuesdayHours = [{ weekday: 2, opens_at: '10:00', closes_at: '19:00' }];

function pro(id: string, extra: Partial<ProSchedule> = {}): ProSchedule {
  return { id, availability: [{ weekday: 2, starts_at: '10:00', ends_at: '19:00' }], breaks: [], timeOff: [], bookings: [], ...extra };
}

function query(extra: Partial<SlotQuery> = {}): SlotQuery {
  return {
    date: DATE,
    timeZone: TZ,
    now: MONDAY,
    durationMin: 60,
    businessHours: tuesdayHours,
    pros: [pro('april')],
    proId: 'april',
    ...extra,
  };
}

const times = (q: SlotQuery, booked = false) =>
  getAvailableSlots(q)
    .filter((s) => s.booked === booked)
    .map((s) => formatTime(s.minutes));

describe('getAvailableSlots', () => {
  it('offers every 15 minutes while the whole service fits', () => {
    const t = times(query());
    expect(t[0]).toBe('10:00 AM');
    expect(t[1]).toBe('10:15 AM');
    expect(t[t.length - 1]).toBe('6:00 PM'); // a 1-hour service must end by 7
    expect(t).toHaveLength(33);
  });

  it('returns nothing on a day the salon is closed', () => {
    expect(getAvailableSlots(query({ date: '2026-11-16' }))).toEqual([]); // Monday
  });

  it('uses only hours when both the salon and the professional work', () => {
    const t = times(query({ pros: [pro('april', { availability: [{ weekday: 2, starts_at: '12:00', ends_at: '21:00' }] })] }));
    expect(t[0]).toBe('12:00 PM');
    expect(t[t.length - 1]).toBe('6:00 PM'); // salon closes at 7
  });

  it('works around breaks', () => {
    const q = query({ durationMin: 30, pros: [pro('april', { breaks: [{ weekday: null, starts_at: '13:00', ends_at: '13:30' }] })] });
    const t = times(q);
    expect(t).toContain('12:30 PM'); // ends 1:00, just before the break
    expect(t).not.toContain('12:45 PM');
    expect(t).not.toContain('1:00 PM');
    expect(t).toContain('1:30 PM');
    expect(times(q, true)).toEqual([]); // breaks are hidden, not crossed out
  });

  it('applies a weekday-only break on that weekday only', () => {
    const q = query({ pros: [pro('april', { breaks: [{ weekday: 3, starts_at: '13:00', ends_at: '14:00' }] })] });
    expect(times(q)).toContain('1:00 PM');
  });

  it('crosses out times taken by a booking in the middle of the day', () => {
    const q = query({ pros: [pro('april', { bookings: [{ starts_at: '2026-11-17T19:00:00Z', ends_at: '2026-11-17T20:00:00Z' }] })] }); // 2–3 PM
    const free = times(q);
    expect(free).toContain('1:00 PM'); // ends exactly at 2
    expect(free).not.toContain('1:15 PM');
    expect(free).not.toContain('2:00 PM');
    expect(free).toContain('3:00 PM');
    expect(times(q, true)).toEqual(['1:15 PM', '1:30 PM', '1:45 PM', '2:00 PM', '2:15 PM', '2:30 PM', '2:45 PM']);
  });

  it('skips a gap that is too short for the service', () => {
    // Free 5:00–5:45 then booked until 7: a 1-hour service can't start at 5.
    const q = query({ pros: [pro('april', { bookings: [{ starts_at: '2026-11-17T22:45:00Z', ends_at: '2026-11-18T00:00:00Z' }] })] });
    const free = times(q);
    expect(free).toContain('4:45 PM');
    expect(free).not.toContain('5:00 PM');
    expect(times(query({ durationMin: 45, pros: q.pros }))).toContain('5:00 PM');
    expect(getAvailableSlots(query({ durationMin: 600 }))).toEqual([]); // longer than the whole day
  });

  it('blocks time off that runs across midnight', () => {
    // Off from Monday 8 PM to Tuesday 1 PM.
    const q = query({ pros: [pro('april', { timeOff: [{ starts_at: '2026-11-17T01:00:00Z', ends_at: '2026-11-17T18:00:00Z' }] })] });
    const t = times(q);
    expect(t[0]).toBe('1:00 PM');
    expect(times(q, true)).toEqual([]); // time off is hidden, not crossed out
  });

  it('blocks a whole day off', () => {
    const q = query({ pros: [pro('april', { timeOff: [{ starts_at: '2026-11-17T05:00:00Z', ends_at: '2026-11-18T05:00:00Z' }] })] });
    expect(getAvailableSlots(q)).toEqual([]);
  });

  it('never offers the past or anything less than an hour away', () => {
    const now = new Date('2026-11-17T17:10:00Z'); // Tue 12:10 PM
    const t = times(query({ now }));
    expect(t[0]).toBe('1:15 PM');
  });

  describe('daylight-saving weeks', () => {
    it('spring forward (Sun Mar 8, 2026): times are on the new clock', () => {
      const q = query({
        date: '2026-03-08',
        now: new Date('2026-03-01T12:00:00Z'),
        businessHours: [{ weekday: 0, opens_at: '09:00', closes_at: '12:00' }],
        pros: [pro('april', { availability: [{ weekday: 0, starts_at: '09:00', ends_at: '12:00' }] })],
      });
      const slots = getAvailableSlots(q);
      expect(slots[0]!.start).toBe('2026-03-08T13:00:00.000Z'); // 9 AM EDT = UTC−4
      expect(formatTime(slots[0]!.minutes)).toBe('9:00 AM');
    });

    it('fall back (Sun Nov 1, 2026): times are on the new clock', () => {
      const q = query({
        date: '2026-11-01',
        now: new Date('2026-10-25T12:00:00Z'),
        businessHours: [{ weekday: 0, opens_at: '09:00', closes_at: '12:00' }],
        pros: [pro('april', { availability: [{ weekday: 0, starts_at: '09:00', ends_at: '12:00' }] })],
      });
      const slots = getAvailableSlots(q);
      expect(slots[0]!.start).toBe('2026-11-01T14:00:00.000Z'); // 9 AM EST = UTC−5
      expect(slots).toHaveLength(9); // 9:00 – 11:00 for a 1-hour service
    });

    it('the week before spring forward still uses standard time', () => {
      const q = query({ date: '2026-03-03', now: new Date('2026-03-01T12:00:00Z') }); // Tuesday
      expect(getAvailableSlots(q)[0]!.start).toBe('2026-03-03T15:00:00.000Z');
    });

    it('a booking made in summer time blocks the right wall-clock hour', () => {
      const q = query({
        date: '2026-03-10',
        now: new Date('2026-03-01T12:00:00Z'),
        pros: [pro('april', { bookings: [{ starts_at: '2026-03-10T14:00:00Z', ends_at: '2026-03-10T15:00:00Z' }] })], // 10–11 AM EDT
      });
      expect(times(q)[0]).toBe('11:00 AM');
    });
  });

  describe('Anyone', () => {
    const busyApril = pro('april', { bookings: [{ starts_at: '2026-11-17T15:00:00Z', ends_at: '2026-11-17T16:00:00Z' }] }); // 10–11
    const jun = pro('jun', { availability: [{ weekday: 2, starts_at: '14:00', ends_at: '19:00' }] });

    it('merges everyone’s times', () => {
      const t = times(query({ proId: 'any', pros: [busyApril, jun] }));
      expect(t[0]).toBe('11:00 AM'); // April's free after her booking
      expect(t).toContain('2:00 PM');
    });

    it('gives the time to whoever has the fewest bookings that day', () => {
      const slot = getAvailableSlots(query({ proId: 'any', pros: [busyApril, jun] })).find((s) => formatTime(s.minutes) === '3:00 PM');
      expect(slot?.proId).toBe('jun');
    });

    it('crosses a time out only when nobody is free', () => {
      const booked = times(query({ proId: 'any', pros: [busyApril, jun] }), true);
      expect(booked).toContain('10:00 AM'); // Jun doesn't work then; April is booked
    });

    it('a single professional only shows their own times', () => {
      expect(times(query({ proId: 'jun', pros: [busyApril, jun] }))[0]).toBe('2:00 PM');
    });
  });

  it('groups into Morning, Afternoon and Evening', () => {
    const groups = groupSlots(getAvailableSlots(query()));
    expect(groups.map((g) => g.label)).toEqual(['Morning', 'Afternoon', 'Evening']);
    expect(formatTime(groups[1]!.slots[0]!.minutes)).toBe('12:00 PM');
    expect(formatTime(groups[2]!.slots[0]!.minutes)).toBe('5:00 PM');
  });
});

describe('holds', () => {
  const now = new Date('2026-11-17T12:00:00Z');
  it('a hold blocks the time for 10 minutes, then lets it go', () => {
    expect(isLive({ status: 'pending_payment', created_at: '2026-11-17T11:55:00Z' }, now)).toBe(true);
    expect(isLive({ status: 'pending_payment', created_at: '2026-11-17T11:49:00Z' }, now)).toBe(false);
    expect(isLive({ status: 'confirmed', created_at: '2026-11-01T00:00:00Z' }, now)).toBe(true);
    expect(isLive({ status: 'cancelled', created_at: '2026-11-17T11:59:00Z' }, now)).toBe(false);
  });
});
