import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ProSchedule } from '@/lib/availability';
import { getDb } from '@/lib/db';
import type { HoldRequest } from '@/lib/types';

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
            db.select('professional_services', { professional_id: ids, service_id: serviceIds }),
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
  setup: { pros: { pro: { id: string }; availability: ProSchedule['availability']; breaks: ProSchedule['breaks'] }[] },
  busy: { professional_id: string; starts_at: string; ends_at: string; kind: string }[],
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
    onSettled: () => qc.invalidateQueries({ queryKey: [KEY] }),
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
      const [items, [business], [pro]] = await Promise.all([
        db.select('booking_services', { booking_id: id }),
        db.select('businesses', { id: booking.business_id }),
        db.select('professionals', { id: booking.professional_id }),
      ]);
      const services = items.length ? await db.select('services', { id: items.map((i) => i.service_id) }) : [];
      return {
        booking,
        business: business ?? null,
        pro: pro ?? null,
        items: items.map((i) => ({ ...i, name: services.find((s) => s.id === i.service_id)?.name ?? 'Service' })),
      };
    },
  });
}

export function useReleaseHold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => getDb().releaseHold(bookingId),
    onSettled: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
