import * as SQLite from 'expo-sqlite';
import type { DeliveryApi } from '@/types/delivery';

const DB_NAME = 'scorpius-move-cache.db';

export class DeliveryCacheService {
  private db: SQLite.SQLiteDatabase | null = null;

  private async getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS deliveries_cache (
          id INTEGER PRIMARY KEY,
          payload TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);
    }
    return this.db;
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

  async clear(): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM deliveries_cache');
  }
}

export const deliveryCache = new DeliveryCacheService();
