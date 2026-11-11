import { initials } from '@/components/Avatar';

import { emailError, normalizeEmail } from '../email';
import { cleanCode, formatCountdown } from '../otp';

describe('emailError', () => {
  it.each(['lana@icloud.com', ' Lana.Smith+salon@gmail.co ', 'a@b.io'])('accepts %p', (e) => {
    expect(emailError(e)).toBeNull();
  });
  it('asks for an email when empty', () => {
    expect(emailError('   ')).toBe('Enter your email address.');
  });
  it.each(['lana', 'lana@', 'lana@icloud', 'la na@icloud.com', '@icloud.com'])('rejects %p', (e) => {
    expect(emailError(e)).toMatch(/doesn’t look right/);
  });
  it('normalizes case and spaces', () => {
    expect(normalizeEmail('  Lana@iCloud.COM ')).toBe('lana@icloud.com');
  });
});

describe('verification code', () => {
  it('keeps digits only, max 6 (paste / autofill)', () => {
    expect(cleanCode('482 913')).toBe('482913');
    expect(cleanCode('Your code is 482-913-77')).toBe('482913');
    expect(cleanCode('abc')).toBe('');
  });
  it('formats the resend countdown', () => {
    expect(formatCountdown(42)).toBe('0:42');
    expect(formatCountdown(60)).toBe('1:00');
    expect(formatCountdown(5)).toBe('0:05');
    expect(formatCountdown(-3)).toBe('0:00');
  });
});

describe('initials', () => {
  it.each([
    ['Dellon Caesar', 'DC'],
    ['april', 'A'],
    ['Mary Jo van Dyke', 'MD'],
    ['  ', '?'],
  ])('%p → %p', (name, out) => {
    expect(initials(name)).toBe(out);
  });
});
