import { decodePolyline, type MapCoordinate } from './decodePolyline';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DrivingRoute {
  coordinates: MapCoordinate[];
  encodedPolyline: string;
  distanceKm: number;
  durationMin: number;
}

interface DirectionsResponse {
  status: string;
  routes?: Array<{
    overview_polyline?: { points?: string };
    legs?: Array<{
      distance?: { value?: number };
      duration?: { value?: number };
    }>;
  }>;
}

export async function fetchDrivingRoute(
  origin: LatLng,
  destination: LatLng,
  apiKey: string,
): Promise<DrivingRoute | null> {
  if (!apiKey) return null;

  const params = new URLSearchParams({
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    mode: 'driving',
    language: 'pt-BR',
    key: apiKey,
  });

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`,
    );
    const data = (await response.json()) as DirectionsResponse;

    if (data.status !== 'OK') return null;

    const route = data.routes?.[0];
    const leg = route?.legs?.[0];
    const encoded = route?.overview_polyline?.points;
    const distanceMeters = leg?.distance?.value;
    const durationSeconds = leg?.duration?.value;

    if (!encoded || distanceMeters == null || durationSeconds == null) return null;

    return {
      coordinates: decodePolyline(encoded),
      encodedPolyline: encoded,
      distanceKm: distanceMeters / 1000,
      durationMin: Math.max(1, Math.round(durationSeconds / 60)),
    };
  } catch {
    return null;
  }
}

export interface DrivingRouteResult {
  route: DrivingRoute | null;
  fromCache: boolean;
}

export async function fetchDrivingRouteWithCache(
  origin: LatLng,
  destination: LatLng,
  apiKey: string,
): Promise<DrivingRouteResult> {
  const { buildRouteCacheKey, routeCache } = await import('@/services/RouteCacheService');
  const cacheKey = buildRouteCacheKey(origin, destination);
  const cached = await routeCache.get(cacheKey);
  if (cached) {
    return { route: cached, fromCache: true };
  }

  const route = await fetchDrivingRoute(origin, destination, apiKey);
  if (route) {
    await routeCache.save(cacheKey, route);
  }
  return { route, fromCache: false };
}
