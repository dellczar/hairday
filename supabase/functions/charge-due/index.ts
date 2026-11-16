// Runs every 15 minutes (pg_cron, see migrations/20261117000000_payments.sql). Charges each saved card
// an hour after the appointment ends: services + tip (+ fee), or 50% of the services for a no-show.
// Only the database's scheduled job knows CRON_SECRET; nobody else can trigger charges.

import { amountDue, CHARGE_DELAY_MINUTES } from '../_shared/payments.ts';
import { chargeBooking, type BookingRow } from '../_shared/bookings.ts';
import { admin, handle, HttpError, json, stripe } from '../_shared/server.ts';

Deno.serve(
  handle(async (req) => {
    const secret = Deno.env.get('CRON_SECRET');
    if (!secret || req.headers.get('x-cron-secret') !== secret) throw new HttpError(401, 'Not allowed.');

    const db = admin();
    const due = new Date(Date.now() - CHARGE_DELAY_MINUTES * 60_000).toISOString();
    const { data, error } = await db
      .from('bookings')
      .select('*')
      .eq('payment_status', 'card_saved')
      .in('status', ['confirmed', 'completed', 'no_show'])
      .lt('ends_at', due)
      .order('ends_at')
      .limit(50);
    if (error) throw error;

    const s = stripe();
    const results = { charged: 0, failed: 0, skipped: 0 };
    for (const b of (data ?? []) as BookingRow[]) {
      const r = await chargeBooking(db, s, b, amountDue(b));
      results[r] += 1;
      if (r === 'charged' && b.status === 'confirmed') {
        await db.from('bookings').update({ status: 'completed' }).eq('id', b.id).eq('status', 'confirmed');
      }
    }
    return json(results);
  }),
);
