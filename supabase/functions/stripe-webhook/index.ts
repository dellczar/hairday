// Stripe → Hairday events (SPEC §9). Signatures are checked with STRIPE_WEBHOOK_SECRET, and each event
// id is stored, so an event Stripe sends twice is handled once.
// Deployed without JWT checks (Stripe can't sign in); the signature is the check.

import { confirmFromSetupIntent } from '../_shared/bookings.ts';
import { admin, json, stripe, Stripe } from '../_shared/server.ts';

Deno.serve(async (req) => {
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const signature = req.headers.get('Stripe-Signature');
  if (!secret || !signature) return json({ error: 'Not allowed.' }, 400);

  const s = stripe();
  let event: Stripe.Event;
  try {
    event = await s.webhooks.constructEventAsync(await req.text(), signature, secret, undefined, Stripe.createSubtleCryptoProvider());
  } catch {
    return json({ error: 'Bad signature.' }, 400);
  }

  const db = admin();
  const { error: seen } = await db.from('stripe_events').insert({ id: event.id, type: event.type });
  if (seen) return json({ received: true, duplicate: true }); // already handled

  try {
    await handleEvent(db, s, event);
  } catch (e) {
    // Let Stripe retry later: forget the id so the retry isn't skipped.
    await db.from('stripe_events').delete().eq('id', event.id);
    console.error(event.type, e);
    return json({ error: 'Try again.' }, 500);
  }
  return json({ received: true });
});

async function handleEvent(db: ReturnType<typeof admin>, s: Stripe, event: Stripe.Event) {
  switch (event.type) {
    case 'setup_intent.succeeded': {
      const intent = await s.setupIntents.retrieve((event.data.object as Stripe.SetupIntent).id, { expand: ['payment_method'] });
      await confirmFromSetupIntent(db, intent);
      return;
    }
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const id = pi.metadata?.booking_id;
      if (!id) return;
      await db
        .from('bookings')
        .update({ payment_status: 'charged', stripe_payment_intent_id: pi.id, charged_at: new Date().toISOString(), payment_error: null })
        .eq('id', id);
      return;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const id = pi.metadata?.booking_id;
      if (!id) return;
      await db
        .from('bookings')
        .update({ payment_status: 'failed', payment_error: pi.last_payment_error?.message ?? 'The card was declined.' })
        .eq('id', id)
        .neq('payment_status', 'charged');
      return;
    }
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      if (!pi) return;
      await db.from('bookings').update({ refund_cents: charge.amount_refunded }).eq('stripe_payment_intent_id', pi);
      return;
    }
    case 'account.updated': {
      const acct = event.data.object as Stripe.Account;
      const on = !!(acct.charges_enabled && acct.payouts_enabled && acct.details_submitted);
      // A salon can only be live with payouts on (publish_requires_payouts), so losing payouts hides it.
      await db
        .from('businesses')
        .update(on ? { payouts_enabled: true } : { payouts_enabled: false, is_published: false })
        .eq('stripe_account_id', acct.id);
      return;
    }
  }
}
