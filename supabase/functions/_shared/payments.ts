// Money rules shared by the app (src/lib/payments.ts re-exports this file) and the server functions,
// so the amount a customer is shown is the amount they're charged. Pure TypeScript, no imports.
//
// Owner decisions (docs/DECISIONS.md, 2026-11-16):
// - Open question 1: no booking fee for now.
// - Open question 2: the card is saved at booking and charged after the appointment.
// - Cancelling more than 24 h ahead is free; later, or not showing up, costs 50% of the services.
//   The tip is never charged then. If the salon cancels, nothing is charged.

/** Hairday's booking fee in cents. 0 until the owner decides on one (Open question 1). */
export const BOOKING_FEE_CENTS = 0;

/** Tip choices on Review & pay, as a percent of the services (SPEC §9). 0 = "None". */
export const TIP_CHOICES = [15, 18, 20, 0] as const;
export const DEFAULT_TIP = 18;

export const FREE_CANCEL_HOURS = 24;
export const LATE_CANCEL_SHARE = 0.5;

/** How long after an appointment ends before the card is charged (time for the salon to mark a no-show). */
export const CHARGE_DELAY_MINUTES = 60;

export function isTipChoice(p: unknown): p is (typeof TIP_CHOICES)[number] {
  return typeof p === 'number' && (TIP_CHOICES as readonly number[]).includes(p);
}

export function tipCents(subtotalCents: number, percent: number): number {
  return Math.round((subtotalCents * percent) / 100);
}

export type Totals = { subtotal: number; tip: number; fee: number; total: number };

/** What the customer will pay after the appointment. */
export function bookingTotals(subtotalCents: number, tipPercent: number): Totals {
  const tip = tipCents(subtotalCents, tipPercent);
  return { subtotal: subtotalCents, tip, fee: BOOKING_FEE_CENTS, total: subtotalCents + tip + BOOKING_FEE_CENTS };
}

/** Half the services: the late-cancel and no-show amount. */
export function lateCharge(subtotalCents: number): number {
  return Math.round(subtotalCents * LATE_CANCEL_SHARE);
}

export type CancelQuote = {
  /** Cents charged to the customer's saved card. */
  charge: number;
  /** True when it's within 24 hours of the start. */
  late: boolean;
};

/** What cancelling costs, worked out at `now`. */
export function cancellationQuote(b: { subtotal_cents: number; starts_at: string }, now: Date, by: 'customer' | 'salon'): CancelQuote {
  if (by === 'salon') return { charge: 0, late: false };
  const hoursLeft = (new Date(b.starts_at).getTime() - now.getTime()) / 3_600_000;
  const late = hoursLeft < FREE_CANCEL_HOURS;
  return { charge: late ? lateCharge(b.subtotal_cents) : 0, late };
}

/** Amount to charge once an appointment is over (or marked as a no-show). */
export function amountDue(b: { status: string; subtotal_cents: number; tip_cents: number; fee_cents: number }): number {
  if (b.status === 'no_show') return lateCharge(b.subtotal_cents);
  return b.subtotal_cents + b.tip_cents + b.fee_cents;
}

/** "Visa ending 4242" */
export function cardLabel(brand: string | null | undefined, last4: string | null | undefined): string {
  const names: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'American Express',
    discover: 'Discover',
    diners: 'Diners Club',
    jcb: 'JCB',
    unionpay: 'UnionPay',
  };
  const name = (brand && names[brand]) || 'Card';
  return last4 ? `${name} ending ${last4}` : name;
}

/**
 * A confirmed booking can be moved until the free-cancel window closes (24 hours before), so moving
 * it can't be used to avoid the late-cancel charge. Same rule as reschedule_booking() in the database.
 */
export function canReschedule(b: { starts_at: string }, now: Date): boolean {
  return new Date(b.starts_at).getTime() - now.getTime() >= FREE_CANCEL_HOURS * 3_600_000;
}
