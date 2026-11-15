import { formatPrice, parsePrice, priceError } from '../money';
import { addDays, clampDuration, formatDuration, formatRange, formatTime, fromMinutes, openSummary, toMinutes, WEEK, zonedDayStart } from '../hours';

describe('money', () => {
  it('formats whole and partial dollars', () => {
    expect(formatPrice(3000)).toBe('$30');
    expect(formatPrice(3050)).toBe('$30.50');
    expect(formatPrice(0)).toBe('$0');
  });
  it('parses what an owner types', () => {
    expect(parsePrice('30')).toBe(3000);
    expect(parsePrice('$30.5')).toBe(3050);
    expect(parsePrice(' 1,200 ')).toBe(120000);
    expect(parsePrice('30.505')).toBeNull();
    expect(parsePrice('abc')).toBeNull();
    expect(parsePrice('')).toBeNull();
  });
  it('explains bad prices in plain words', () => {
    expect(priceError('')).toBe('Enter a price.');
    expect(priceError('ten')).toBe('Enter a price like 30 or 30.50.');
    expect(priceError('20000')).toMatch(/too high/);
    expect(priceError('45')).toBeNull();
  });
});

describe('hours', () => {
  it('converts times both ways', () => {
    expect(toMinutes('13:30:00')).toBe(810);
    expect(toMinutes('09:05')).toBe(545);
    expect(fromMinutes(810)).toBe('13:30');
    expect(fromMinutes(0)).toBe('00:00');
  });
  it('formats times like the designs', () => {
    expect(formatTime('10:00')).toBe('10:00 AM');
    expect(formatTime(20 * 60)).toBe('8:00 PM');
    expect(formatTime(0)).toBe('12:00 AM');
    expect(formatTime(12 * 60)).toBe('12:00 PM');
    expect(formatRange('10:00', '20:00')).toBe('10:00 AM – 8:00 PM');
    expect(formatRange('13:00', '13:30')).toBe('1:00 – 1:30 PM');
  });
  it('formats durations like Services.html', () => {
    expect(formatDuration(30)).toBe('30 min');
    expect(formatDuration(60)).toBe('1 hr');
    expect(formatDuration(90)).toBe('1 hr 30 min');
    expect(formatDuration(180)).toBe('3 hr');
  });
  it('keeps durations within 15 min – 8 hr in 15-minute steps', () => {
    expect(clampDuration(0)).toBe(15);
    expect(clampDuration(500)).toBe(480);
    expect(clampDuration(50)).toBe(45);
  });
  it('lists the week Monday first with Postgres weekday numbers', () => {
    expect(WEEK.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(openSummary(1)).toBe('Open 1 day a week. You can change this any time.');
    expect(openSummary(6)).toMatch(/^Open 6 days/);
    expect(openSummary(6, '10:00 AM – 8:00 PM')).toBe('Open 6 days a week, 10:00 AM – 8:00 PM. You can change this any time.');
  });
  it('finds midnight in the salon’s time zone, including daylight-saving days', () => {
    expect(zonedDayStart('2026-01-15', 'America/New_York')).toBe('2026-01-15T05:00:00.000Z');
    expect(zonedDayStart('2026-07-15', 'America/New_York')).toBe('2026-07-15T04:00:00.000Z');
    expect(zonedDayStart('2026-03-08', 'America/New_York')).toBe('2026-03-08T05:00:00.000Z'); // clocks spring forward at 2 AM
    expect(zonedDayStart('2026-11-01', 'America/New_York')).toBe('2026-11-01T04:00:00.000Z'); // clocks fall back at 2 AM
    expect(zonedDayStart('2026-07-15', 'America/Los_Angeles')).toBe('2026-07-15T07:00:00.000Z');
  });
  it('adds days across month ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
