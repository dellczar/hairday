// Review & pay → "Confirm booking": sets the tip on the customer's held time and starts saving their
// card with a Stripe SetupIntent. The app then shows Stripe's PaymentSheet (card, Apple Pay, Google Pay).
// Nothing is charged here; the card is charged after the appointment (Open question 2).

import { getBooking, customerFor } from '../_shared/bookings.ts';
import { bookingTotals, isTipChoice } from '../_shared/payments.ts';
import { admin, body, handle, HttpError, isUuid, json, requireUser, stripe } from '../_shared/server.ts';

const HOLD_MS = 10 * 60_000;

Deno.serve(
  handle(async (req) => {
    const db = admin();
    const user = await requireUser(req, db);
    const { booking_id, tip_percent } = await body<{ booking_id: string; tip_percent: number }>(req);
    if (!isUuid(booking_id)) throw new HttpError(400, 'Booking not found.');
    if (!isTipChoice(tip_percent)) throw new HttpError(400, 'Pick a tip.');

    const b = await getBooking(db, booking_id);
    if (b.customer_id !== user.id) throw new HttpError(404, 'Booking not found.');
    if (b.status !== 'pending_payment' || Date.now() - new Date(b.created_at).getTime() >= HOLD_MS) {
      throw new HttpError(409, 'Your hold ran out. Pick the time again.');
    }

    const s = stripe();
    const customer = await customerFor(db, s, user.id, user.email);
    const totals = bookingTotals(b.subtotal_cents, tip_percent);
    const [ephemeralKey, intent] = await Promise.all([
      s.ephemeralKeys.create({ customer }, { apiVersion: '2020-08-27' }),
      s.setupIntents.create({
        customer,
        usage: 'off_session',
        automatic_payment_methods: { enabled: true },
        metadata: { booking_id: b.id },
      }),
    ]);

    const { error } = await db
      .from('bookings')
      .update({
        tip_percent,
        tip_cents: totals.tip,
        fee_cents: totals.fee,
        total_cents: totals.total,
        stripe_setup_intent_id: intent.id,
      })
      .eq('id', b.id)
      .eq('status', 'pending_payment');
    if (error) throw error;

    return json({
      setupIntentClientSecret: intent.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customerId: customer,
      totals,
    });
  }),
);
