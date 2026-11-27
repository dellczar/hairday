// Deletes the signed-in person's account (SPEC §13; Apple 5.1.1(v), Google Play account deletion).
//
// It refuses, with a plain message, while money or a customer is still waiting on the account:
// an upcoming booking (theirs, or at a salon they own) or a visit whose card hasn't been charged yet.
// Otherwise it lets go of short booking holds, deletes their saved cards at Stripe, removes their
// photos, then deletes the sign-in user. The database removes the rest (profiles cascade):
// favorites, reviews, push tokens, notifications, and any business they own with its bookings.
// Their past bookings at other salons stay, without their name, for the salon's and tax records.
// Salons' Stripe payout accounts are left at Stripe (payout and tax history live there).

import { admin, handle, HttpError, json, requireUser, stripe } from '../_shared/server.ts';

const BUCKET = 'photos';
const UNCHARGED = ['card_saved', 'charging'];

Deno.serve(
  handle(async (req) => {
    const db = admin();
    const user = await requireUser(req, db);
    const now = new Date().toISOString();

    // 1. Their own bookings.
    const { count: upcoming } = await db
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', user.id)
      .eq('status', 'confirmed')
      .gt('starts_at', now);
    if (upcoming) {
      throw new HttpError(
        409,
        `You have ${upcoming === 1 ? 'an upcoming booking' : `${upcoming} upcoming bookings`}. Cancel ${upcoming === 1 ? 'it' : 'them'} in Bookings first, then delete your account.`,
      );
    }
    const { count: unpaid } = await db
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', user.id)
      .neq('status', 'cancelled')
      .in('payment_status', UNCHARGED);
    if (unpaid) {
      throw new HttpError(409, 'Payment for a recent visit is still going through. Please try again in a few hours.');
    }

    // 2. Businesses they own.
    const { data: businesses, error: bizError } = await db.from('businesses').select('id').eq('owner_id', user.id);
    if (bizError) throw bizError;
    const businessIds = (businesses ?? []).map((b) => b.id as string);
    if (businessIds.length) {
      const { count: salonUpcoming } = await db
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .in('business_id', businessIds)
        .eq('status', 'confirmed')
        .gt('starts_at', now);
      if (salonUpcoming) {
        throw new HttpError(
          409,
          `Your salon has ${salonUpcoming === 1 ? 'an upcoming booking' : `${salonUpcoming} upcoming bookings`}. Cancel ${salonUpcoming === 1 ? 'it' : 'them'} in Business first, then delete your account.`,
        );
      }
      const { count: salonUnpaid } = await db
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .in('business_id', businessIds)
        .neq('status', 'cancelled')
        .in('payment_status', UNCHARGED);
      if (salonUnpaid) {
        throw new HttpError(409, 'Payments for your salon’s recent visits are still going through. Please try again in a few hours.');
      }
    }

    // 3. Let go of any short hold they're in the middle of (nothing is charged for a hold).
    const { error: holdError } = await db
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: now, cancelled_by: user.id, payment_status: 'not_charged' })
      .eq('customer_id', user.id)
      .eq('status', 'pending_payment');
    if (holdError) throw holdError;

    // 4. Saved cards: deleting the Stripe customer removes them.
    const { data: sc } = await db.from('stripe_customers').select('customer_id').eq('profile_id', user.id).maybeSingle();
    if (sc?.customer_id) {
      try {
        await stripe().customers.del(sc.customer_id as string);
      } catch (e) {
        if ((e as { code?: string }).code !== 'resource_missing') throw e;
      }
    }

    // 5. Photos: their salons' folders and their review photos.
    for (const folder of [...businessIds, `reviews/${user.id}`]) await removeFolder(db, folder);

    // 6. The account itself; the database cascades the rest.
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return json({ deleted: true });
  }),
);

/** Deletes every file under a folder of the photos bucket (storage has no recursive delete). */
async function removeFolder(db: ReturnType<typeof admin>, folder: string): Promise<void> {
  const files: string[] = [];
  const walk = async (path: string) => {
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await db.storage.from(BUCKET).list(path, { limit: 100, offset });
      if (error) throw error;
      for (const item of data ?? []) {
        const full = `${path}/${item.name}`;
        // Folders come back without an id.
        if (item.id) files.push(full);
        else await walk(full);
      }
      if (!data || data.length < 100) break;
    }
  };
  await walk(folder);
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await db.storage.from(BUCKET).remove(files.slice(i, i + 100));
    if (error) throw error;
  }
}
