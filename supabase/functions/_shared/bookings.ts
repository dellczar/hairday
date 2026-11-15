// Booking payment steps shared by several server functions (and the webhook, which may repeat them).
// Every step checks the booking's current state first, so running it twice changes nothing.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { cardLabel } from './payments.ts';
import { HttpError, type Stripe } from './server.ts';

export type BookingRow = {
  id: string;
  business_id: string;
  professional_id: string;
  customer_id: string | null;
  starts_at: string;
  ends_at: string;
  status: 'pending_payment' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  source: string;
  subtotal_cents: number;
  fee_cents: number;
  tip_cents: number;
  total_cents: number;
  tip_percent: number;
  payment_status: 'none' | 'card_saved' | 'charging' | 'charged' | 'failed' | 'not_charged';
  stripe_setup_intent_id: string | null;
  stripe_payment_method_id: string | null;
  stripe_payment_intent_id: string | null;
  charge_cents: number;
  cancelled_by: string | null;
  created_at: string;
};

export async function getBooking(db: SupabaseClient, id: string): Promise<BookingRow> {
  const { data, error } = await db.from('bookings').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'Booking not found.');
  return data as BookingRow;
}

/** The person's Stripe Customer, created the first time they save a card. */
export async function customerFor(db: SupabaseClient, stripe: Stripe, profileId: string, email: string | null): Promise<string> {
  const { data } = await db.from('stripe_customers').select('customer_id').eq('profile_id', profileId).maybeSingle();
  if (data?.customer_id) return data.customer_id as string;
  const customer = await stripe.customers.create(
    { email: email ?? undefined, metadata: { profile_id: profileId } },
    { idempotencyKey: `customer-${profileId}` },
  );
  const { error } = await db.from('stripe_customers').insert({ profile_id: profileId, customer_id: customer.id });
  if (error) {
    // Two requests at once: keep whichever got saved first.
    const again = await db.from('stripe_customers').select('customer_id').eq('profile_id', profileId).single();
    return again.data!.customer_id as string;
  }
  return customer.id;
}

export type ConfirmResult = { ok: true } | { ok: false; reason: 'not_ready' | 'taken' | 'cancelled' };

/**
 * The card was saved (SetupIntent succeeded) → the booking is confirmed.
 * If the 10-minute hold ran out a moment earlier, it's taken back if the time is still free.
 */
export async function confirmFromSetupIntent(db: SupabaseClient, intent: Stripe.SetupIntent): Promise<ConfirmResult> {
  const bookingId = intent.metadata?.booking_id;
  if (!bookingId) return { ok: false, reason: 'not_ready' };
  if (intent.status !== 'succeeded' || !intent.payment_method) {
    return { ok: false, reason: 'not_ready' };
  }
  const b = await getBooking(db, bookingId);
  if (b.stripe_setup_intent_id !== intent.id) return { ok: false, reason: 'not_ready' };
  if (b.status === 'confirmed' || b.status === 'completed') return { ok: true };
  // Cancelled by a person (not by the hold running out) stays cancelled.
  if (b.status === 'cancelled' && b.cancelled_by) return { ok: false, reason: 'cancelled' };
  if (b.status !== 'pending_payment' && b.status !== 'cancelled') return { ok: false, reason: 'cancelled' };

  const pm = typeof intent.payment_method === 'string' ? null : intent.payment_method;
  const pmId = typeof intent.payment_method === 'string' ? intent.payment_method : intent.payment_method!.id;
  const label = pm?.card ? cardLabel(pm.card.brand, pm.card.last4) : null;

  const { error } = await db
    .from('bookings')
    .update({
      status: 'confirmed',
      payment_status: 'card_saved',
      stripe_payment_method_id: pmId,
      card_label: label,
      cancelled_at: null,
    })
    .eq('id', b.id)
    .in('status', ['pending_payment', 'cancelled']);
  if (error) {
    // 23P01 = the time was booked by someone else after the hold ran out.
    if (error.code === '23P01') return { ok: false, reason: 'taken' };
    throw error;
  }
  return { ok: true };
}

/**
 * Charges the saved card `amount` cents (the whole visit, or a late-cancel / no-show share) and records
 * the result. Destination charge: the money goes to the salon's Stripe account, minus Hairday's fee.
 */
export async function chargeBooking(db: SupabaseClient, stripe: Stripe, b: BookingRow, amount: number): Promise<'charged' | 'failed' | 'skipped'> {
  if (amount <= 0) {
    await db.from('bookings').update({ payment_status: 'not_charged', charge_cents: 0 }).eq('id', b.id).eq('payment_status', 'card_saved');
    return 'skipped';
  }
  // Claim the booking so two runs can't both charge it.
  const { data: claimed } = await db
    .from('bookings')
    .update({ payment_status: 'charging', charge_cents: amount })
    .eq('id', b.id)
    .in('payment_status', ['card_saved', 'failed'])
    .select('id');
  if (!claimed?.length) return 'skipped';

  const [{ data: cust }, { data: biz }] = await Promise.all([
    db.from('stripe_customers').select('customer_id').eq('profile_id', b.customer_id!).maybeSingle(),
    db.from('businesses').select('stripe_account_id, payouts_enabled').eq('id', b.business_id).single(),
  ]);
  const fee = Math.min(b.fee_cents, amount);
  // Seed salons in test mode have no Stripe account; their charges stay on Hairday's test account.
  const destination = biz?.stripe_account_id && biz.payouts_enabled ? (biz.stripe_account_id as string) : null;

  try {
    const pi = await stripe.paymentIntents.create(
      {
        amount,
        currency: 'usd',
        customer: cust?.customer_id ?? undefined,
        payment_method: b.stripe_payment_method_id ?? undefined,
        off_session: true,
        confirm: true,
        description: `Hairday booking ${b.id}`,
        metadata: { booking_id: b.id },
        ...(destination ? { transfer_data: { destination }, application_fee_amount: fee || undefined } : {}),
      },
      // Same booking, amount and card → never charged twice. A new card gets a fresh try (Stripe replays
      // the first answer to a key, a decline included, for 24 hours).
      { idempotencyKey: `charge-${b.id}-${amount}-${b.stripe_payment_method_id ?? 'none'}` },
    );
    await db
      .from('bookings')
      .update({
        payment_status: pi.status === 'succeeded' ? 'charged' : 'charging',
        stripe_payment_intent_id: pi.id,
        charged_at: pi.status === 'succeeded' ? new Date().toISOString() : null,
        payment_error: null,
      })
      .eq('id', b.id);
    return 'charged';
  } catch (e) {
    const err = e as { message?: string; raw?: { payment_intent?: { id?: string } } };
    await db
      .from('bookings')
      .update({
        payment_status: 'failed',
        payment_error: err.message ?? 'The card was declined.',
        stripe_payment_intent_id: err.raw?.payment_intent?.id ?? null,
      })
      .eq('id', b.id);
    return 'failed';
  }
}
