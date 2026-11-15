// Cancels a booking and charges what the rules say (SPEC §9 with Open question 2 = charge later):
// customer, 24 h or more ahead → nothing; customer, later → 50% of the services; salon → nothing.
// The app shows the same amount (from the same rules) before the person confirms.

import { chargeBooking, getBooking } from '../_shared/bookings.ts';
import { cancellationQuote } from '../_shared/payments.ts';
import { admin, body, handle, HttpError, isUuid, json, requireUser, stripe } from '../_shared/server.ts';

Deno.serve(
  handle(async (req) => {
    const db = admin();
    const user = await requireUser(req, db);
    const { booking_id } = await body<{ booking_id: string }>(req);
    if (!isUuid(booking_id)) throw new HttpError(400, 'Booking not found.');

    const b = await getBooking(db, booking_id);
    const { data: biz } = await db.from('businesses').select('owner_id').eq('id', b.business_id).single();
    const by = b.customer_id === user.id ? 'customer' : biz?.owner_id === user.id ? 'salon' : null;
    if (!by) throw new HttpError(404, 'Booking not found.');
    if (b.status === 'cancelled') return json({ status: 'cancelled', charged_cents: b.charge_cents });
    if (b.status !== 'confirmed' && b.status !== 'pending_payment') throw new HttpError(409, 'This booking can’t be cancelled any more.');
    if (new Date(b.starts_at).getTime() <= Date.now()) throw new HttpError(409, 'This appointment has already started.');

    const quote = b.status === 'pending_payment' ? { charge: 0, late: false } : cancellationQuote(b, new Date(), by);
    const { data: done, error } = await db
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_by: user.id })
      .eq('id', b.id)
      .in('status', ['confirmed', 'pending_payment'])
      .select('id');
    if (error) throw error;
    if (!done?.length) return json({ status: 'cancelled', charged_cents: 0 });

    if (b.payment_status === 'card_saved') {
      const result = await chargeBooking(db, stripe(), b, quote.charge);
      if (result === 'failed') return json({ status: 'cancelled', charged_cents: 0, charge_failed: true });
    }
    return json({ status: 'cancelled', charged_cents: quote.charge });
  }),
);
