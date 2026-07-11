import { getCacheDatabase } from '@/services/sqlite/cacheDatabase';
import type { DriverOccurrenceType } from '@/api/occurrenceTypes';

const CACHE_ROW_ID = 1;

export class OccurrenceTypeCacheService {
  private async getDb() {
    return getCacheDatabase();
  }

  async save(types: DriverOccurrenceType[]): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO occurrence_types_cache (id, payload, updated_at) VALUES (?, ?, ?)',
      CACHE_ROW_ID,
      JSON.stringify(types),
      Date.now(),
    );
  }

  async load(): Promise<DriverOccurrenceType[] | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ payload: string }>(
      'SELECT payload FROM occurrence_types_cache WHERE id = ?',
      CACHE_ROW_ID,
    );
    if (!row) return null;
    return JSON.parse(row.payload) as DriverOccurrenceType[];
  }

  async clear(): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM occurrence_types_cache');
  }
}

export const occurrenceTypeCache = new OccurrenceTypeCacheService();
