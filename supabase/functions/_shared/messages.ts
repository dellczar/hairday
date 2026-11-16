// The words of every notification (SPEC §11), shared by the send-notifications server function and
// the app's tests (src/lib/messages.ts re-exports this file). Pure TypeScript, no imports.

export type NotificationKind =
  | 'booking_confirmed'
  | 'booking_moved'
  | 'reminder_24h'
  | 'reminder_2h'
  | 'booking_cancelled'
  | 'review_request'
  | 'owner_new_booking'
  | 'owner_moved'
  | 'owner_cancelled'
  | 'owner_daily';

export type MessageContext = {
  salonName: string;
  timeZone: string;
  /** Booking messages. */
  startsAt?: string;
  services?: string[];
  proName?: string | null;
  customerName?: string | null;
  address?: string | null;
  bookingId?: string;
  /** booking_cancelled: what was charged, if anything. */
  chargedCents?: number;
  cardLabel?: string | null;
  cancelledBySalon?: boolean;
  /** owner_daily */
  count?: number;
  firstStartsAt?: string | null;
};

export type Message = {
  title: string;
  body: string;
  /** In-app path opened when the notification is tapped. */
  path: string;
  /** Who it's for decides which part of the app opens. */
  audience: 'customer' | 'owner';
};

const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

/** "Tue, Nov 17 at 2:30 PM" in the salon's time zone. */
export function when(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
  return `${day} at ${time}`;
}

/** "2:30 PM" in the salon's time zone. */
export function clock(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
}

function what(c: MessageContext): string {
  const s = (c.services ?? []).join(', ') || 'Your appointment';
  return c.proName ? `${s} with ${c.proName}` : s;
}

export function messageFor(kind: NotificationKind, c: MessageContext): Message {
  const at = c.startsAt ? when(c.startsAt, c.timeZone) : '';
  const t = c.startsAt ? clock(c.startsAt, c.timeZone) : '';
  const who = c.customerName?.trim() || 'A client';
  const bookings = '/(customer)/(tabs)/bookings';
  const calendar = '/(business)/calendar';
  switch (kind) {
    case 'booking_confirmed':
      return {
        audience: 'customer',
        path: bookings,
        title: 'You’re booked',
        body: `${what(c)} at ${c.salonName}, ${at}. Your card is charged after your visit.`,
      };
    case 'booking_moved':
      return { audience: 'customer', path: bookings, title: 'Booking moved', body: `${what(c)} at ${c.salonName} is now ${at}.` };
    case 'reminder_24h':
      return {
        audience: 'customer',
        path: bookings,
        title: 'See you tomorrow',
        body: `${what(c)} at ${c.salonName}, ${at}. Plans changed? From now on, cancelling costs 50% of the services.`,
      };
    case 'reminder_2h':
      return {
        audience: 'customer',
        path: bookings,
        title: `Today at ${t}`,
        body: `${what(c)} at ${c.salonName}${c.address ? `, ${c.address}` : ''}.`,
      };
    case 'booking_cancelled': {
      const charged = c.chargedCents
        ? `${money(c.chargedCents)} was charged${c.cardLabel ? ` to ${c.cardLabel}` : ''}.`
        : 'Nothing was charged.';
      return {
        audience: 'customer',
        path: bookings,
        title: 'Booking cancelled',
        body: c.cancelledBySalon
          ? `${c.salonName} had to cancel ${what(c)}, ${at}. Nothing was charged. Sorry about that.`
          : `${what(c)} at ${c.salonName}, ${at}, is cancelled. ${charged}`,
      };
    }
    case 'review_request':
      return {
        audience: 'customer',
        path: c.bookingId ? `/review/${c.bookingId}` : bookings,
        title: `How was ${c.salonName}?`,
        body: `Tell others about your visit${c.proName ? ` with ${c.proName}` : ''}. It takes a few seconds.`,
      };
    case 'owner_new_booking':
      return { audience: 'owner', path: calendar, title: 'New booking', body: `${who}: ${what(c)}, ${at}.` };
    case 'owner_moved':
      return { audience: 'owner', path: calendar, title: 'Booking moved', body: `${who} moved ${what(c)} to ${at}.` };
    case 'owner_cancelled':
      return { audience: 'owner', path: calendar, title: 'Booking cancelled', body: `${who} cancelled ${what(c)}, ${at}.` };
    case 'owner_daily': {
      const n = c.count ?? 0;
      const first = c.firstStartsAt ? ` First one at ${clock(c.firstStartsAt, c.timeZone)}.` : '';
      return {
        audience: 'owner',
        path: '/(business)/(tabs)',
        title: `Today at ${c.salonName}`,
        body: `${n === 1 ? '1 appointment' : `${n} appointments`} today.${first}`,
      };
    }
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

/** A plain, branded email for a message (colors from SPEC §5). */
export function emailHtml(m: Message): string {
  return `<!doctype html><html><body style="margin:0;background:#F7F4EE;font-family:Inter,Helvetica,Arial,sans-serif;color:#171826">
<div style="max-width:480px;margin:0 auto;padding:32px 24px">
<div style="font-family:Georgia,serif;font-size:22px;color:#171826;margin-bottom:24px">Hair<span style="color:#8F5A0E">day</span></div>
<div style="background:#FFFFFF;border:1px solid #ECE6DC;border-radius:20px;padding:24px">
<h1 style="margin:0 0 12px;font-family:Georgia,serif;font-weight:400;font-size:28px;line-height:1.15">${esc(m.title)}</h1>
<p style="margin:0;font-size:15px;line-height:1.5;color:#2B2E40">${esc(m.body)}</p>
</div>
<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#5D6070">Open the Hairday app to see your ${m.audience === 'owner' ? 'calendar' : 'bookings'}. You can turn these emails off in Profile → Reminders.</p>
</div></body></html>`;
}
