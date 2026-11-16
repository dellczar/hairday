// Stripe in the app: only the publishable key (CLAUDE.md). Secret keys live in Supabase server functions.
const key = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

/** Test mode until the owner says otherwise (CLAUDE.md): a live key is ignored. */
export const STRIPE_PUBLISHABLE_KEY = key.startsWith('pk_test_') ? key : '';
export const isStripeConfigured = STRIPE_PUBLISHABLE_KEY.length > 0;

/** Apple Pay merchant id (needs the Apple Developer account; until then Apple Pay just doesn't show). */
export const APPLE_MERCHANT_ID = 'merchant.app.hairday';
/** Where Stripe sends people back after a bank or 3-D Secure check. */
export const STRIPE_RETURN_URL = 'hairday://stripe-redirect';
