// Runs every minute when something is due (pg_cron, see migrations/20261120000000_notifications.sql).
// Sends each queued notification as a push (Expo push service) and an email (Resend), respecting the
// person's Profile → Notifications switches. The words are written now, from the booking as it is.
//
// Secrets (Supabase → Edge Functions → Secrets): CRON_SECRET (already set), RESEND_API_KEY and
// EMAIL_FROM (e.g. "Hairday <bookings@yourdomain>") for email. Without them, email is skipped and
// push still works. EXPO_ACCESS_TOKEN is optional.

import { emailHtml, messageFor, type Message, type MessageContext, type NotificationKind } from '../_shared/messages.ts';
import { admin, handle, HttpError, json } from '../_shared/server.ts';

type Row = {
  id: string;
  profile_id: string;
  business_id: string | null;
  booking_id: string | null;
  kind: NotificationKind;
  attempts: number;
  push_sent: boolean;
  email_sent: boolean;
};

const db = admin();

Deno.serve(
  handle(async (req) => {
    const secret = Deno.env.get('CRON_SECRET');
    if (!secret || req.headers.get('x-cron-secret') !== secret) throw new HttpError(401, 'Not allowed.');

    const { data, error } = await db.rpc('claim_notifications', { n: 50 });
    if (error) throw error;
    const out = { sent: 0, skipped: 0, failed: 0 };
    for (const row of (data ?? []) as Row[]) {
      try {
        const r = await deliver(row);
        out[r] += 1;
      } catch (e) {
        console.error('notification', row.id, e);
        out.failed += 1;
        await db
          .from('notifications')
          .update({ status: row.attempts >= 5 ? 'failed' : 'pending', error: String(e instanceof Error ? e.message : e).slice(0, 500) })
          .eq('id', row.id);
      }
    }
    return json(out);
  }),
);

async function deliver(row: Row): Promise<'sent' | 'skipped'> {
  const ctx = await contextFor(row);
  if (!ctx) return finish(row, 'skipped', 'no longer applies');
  const message = messageFor(row.kind, ctx);

  const { data: profile } = await db.from('profiles').select('notify_push, notify_email').eq('id', row.profile_id).maybeSingle();
  if (!profile) return finish(row, 'skipped', 'no profile');

  let push = row.push_sent;
  let email = row.email_sent;
  if (profile.notify_push && !push) push = await sendPush(row, message);
  if (profile.notify_email && !email) email = await sendEmail(row, message);
  await db.from('notifications').update({ push_sent: push, email_sent: email }).eq('id', row.id);
  return finish(row, push || email ? 'sent' : 'skipped', push || email ? null : 'no channel');
}

async function finish(row: Row, status: 'sent' | 'skipped', why: string | null): Promise<'sent' | 'skipped'> {
  await db.from('notifications').update({ status, error: why, sent_at: new Date().toISOString() }).eq('id', row.id);
  return status;
}

/** The facts the message needs, or null when it no longer applies (cancelled, moved, already reviewed…). */
async function contextFor(row: Row): Promise<MessageContext | null> {
  if (row.kind === 'owner_daily') {
    const { data: biz } = await db.from('businesses').select('name, time_zone').eq('id', row.business_id!).maybeSingle();
    if (!biz) return null;
    const day = new Date().toLocaleDateString('en-CA', { timeZone: biz.time_zone }); // YYYY-MM-DD
    const { data: list } = await db
      .from('bookings')
      .select('starts_at')
      .eq('business_id', row.business_id!)
      .eq('status', 'confirmed')
      .gte('starts_at', new Date(Date.now() - 86_400_000).toISOString())
      .lte('starts_at', new Date(Date.now() + 86_400_000).toISOString())
      .order('starts_at');
    const today = (list ?? []).filter((b) => new Date(b.starts_at).toLocaleDateString('en-CA', { timeZone: biz.time_zone }) === day);
    if (!today.length) return null;
    return { salonName: biz.name, timeZone: biz.time_zone, count: today.length, firstStartsAt: today[0]!.starts_at };
  }

  const { data: b } = await db.from('bookings').select('*').eq('id', row.booking_id!).maybeSingle();
  if (!b) return null;
  const { data: biz } = await db
    .from('businesses')
    .select('name, time_zone, owner_id, address_line1, city')
    .eq('id', b.business_id)
    .maybeSingle();
  if (!biz) return null;

  // Reminders only for a visit that's still on; a review request only for a finished, unreviewed visit.
  if (row.kind.startsWith('reminder') && (b.status !== 'confirmed' || new Date(b.starts_at).getTime() < Date.now())) return null;
  if (row.kind === 'review_request') {
    if (b.status !== 'completed') return null; // the review screen only opens for finished visits
    const { count } = await db.from('reviews').select('id', { count: 'exact', head: true }).eq('booking_id', b.id);
    if (count) return null;
  }

  const [{ data: items }, { data: pro }, { data: client }] = await Promise.all([
    db.from('booking_services').select('service_id').eq('booking_id', b.id),
    db.from('professionals').select('first_name').eq('id', b.professional_id).maybeSingle(),
    b.client_id ? db.from('clients').select('name').eq('id', b.client_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const ids = (items ?? []).map((i) => i.service_id);
  const { data: services } = ids.length ? await db.from('services').select('name').in('id', ids) : { data: [] };

  return {
    salonName: biz.name,
    timeZone: biz.time_zone,
    startsAt: b.starts_at,
    services: (services ?? []).map((s) => s.name),
    proName: pro?.first_name ?? null,
    customerName: client?.name ?? null,
    address: [biz.address_line1, biz.city].filter(Boolean).join(', ') || null,
    bookingId: b.id,
    chargedCents: b.charge_cents,
    cardLabel: b.card_label,
    cancelledBySalon: b.status === 'cancelled' && b.cancelled_by === biz.owner_id,
  };
}

/** Push to every phone the person is signed in on. Returns true if at least one phone accepted it. */
async function sendPush(row: Row, m: Message): Promise<boolean> {
  const { data: tokens } = await db.from('push_tokens').select('expo_token').eq('profile_id', row.profile_id);
  if (!tokens?.length) return false;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const token = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(
      tokens.map((t) => ({
        to: t.expo_token,
        title: m.title,
        body: m.body,
        sound: 'default',
        data: { path: m.path, audience: m.audience, notification_id: row.id },
      })),
    ),
  });
  if (!res.ok) throw new Error(`Expo push ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const tickets = ((await res.json()) as { data?: { status: string; details?: { error?: string } }[] }).data ?? [];
  // Phones that uninstalled the app or turned notifications off for good.
  const gone = tokens.filter((_, i) => tickets[i]?.details?.error === 'DeviceNotRegistered').map((t) => t.expo_token);
  if (gone.length) await db.from('push_tokens').delete().in('expo_token', gone);
  return tickets.some((t) => t.status === 'ok');
}

/** Email through Resend, once RESEND_API_KEY and EMAIL_FROM are set. */
async function sendEmail(row: Row, m: Message): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM');
  if (!key || !from) return false;
  const { data } = await db.auth.admin.getUserById(row.profile_id);
  const to = data.user?.email;
  if (!to || to.endsWith('.test')) return false; // test accounts have no real inbox
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `notification-${row.id}` },
    body: JSON.stringify({ from, to: [to], subject: m.title, html: emailHtml(m), text: `${m.title}\n\n${m.body}` }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return true;
}
