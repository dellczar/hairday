// Phone numbers for clients (SPEC §10 Clients: "email and phone validated separately").

/** Message to show under the phone field, or null when it's fine. Empty is fine (phone is optional). */
export function phoneError(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/[^\d\s()+.-]/.test(v)) return 'Use numbers only, like (212) 555-0123.';
  const digits = v.replace(/\D/g, '');
  if (digits.length < 10) return 'Add the area code, like (212) 555-0123.';
  if (digits.length > 15) return 'That number is too long. Check it again.';
  return null;
}

/** "2125550123" → "(212) 555-0123"; other lengths are kept as typed. */
export function formatPhone(value: string): string {
  const d = value.replace(/\D/g, '');
  const us = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  if (us.length === 10) return `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}`;
  return value.trim();
}
