// Distances for "0.4 mi" on salon cards and "Nearest first" sorting.

export type LatLng = { lat: number; lng: number };

/** Used when the customer says no to location, or before they're asked (SPEC §10: "if denied, use New York"). */
export const NEW_YORK: LatLng = { lat: 40.7359, lng: -73.9911 }; // Union Square

/** Straight-line distance in miles (haversine). */
export function distanceMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8; // Earth radius in miles
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 0.43 → "0.4 mi", 12.6 → "13 mi". */
export function formatMiles(mi: number): string {
  if (mi < 0.1) return '0.1 mi';
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
}

/** The map area that fits every point, with some room around the edges. */
export function regionFor(points: LatLng[], fallback: LatLng = NEW_YORK) {
  if (!points.length) return { latitude: fallback.lat, longitude: fallback.lng, latitudeDelta: 0.12, longitudeDelta: 0.12 };
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.5),
    longitudeDelta: Math.max(0.02, (maxLng - minLng) * 1.5),
  };
}
