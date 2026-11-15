import { formatPhone, phoneError } from '../phone';

describe('client phone numbers', () => {
  it('is optional', () => expect(phoneError('')).toBeNull());
  it('accepts US numbers with an area code, however they’re typed', () => {
    expect(phoneError('(212) 555-0123')).toBeNull();
    expect(phoneError('212.555.0123')).toBeNull();
    expect(phoneError('+1 212 555 0123')).toBeNull();
  });
  it('explains what’s wrong', () => {
    expect(phoneError('555-0123')).toMatch(/area code/);
    expect(phoneError('212 555 O123')).toMatch(/numbers only/);
    expect(phoneError('1234567890123456')).toMatch(/too long/);
  });
  it('tidies US numbers and leaves others as typed', () => {
    expect(formatPhone('2125550123')).toBe('(212) 555-0123');
    expect(formatPhone('+1 212-555-0123')).toBe('(212) 555-0123');
    expect(formatPhone('+44 20 7946 0958')).toBe('+44 20 7946 0958');
  });
});
