import { getCacheDatabase, resetCacheDatabaseForTests } from '@/services/sqlite/cacheDatabase';
import type { DeliveryApi } from '@/types/delivery';

export class DeliveryCacheService {
  private async getDb() {
    return getCacheDatabase();
  }

  async upsertMany(deliveries: DeliveryApi[]): Promise<void> {
    const db = await this.getDb();
    const now = Date.now();
    for (const d of deliveries) {
      await db.runAsync(
        'INSERT OR REPLACE INTO deliveries_cache (id, payload, updated_at) VALUES (?, ?, ?)',
        d.id,
        JSON.stringify(d),
        now,
      );
    }
  }

  async upsertOne(delivery: DeliveryApi): Promise<void> {
    await this.upsertMany([delivery]);
  }

  async listAll(): Promise<DeliveryApi[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM deliveries_cache ORDER BY id DESC');
    return rows.map((r) => JSON.parse(r.payload) as DeliveryApi);
  }

  async getById(id: number): Promise<DeliveryApi | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ payload: string }>(
      'SELECT payload FROM deliveries_cache WHERE id = ?',
      id,
    );
    return row ? (JSON.parse(row.payload) as DeliveryApi) : null;
  }

  async patchStatus(id: number, status: DeliveryApi['status']): Promise<DeliveryApi | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const patched = { ...existing, status };
    await this.upsertOne(patched);
    return patched;
  }

  async patchFailure(id: number, reason: string): Promise<DeliveryApi | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const patched: DeliveryApi = {
      ...existing,
      status: 'failed',
      failure: {
        failed_at: new Date().toISOString(),
        reason,
      },
    };
    await this.upsertOne(patched);
    return patched;
  }

  async clear(): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM deliveries_cache');
  }
}

export const deliveryCache = new DeliveryCacheService();

export function _resetDeliveryCacheForTests(): void {
  resetCacheDatabaseForTests();
}
