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
