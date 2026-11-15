import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';

import { getDb, type Db, type Filter } from '@/lib/db';
import { buildListings, type SalonListing } from '@/lib/discovery';
import { distanceMiles, NEW_YORK, type LatLng } from '@/lib/geo';
import type { Business, Favorite } from '@/lib/types';

/**
 * Customer-side data (React Query): salons, a salon page, a professional page, favorites and
 * the customer's location. Every key starts with 'discovery'.
 */
const KEY = 'discovery';

/** Reads salons plus everything a card or salon page shows, in 7 queries (not one per salon). */
async function loadListings(db: Db, filter: Filter<Business>): Promise<SalonListing[]> {
  const businesses = await db.select('businesses', filter, 'created_at');
  if (!businesses.length) return [];
  const business_id = businesses.map((b) => b.id);
  const [photos, hours, services, categories, pros, reviews] = await Promise.all([
    db.select('business_photos', { business_id }, 'sort_order'),
    db.select('business_hours', { business_id }, 'weekday'),
    db.select('services', { business_id }, 'sort_order'),
    db.select('categories'),
    db.select('professionals', { business_id }),
    db.select('public_reviews', { business_id }),
  ]);
  return buildListings({ businesses, photos, hours, services, categories, pros, reviews });
}

/** Every published salon (Home search, Explore). */
export function useListings() {
  return useQuery({ queryKey: [KEY, 'listings'], queryFn: () => loadListings(getDb(), { is_published: true }) });
}

/**
 * Salon page: the listing plus its team (with roles and photos), reviews, and who offers what.
 * Works for an owner previewing their own unpublished salon too — the database only lets
 * them read it because it's theirs.
 */
export function useSalon(id?: string) {
  return useQuery({
    queryKey: [KEY, 'salon', id],
    enabled: !!id,
    queryFn: async () => {
      const db = getDb();
      const [listing] = await loadListings(db, { id });
      if (!listing) return null;
      const pros = (await db.select('professionals', { business_id: id })).filter((p) => p.is_active);
      const proIds = pros.map((p) => p.id);
      const [links, reviews] = await Promise.all([
        proIds.length ? db.select('professional_services', { professional_id: proIds }) : Promise.resolve([]),
        db.select('public_reviews', { business_id: id }),
      ]);
      return {
        listing,
        pros: pros.sort((a, b) => a.first_name.localeCompare(b.first_name)),
        links,
        reviews: reviews.sort((a, b) => b.created_at.localeCompare(a.created_at)),
      };
    },
  });
}

/** Professional page (Pro.html). */
export function usePro(id?: string) {
  return useQuery({
    queryKey: [KEY, 'pro', id],
    enabled: !!id,
    queryFn: async () => {
      const db = getDb();
      const [pro] = await db.select('professionals', { id });
      if (!pro) return null;
      const [business] = await db.select('businesses', { id: pro.business_id });
      const [photos, links, services, reviews] = await Promise.all([
        db.select('professional_photos', { professional_id: id }, 'sort_order'),
        db.select('professional_services', { professional_id: id }),
        db.select('services', { business_id: pro.business_id }, 'sort_order'),
        db.select('public_reviews', { professional_id: id }),
      ]);
      const offered = new Set(links.map((l) => l.service_id));
      return {
        pro,
        business: business ?? null,
        photos,
        services: services.filter((s) => s.is_visible && offered.has(s.id)),
        reviews: reviews.sort((a, b) => b.created_at.localeCompare(a.created_at)),
      };
    },
  });
}

/** The signed-in customer's saved salons and professionals. Empty for guests. */
export function useFavorites() {
  return useQuery({
    queryKey: [KEY, 'favorites'],
    queryFn: async () => {
      const db = getDb();
      const uid = await db.userId();
      return uid ? db.select('favorites', { customer_id: uid }) : [];
    },
  });
}

export type FavoriteTarget = { business_id: string } | { professional_id: string };

const sameTarget = (f: Favorite, t: FavoriteTarget) =>
  'business_id' in t ? f.business_id === t.business_id : f.professional_id === t.professional_id;

export function isFavorite(favorites: Favorite[] | undefined, t: FavoriteTarget): boolean {
  return !!favorites?.some((f) => sameTarget(f, t));
}

/** Save / unsave. The heart fills straight away; it flips back if the save fails. */
export function useToggleFavorite() {
  const qc = useQueryClient();
  const key = [KEY, 'favorites'];
  return useMutation({
    mutationFn: async (t: FavoriteTarget) => {
      const db = getDb();
      const uid = await db.userId();
      if (!uid) throw new Error('Sign in to save favorites.');
      const mine = await db.select('favorites', { customer_id: uid, ...t });
      if (mine.length) await db.remove('favorites', { customer_id: uid, ...t });
      else await db.insert('favorites', [{ customer_id: uid, business_id: null, professional_id: null, ...t }]);
    },
    onMutate: async (t) => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<Favorite[]>(key);
      const list = before ?? [];
      const next = isFavorite(list, t)
        ? list.filter((f) => !sameTarget(f, t))
        : [...list, { id: 'pending', customer_id: '', business_id: null, professional_id: null, ...t }];
      qc.setQueryData(key, next);
      return { before };
    },
    onError: (_e, _t, ctx) => qc.setQueryData(key, ctx?.before),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

/** Farther than this from New York and we measure from the city instead. */
const SERVICE_RADIUS_MI = 60;

export type Origin = { point: LatLng; fromDevice: boolean };

/**
 * Where to measure distances from. Asks for location only when `ask` is true (the first time
 * Explore opens — SPEC §12); otherwise uses it only if already allowed. Falls back to New York.
 */
export function useOrigin(ask: boolean) {
  return useQuery({
    queryKey: [KEY, 'origin', ask],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Origin> => {
      const fallback = { point: NEW_YORK, fromDevice: false };
      try {
        let perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted && ask && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted) return fallback;
        const pos =
          (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 })) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        // Hairday is New York only for now: from far away, measure from the city instead of showing "2,500 mi".
        return distanceMiles(point, NEW_YORK) > SERVICE_RADIUS_MI ? fallback : { point, fromDevice: true };
      } catch {
        return fallback;
      }
    },
  });
}

/** Names and photos for the Favorites list on Profile. */
export function useFavoriteDetails() {
  const favorites = useFavorites();
  const ids = favorites.data ?? [];
  const businessIds = ids.map((f) => f.business_id).filter((x): x is string => !!x);
  const proIds = ids.map((f) => f.professional_id).filter((x): x is string => !!x);
  return useQuery({
    queryKey: [KEY, 'favoriteDetails', businessIds.join(','), proIds.join(',')],
    enabled: favorites.isSuccess,
    queryFn: async () => {
      const db = getDb();
      const [salons, pros, photos] = await Promise.all([
        businessIds.length ? db.select('businesses', { id: businessIds }) : Promise.resolve([]),
        proIds.length ? db.select('professionals', { id: proIds }) : Promise.resolve([]),
        businessIds.length ? db.select('business_photos', { business_id: businessIds }, 'sort_order') : Promise.resolve([]),
      ]);
      const proSalons = pros.length ? await db.select('businesses', { id: [...new Set(pros.map((p) => p.business_id))] }) : [];
      return {
        salons: salons.map((b) => ({ business: b, photo: photos.find((p) => p.business_id === b.id)?.url ?? null })),
        pros: pros.map((p) => ({ pro: p, salonName: proSalons.find((b) => b.id === p.business_id)?.name ?? null })),
      };
    },
  });
}
