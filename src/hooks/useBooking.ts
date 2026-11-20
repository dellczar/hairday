import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ProSchedule } from '@/lib/availability';
import { getDb } from '@/lib/db';
import type { CardSetup, HoldRequest, ReviewRequest } from '@/lib/types';

/** Booking flow data (Pick a time → held time). Keys start with 'booking'. */
const KEY = 'booking';

/**
 * Who can do every chosen service, with their weekly hours and breaks (both public for live
 * salons). Busy times are loaded separately, per week, because they change all the time.
 */
export function useBookingSetup(salonId?: string, serviceIds: string[] = []) {
  return useQuery({
    queryKey: [KEY, 'setup', salonId, serviceIds.join(',')],
    enabled: !!salonId && serviceIds.length > 0,
    queryFn: async () => {
      const db = getDb();
      const [pros, services, hours] = await Promise.all([
        db.select('professionals', { business_id: salonId }),
        db.select('services', { id: serviceIds, business_id: salonId }, 'sort_order'),
        db.select('business_hours', { business_id: salonId }),
      ]);
      const active = pros.filter((p) => p.is_active);
      const ids = active.map((p) => p.id);
      const [links, availability, breaks] = ids.length
        ? await Promise.all([
            db.select('professional_services', {
              professional_id: ids,
              service_id: serviceIds,
            }),
            db.select('availability', { professional_id: ids }),
            db.select('breaks', { professional_id: ids }),
          ])
        : [[], [], []];
      // Only people who do every chosen service (SPEC §8 "Anyone").
      const able = active
        .filter((p) => serviceIds.every((sid) => links.some((l) => l.professional_id === p.id && l.service_id === sid)))
        .sort((a, b) => a.first_name.localeCompare(b.first_name));
      return {
        services,
        hours,
        pros: able.map((p) => ({
          pro: p,
          availability: availability.filter((a) => a.professional_id === p.id),
          breaks: breaks.filter((b) => b.professional_id === p.id),
        })),
      };
    },
  });
}

/** Busy stretches for a date range (refreshed every minute while the screen is open). */
export function useBusyTimes(salonId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: [KEY, 'busy', salonId, from, to],
    enabled: !!salonId,
    staleTime: 15_000,
    refetchInterval: 60_000,
    queryFn: () => getDb().busyTimes(salonId!, from, to),
  });
}

/** Puts weekly hours, breaks and busy times together the way getAvailableSlots() wants them. */
export function schedulesFor(
  setup: {
    pros: {
      pro: { id: string };
      availability: ProSchedule['availability'];
      breaks: ProSchedule['breaks'];
    }[];
  },
  busy: {
    professional_id: string;
    starts_at: string;
    ends_at: string;
    kind: string;
  }[],
): ProSchedule[] {
  return setup.pros.map(({ pro, availability, breaks }) => {
    const mine = busy.filter((b) => b.professional_id === pro.id);
    return {
      id: pro.id,
      availability,
      breaks,
      timeOff: mine.filter((b) => b.kind === 'time_off'),
      bookings: mine.filter((b) => b.kind === 'booking'),
    };
  });
}

export function useCreateHold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: HoldRequest) => getDb().createHold(req),
    onSettled: () => void qc.invalidateQueries({ queryKey: [KEY] }), // refresh in the background
  });
}

/** One of the customer's own bookings (or holds), with its services, salon and professional. */
export function useHeldBooking(id?: string) {
  return useQuery({
    queryKey: [KEY, 'held', id],
    enabled: !!id,
    queryFn: async () => {
      const db = getDb();
      const [booking] = await db.select('bookings', { id });
      if (!booking) return null;
      const [items, [business], [pro], photos] = await Promise.all([
        db.select('booking_services', { booking_id: id }),
        db.select('businesses', { id: booking.business_id }),
        db.select('professionals', { id: booking.professional_id }),
        db.select('business_photos', { business_id: booking.business_id }, 'sort_order'),
      ]);
      const services = items.length ? await db.select('services', { id: items.map((i) => i.service_id) }) : [];
      return {
        booking,
        business: business ?? null,
        pro: pro ?? null,
        photo: photos[0]?.url ?? null,
        items: items.map((i) => ({
          ...i,
          name: services.find((s) => s.id === i.service_id)?.name ?? 'Service',
        })),
      };
    },
  });
}

