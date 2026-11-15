// After PaymentSheet says the card was saved, the app calls this to confirm the booking straight away
// (the stripe-webhook does the same thing as a backup). It asks Stripe directly rather than trusting
// the app.

import { confirmFromSetupIntent, getBooking } from '../_shared/bookings.ts';
import { admin, body, handle, HttpError, isUuid, json, requireUser, stripe } from '../_shared/server.ts';

Deno.serve(
  handle(async (req) => {
    const db = admin();
    const user = await requireUser(req, db);
    const { booking_id } = await body<{ booking_id: string }>(req);
    if (!isUuid(booking_id)) throw new HttpError(400, 'Booking not found.');

    const b = await getBooking(db, booking_id);
    if (b.customer_id !== user.id) throw new HttpError(404, 'Booking not found.');
    if (b.status === 'confirmed') return json({ status: 'confirmed' });
    if (!b.stripe_setup_intent_id) throw new HttpError(409, 'Add a card first.');

    const intent = await stripe().setupIntents.retrieve(b.stripe_setup_intent_id, { expand: ['payment_method'] });
    const result = await confirmFromSetupIntent(db, intent);
    if (result.ok) return json({ status: 'confirmed' });
    if (result.reason === 'taken') throw new HttpError(409, 'Your hold ran out and someone else booked that time. Your card wasn’t charged.');
    if (result.reason === 'cancelled') throw new HttpError(409, 'This booking was cancelled.');
    throw new HttpError(409, 'Your card wasn’t saved. Please try again.');
  }),
);
