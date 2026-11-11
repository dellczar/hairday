export const OTP_LENGTH = 6;
export const RESEND_SECONDS = 60;

/** Keep digits only, max 6 — used for typing, pasting and one-time-code autofill. */
export function cleanCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

/** "0:42" style countdown label. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
