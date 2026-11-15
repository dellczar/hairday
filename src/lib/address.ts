// US address checks for "Where can clients find you?" (Setup step 2).

const STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT',
  delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT',
  nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA',
  'puerto rico': 'PR', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN',
  texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
  wisconsin: 'WI', wyoming: 'WY',
};
const CODES = new Set(Object.values(STATES));

/** "New York" or "ny" → "NY"; null if it isn't a US state. */
export function stateCode(input: string): string | null {
  const t = input.trim();
  if (CODES.has(t.toUpperCase())) return t.toUpperCase();
  return STATES[t.toLowerCase()] ?? null;
}

export type AddressFields = { street: string; city: string; state: string; zip: string };
export type AddressErrors = Partial<Record<keyof AddressFields, string>>;

/** One message per field, shown under that field. Empty object = all good. */
export function addressErrors(a: AddressFields): AddressErrors {
  const e: AddressErrors = {};
  if (!a.street.trim()) e.street = 'Enter your street address.';
  if (!a.city.trim()) e.city = 'Enter the city.';
  if (!a.state.trim()) e.state = 'Enter the state.';
  else if (!stateCode(a.state)) e.state = 'Use a US state, like NY.';
  if (!a.zip.trim()) e.zip = 'Enter the ZIP code.';
  else if (!/^\d{5}(-\d{4})?$/.test(a.zip.trim())) e.zip = 'ZIP codes are 5 digits.';
  return e;
}

/** Turns the phone's reverse-geocode result into form fields. */
export function fromGeocode(g: { streetNumber?: string | null; street?: string | null; name?: string | null; city?: string | null; subregion?: string | null; region?: string | null; postalCode?: string | null }): AddressFields {
  const street = [g.streetNumber, g.street].filter(Boolean).join(' ') || g.name || '';
  return {
    street,
    city: g.city ?? g.subregion ?? '',
    state: (g.region && stateCode(g.region)) ?? g.region ?? '',
    zip: (g.postalCode ?? '').slice(0, 10),
  };
}

/** "555 Main St" — the short form shown on Business profile. */
export function shortAddress(line1: string | null): string {
  return line1?.trim() || 'Add address';
}
