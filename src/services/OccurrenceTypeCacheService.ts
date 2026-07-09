import * as SQLite from 'expo-sqlite';
import type { DriverOccurrenceType } from '@/api/occurrenceTypes';

const DB_NAME = 'scorpius-move-cache.db';
const CACHE_ROW_ID = 1;

export class OccurrenceTypeCacheService {
  private db: SQLite.SQLiteDatabase | null = null;

  private async getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS occurrence_types_cache (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          payload TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);
    }
    return this.db;
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