export function useReleaseHold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => getDb().releaseHold(bookingId),
    onSettled: () => void qc.invalidateQueries({ queryKey: [KEY] }), // refresh in the background
  });
}

/**
 * Review & pay → "Confirm booking". Saves the card with Stripe's PaymentSheet (nothing is charged now),
 * then confirms the booking. `presentSheet` is passed in by the screen (it owns the Stripe hooks).
 * Resolves false when the person closed the sheet without saving a card.
 */
export function useConfirmBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, tipPercent, presentSheet }: ConfirmArgs) => {
      const db = getDb();
      const setup = await db.startCardSetup(bookingId, tipPercent);
      if (!setup.demo) {
        const saved = await presentSheet(setup);
        if (!saved) return false;
      }
      await db.confirmBooking(bookingId);
      return true;
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: [KEY] }), // refresh in the background
  });
}

type ConfirmArgs = {
  bookingId: string;
  tipPercent: number;
  presentSheet: (setup: Exclude<CardSetup, { demo: true }>) => Promise<boolean>;
};

/** The signed-in customer's bookings, newest first, with salon, professional and service names. */
export function useMyBookings() {
  return useQuery({
    queryKey: [KEY, 'mine'],
    queryFn: async () => {
      const db = getDb();
      const me = await db.userId();
      if (!me) return [];
      // Only real bookings (a card was saved), not holds that were let go or ran out.
      const bookings = (await db.select('bookings', { customer_id: me })).filter((b) => b.payment_status !== 'none');
      if (!bookings.length) return [];
      const ids = bookings.map((b) => b.id);
      const [items, businesses, pros, reviews] = await Promise.all([
        db.select('booking_services', { booking_id: ids }),
        db.select('businesses', {
          id: [...new Set(bookings.map((b) => b.business_id))],
        }),
        db.select('professionals', {
          id: [...new Set(bookings.map((b) => b.professional_id))],
        }),
        db.select('reviews', { customer_id: me }),
      ]);
      const services = items.length
        ? await db.select('services', {
            id: [...new Set(items.map((i) => i.service_id))],
          })
        : [];
      return bookings
        .map((b) => ({
          booking: b,
          business: businesses.find((x) => x.id === b.business_id) ?? null,
          pro: pros.find((p) => p.id === b.professional_id) ?? null,
          services: items.filter((i) => i.booking_id === b.id).map((i) => services.find((s) => s.id === i.service_id)?.name ?? 'Service'),
          serviceIds: items.filter((i) => i.booking_id === b.id).map((i) => i.service_id),
          review: reviews.find((r) => r.booking_id === b.id) ?? null,
          minutes: items.filter((i) => i.booking_id === b.id).reduce((s, i) => s + i.duration_min, 0),
        }))
        .sort((a, b) => b.booking.starts_at.localeCompare(a.booking.starts_at));
    },
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => getDb().cancelBooking(bookingId),
    onSettled: () => void qc.invalidateQueries({ queryKey: [KEY] }), // refresh in the background
  });
}

/** My bookings → Reschedule → Pick a new time → "Move it here". */
export function useRescheduleBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, professionalId, startsAt }: { bookingId: string; professionalId: string; startsAt: string }) =>
      getDb().rescheduleBooking(bookingId, professionalId, startsAt),
    onSettled: () => void qc.invalidateQueries({ queryKey: [KEY] }), // refresh in the background
  });
}

/** Leave a review → "Post review". Refreshes My bookings and the salon's reviews. */
export function usePostReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: ReviewRequest) => getDb().postReview(req),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: [KEY] });
      void qc.invalidateQueries(); // salon and professional pages show the new review
    },
  });
}
