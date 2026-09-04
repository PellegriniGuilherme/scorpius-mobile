/**
 * Pure helpers for MapaRotaScreen — unit-testable without native maps.
 */

export type LatLng = { latitude: number; longitude: number };

/** ORS GeoJSON coordinates are [lng, lat]. */
export function polylineToLatLng(polyline: Array<[number, number]> | null | undefined): LatLng[] {
  if (!polyline?.length) return [];
  return polyline.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

export function formatFuelPrices(
  prices: Record<string, number>,
  labels: { gasolina: string; etanol: string; diesel: string },
): string {
  const parts: string[] = [];
  if (prices.gasolina != null) parts.push(`${labels.gasolina} R$ ${prices.gasolina.toFixed(2)}`);
  if (prices.etanol != null) parts.push(`${labels.etanol} R$ ${prices.etanol.toFixed(2)}`);
  if (prices.diesel != null) parts.push(`${labels.diesel} R$ ${prices.diesel.toFixed(2)}`);
  return parts.join(' · ');
}
