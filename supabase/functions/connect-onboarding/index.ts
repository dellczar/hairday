// Payouts → "Continue to Stripe" (SPEC §9): creates the salon's Stripe Connect Express account the
// first time, and returns a Stripe link where the owner enters their ID and bank details. Hairday never
// sees those. action "status" asks Stripe whether setup is finished and records it.

import { admin, body, handle, HttpError, isUuid, json, requireUser, stripe } from '../_shared/server.ts';

Deno.serve(
  handle(async (req) => {
    const db = admin();
    const user = await requireUser(req, db);
    const { business_id, action } = await body<{ business_id: string; action: 'start' | 'status' }>(req);
    if (!isUuid(business_id)) throw new HttpError(400, 'Business not found.');

    const { data: biz } = await db.from('businesses').select('id, owner_id, name, stripe_account_id, payouts_enabled').eq('id', business_id).maybeSingle();
    if (!biz || biz.owner_id !== user.id) throw new HttpError(404, 'Business not found.');
    const s = stripe();

    if (action === 'status') {
      // No Stripe account yet (sample salons in test mode keep the flag they were given).
      if (!biz.stripe_account_id) return json({ started: false, payouts_enabled: !!biz.payouts_enabled });
      const acct = await s.accounts.retrieve(biz.stripe_account_id);
      const enabled = !!(acct.charges_enabled && acct.payouts_enabled && acct.details_submitted);
      // A salon can only be live with payouts on (publish_requires_payouts), so losing payouts hides it.
      await db.from('businesses').update(enabled ? { payouts_enabled: true } : { payouts_enabled: false, is_published: false }).eq('id', biz.id);
      return json({
        started: true,
        payouts_enabled: enabled,
        details_submitted: !!acct.details_submitted,
        needs_more: (acct.requirements?.currently_due?.length ?? 0) > 0,
        schedule: acct.settings?.payouts?.schedule?.interval ?? null,
      });
    }

    let accountId = biz.stripe_account_id as string | null;
    if (!accountId) {
      const acct = await s.accounts.create(
        {
          type: 'express',
          country: 'US',
          email: user.email ?? undefined,
          business_profile: { name: biz.name, mcc: '7230' }, // 7230 = beauty and barber shops
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          metadata: { business_id: biz.id },
        },
        { idempotencyKey: `connect-${biz.id}` },
      );
      accountId = acct.id;
      await db.from('businesses').update({ stripe_account_id: accountId }).eq('id', biz.id);
    }

    // Stripe needs web addresses to come back to; connect-return sends the browser back into the app.
    const back = `${Deno.env.get('SUPABASE_URL')}/functions/v1/connect-return`;
    const link = await s.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: `${back}?again=1`,
      return_url: back,
    });
    return json({ url: link.url });
  }),
);
