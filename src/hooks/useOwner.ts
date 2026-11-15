import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getDb } from '@/lib/db';
import type { ProfessionalService } from '@/lib/types';

/**
 * Business-mode data (React Query). Every key starts with 'owner', so one
 * invalidate after any save refreshes whatever screen is showing.
 */
const OWNER = 'owner';

/** The signed-in owner's business, or null before "Set up business" is finished. */
export function useMyBusiness() {
  return useQuery({
    queryKey: [OWNER, 'business'],
    queryFn: async () => {
      const db = getDb();
      const uid = await db.userId();
      if (!uid) return null;
      const rows = await db.select('businesses', { owner_id: uid }, 'created_at');
      return rows[0] ?? null;
    },
  });
}

export function useBusinessHours(businessId?: string) {
  return useQuery({
    queryKey: [OWNER, 'hours', businessId],
    enabled: !!businessId,
    queryFn: () => getDb().select('business_hours', { business_id: businessId }, 'weekday'),
  });
}

export function useBusinessPhotos(businessId?: string) {
  return useQuery({
    queryKey: [OWNER, 'photos', businessId],
    enabled: !!businessId,
    queryFn: () => getDb().select('business_photos', { business_id: businessId }, 'sort_order'),
  });
}

export function useCategories() {
  return useQuery({ queryKey: [OWNER, 'categories'], staleTime: Infinity, queryFn: () => getDb().select('categories') });
}

export function useServices(businessId?: string) {
  return useQuery({
    queryKey: [OWNER, 'services', businessId],
    enabled: !!businessId,
    queryFn: () => getDb().select('services', { business_id: businessId }, 'sort_order'),
  });
}

export function useTeam(businessId?: string) {
  return useQuery({
    queryKey: [OWNER, 'team', businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const db = getDb();
      const pros = await db.select('professionals', { business_id: businessId });
      const links: ProfessionalService[] = pros.length
        ? await db.select('professional_services', { professional_id: pros.map((p) => p.id) })
        : [];
      return pros
        .sort((a, b) => a.first_name.localeCompare(b.first_name))
        .map((p) => ({ ...p, serviceIds: links.filter((l) => l.professional_id === p.id).map((l) => l.service_id) }));
    },
  });
}

export function useProPhotos(proId?: string) {
  return useQuery({
    queryKey: [OWNER, 'proPhotos', proId],
    enabled: !!proId,
    queryFn: () => getDb().select('professional_photos', { professional_id: proId }, 'sort_order'),
  });
}

export function useSchedule(proId?: string) {
  return useQuery({
    queryKey: [OWNER, 'schedule', proId],
    enabled: !!proId,
    queryFn: async () => {
      const db = getDb();
      const [availability, breaks] = await Promise.all([
        db.select('availability', { professional_id: proId }, 'weekday'),
        db.select('breaks', { professional_id: proId }, 'starts_at'),
      ]);
      return { availability, breaks };
    },
  });
}

/** Separate from the weekly schedule, so adding time off never wipes unsaved hour changes. */
export function useTimeOff(proId?: string) {
  return useQuery({
    queryKey: [OWNER, 'timeOff', proId],
    enabled: !!proId,
    queryFn: () => getDb().select('time_off', { professional_id: proId }, 'starts_at'),
  });
}

/** Wraps an owner action so every Business-mode screen refreshes when it finishes. */
export function useOwnerAction<A, R>(fn: (args: A) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    // Pass only the args: React Query also hands mutationFn a context object, which our
    // actions would otherwise take as their optional `db` parameter.
    mutationFn: (args: A) => fn(args),
    onSettled: () => qc.invalidateQueries({ queryKey: [OWNER] }),
  });
}
