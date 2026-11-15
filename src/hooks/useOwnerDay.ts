import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ProSchedule } from '@/lib/availability';
import { getDb } from '@/lib/db';
import { isActive } from '@/lib/ownerDay';
import type { Booking, Client, Professional, Service, WalkInRequest } from '@/lib/types';

/** Keys start with 'owner', so any owner save refreshes Today, Calendar and Clients too. */
const KEY = ['owner', 'day'] as const;

export type SalonBooking = Booking & {
  client: Client | null;
  pro: Professional | null;
  /** Service names, in the order they were booked. */
  services: string[];
  minutes: number;
};

export type TeamMember = Professional & { schedule: Omit<ProSchedule, 'bookings'>; serviceIds: string[] };

/**
 * Everything the owner's day screens need for one salon: team with their hours, menu, clients and
 * bookings (with names). Refreshed every minute while a screen is open.
 */
export function useSalonDay(businessId?: string) {
  return useQuery({
    queryKey: [...KEY, businessId],
    enabled: !!businessId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const db = getDb();
      const [pros, services, hours, clients, bookings] = await Promise.all([
        db.select('professionals', { business_id: businessId }),
        db.select('services', { business_id: businessId }, 'sort_order'),
        db.select('business_hours', { business_id: businessId }),
        db.select('clients', { business_id: businessId }),
        db.select('bookings', { business_id: businessId }),
      ]);
      const active = pros.filter((p) => p.is_active).sort((a, b) => a.first_name.localeCompare(b.first_name));
      const ids = active.map((p) => p.id);
      const shown = bookings.filter((b) => isActive(b) || (b.status === 'cancelled' && b.payment_status !== 'none'));
      const [availability, breaks, timeOff, links, items] = await Promise.all([
        ids.length ? db.select('availability', { professional_id: ids }) : [],
        ids.length ? db.select('breaks', { professional_id: ids }) : [],
        ids.length ? db.select('time_off', { professional_id: ids }) : [],
        ids.length ? db.select('professional_services', { professional_id: ids }) : [],
        shown.length ? db.select('booking_services', { booking_id: shown.map((b) => b.id) }) : [],
      ]);
      const team: TeamMember[] = active.map((p) => ({
        ...p,
        serviceIds: links.filter((l) => l.professional_id === p.id).map((l) => l.service_id),
        schedule: {
          id: p.id,
          availability: availability.filter((a) => a.professional_id === p.id),
          breaks: breaks.filter((b) => b.professional_id === p.id),
          timeOff: timeOff.filter((t) => t.professional_id === p.id),
        },
      }));
      const withNames: SalonBooking[] = shown.map((b) => {
        const mine = items.filter((i) => i.booking_id === b.id);
        return {
          ...b,
          client: clients.find((c) => c.id === b.client_id) ?? null,
          pro: pros.find((p) => p.id === b.professional_id) ?? null,
          services: mine.map((i) => services.find((s: Service) => s.id === i.service_id)?.name ?? 'Service'),
          minutes: mine.reduce((s, i) => s + i.duration_min, 0),
        };
      });
      return { team, services, hours, clients, bookings: withNames };
    },
  });
}

/** A team member's week plus the bookings that block their time (what getAvailableSlots() wants). */
export function scheduleWithBookings(m: TeamMember, bookings: Booking[]): ProSchedule {
  return { ...m.schedule, bookings: bookings.filter((b) => b.professional_id === m.id && isActive(b)) };
}

function useDayAction<A, R>(fn: (a: A) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: A) => fn(a),
    // Refresh in the background: don't keep the button spinning while every owner screen reloads.
    onSettled: () => void qc.invalidateQueries({ queryKey: ['owner'] }),
  });
}

/** Walk-in sheet → "Add to calendar". Creates the client first when a new name was typed. */
export function useAddWalkIn() {
  return useDayAction(async (a: Omit<WalkInRequest, 'client_id'> & { client_id: string | null; newClientName?: string }) => {
    const db = getDb();
    let clientId = a.client_id;
    if (!clientId && a.newClientName?.trim()) {
      const [c] = await db.insert('clients', [{ business_id: a.business_id, name: a.newClientName.trim() }]);
      clientId = c!.id;
    }
    return db.addWalkIn({ ...a, client_id: clientId });
  });
}

export function useMarkBooking() {
  return useDayAction((a: { id: string; status: 'completed' | 'no_show' }) => getDb().markBooking(a.id, a.status));
}

/** The salon cancels: the client is never charged (SPEC §9). */
export function useSalonCancel() {
  return useDayAction((id: string) => getDb().cancelBooking(id));
}

export type ClientInput = {
  id?: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export function useSaveClient() {
  return useDayAction(async (c: ClientInput) => {
    const db = getDb();
    const { id, business_id, ...fields } = c;
    if (id) return (await db.update('clients', { id }, fields))[0]!;
    return (await db.insert('clients', [{ business_id, ...fields }]))[0]!;
  });
}

export function useDeleteClient() {
  return useDayAction((id: string) => getDb().remove('clients', { id }));
}

/** Import from contacts: adds the people picked, skipping anyone already on the list. */
export function useImportClients() {
  return useDayAction(async (a: { business_id: string; people: Omit<ClientInput, 'business_id' | 'notes'>[]; existing: Client[] }) => {
    const seen = (p: { name: string; email: string | null; phone: string | null }) =>
      a.existing.some(
        (c) =>
          (p.email && c.email?.toLowerCase() === p.email.toLowerCase()) ||
          (p.phone && c.phone && digits(c.phone) === digits(p.phone)) ||
          (!p.email && !p.phone && c.name.toLowerCase() === p.name.toLowerCase()),
      );
    const fresh = a.people.filter((p) => !seen(p));
    if (fresh.length)
      await getDb().insert(
        'clients',
        fresh.map((p) => ({ business_id: a.business_id, name: p.name, email: p.email, phone: p.phone })),
      );
    return { added: fresh.length, skipped: a.people.length - fresh.length };
  });
}

const digits = (s: string) => s.replace(/\D/g, '').slice(-10);
