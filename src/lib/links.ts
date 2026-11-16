// Public pages on hairday.app (SPEC §3 Open question 7 — final URLs to confirm with the owner).
export const links = {
  terms: 'https://hairday.app/terms',
  privacy: 'https://hairday.app/privacy',
  support: 'mailto:hello@hairday.app',
} as const;

/**
 * Link shared from a salon page. Opens hairday.app/salon, which sends people with the app
 * straight to the salon (hairday://salon/<id>) and everyone else to the app stores.
 */
export function salonLink(id: string): string {
  return `https://hairday.app/salon/?id=${encodeURIComponent(id)}`;
}

/** Opens directions to a salon in Apple Maps (iPhone) or Google Maps (Android). */
export function directionsUrl(
  b: { name: string; lat: number | null; lng: number | null; address_line1: string | null; city: string | null; state: string | null; zip: string | null },
  platform: 'ios' | 'android',
): string {
  const address = [b.address_line1, b.city, b.state, b.zip].filter(Boolean).join(', ');
  const where = b.lat != null && b.lng != null ? `${b.lat},${b.lng}` : address;
  if (platform === 'ios') return `https://maps.apple.com/?daddr=${encodeURIComponent(where)}&q=${encodeURIComponent(b.name)}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(where)}`;
}
