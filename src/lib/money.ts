// Money is always stored as whole cents (int). These helpers turn it into text and back.

/** 3000 → "$30", 3050 → "$30.50". */
export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/** What the owner types into a price field → cents, or null if it isn't a price. "$30.5" → 3050. */
export function parsePrice(text: string): number | null {
  const t = text.replace(/[$,\s]/g, '');
  if (!/^\d{1,5}(\.\d{0,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}

/** Error message for a price field, or null when it's fine. */
export function priceError(text: string): string | null {
  if (!text.trim()) return 'Enter a price.';
  const cents = parsePrice(text);
  if (cents === null) return 'Enter a price like 30 or 30.50.';
  if (cents > 1_000_000) return 'That price looks too high. The most is $10,000.';
  return null;
}
