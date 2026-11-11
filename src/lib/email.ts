/** Returns an error message to show under the email field, or null if it looks valid. */
export function emailError(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Enter your email address.';
  // Practical check: something@something.tld, no spaces.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'That email address doesn’t look right. Check for typos.';
  return null;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
