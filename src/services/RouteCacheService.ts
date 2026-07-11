import { getCacheDatabase } from '@/services/sqlite/cacheDatabase';
import type { DrivingRoute } from '@/lib/googleDirections';
import type { LatLng } from '@/lib/googleDirections';

function roundCoord(value: number): string {
  return value.toFixed(4);
}

export function buildRouteCacheKey(origin: LatLng, destination: LatLng): string {
  return `${roundCoord(origin.lat)},${roundCoord(origin.lng)}->${roundCoord(destination.lat)},${roundCoord(destination.lng)}`;
}

export class RouteCacheService {
  private async getDb() {
    return getCacheDatabase();
  }

  async get(cacheKey: string): Promise<DrivingRoute | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ payload: string }>(
      'SELECT payload FROM driving_routes_cache WHERE cache_key = ?',
      cacheKey,
    );
    if (!row) return null;
    return JSON.parse(row.payload) as DrivingRoute;
  }

  async save(cacheKey: string, route: DrivingRoute): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO driving_routes_cache (cache_key, payload, updated_at) VALUES (?, ?, ?)',
      cacheKey,
      JSON.stringify(route),
      Date.now(),
    );
  }
}

export const routeCache = new RouteCacheService();
