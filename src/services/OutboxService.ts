/**
 * Scorpius Move — OutboxService.
 *
 * F2.10 outbox foto: persistência local (SQLite) de items pendentes
 * de sincronização com backend. Pattern do T069 Z-API (DLQ + retry
 * exponencial) — Guilherme confirmou em 02:14 que quer outbox.
 *
 * Schema:
 *  - id: PK auto-increment
 *  - type: 'proof_upload' | futuro 'delivery_sync' | etc.
 *  - payload: JSON stringificado (deliveryId, photoPath, signaturePath)
 *  - attempts: quantas vezes já tentou
 *  - next_retry_at: ms epoch (0 = immediate)
 *  - last_error: última mensagem de erro (null se sucesso)
 *  - created_at / updated_at: ms epoch
 *
 * Status implícito: row existe = pending; row removida = done.
 * Dead Letter Queue (DLQ): após MAX_ATTEMPTS (definido no SyncWorker),
 * next_retry_at vira 0 e fica "tóxico" — UI pode mostrar badge de failed.
 *
 * Decisões:
 *  - Singleton: o app inteiro compartilha o mesmo DB. Re-abrir o DB
 *    em hot reload não causa corrupção.
 *  - Sem transações explícitas: cada operação é atômica por si só
 *    (INSERT/UPDATE/DELETE de 1 row).
 *  - `next_retry_at` em ms epoch (Date.now()) — permite comparação
 *    simples `WHERE next_retry_at <= ?`.
 *  - Payload como TEXT JSON: SQLite não tem JSON nativo, e
 *    json_extract() precisaria de schema fixo. TEXT é flexível.
 */
import * as SQLite from 'expo-sqlite';

/**
 * Número máximo de tentativas antes do item ir para DLQ.
 * Hardcoded aqui (não importado de SyncWorker) para evitar import circular
 * (SyncWorker importa este módulo para acessar o `outbox` singleton).
 * Mantido em sincronia com BACKOFF_SECONDS.length em SyncWorker.ts.
 */
const MAX_ATTEMPTS = 5;

export type OutboxType = 'proof_upload';

export interface OutboxItem {
  id: number;
  type: OutboxType;
  payload: Record<string, unknown>;
  attempts: number;
  next_retry_at: number;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

interface OutboxRow {
  id: number;
  type: string;
  payload: string;
  attempts: number;
  next_retry_at: number;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

const DB_NAME = 'scorpius-move-outbox.db';
const SCHEMA_VERSION = 1;
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_retry_at INTEGER NOT NULL,
    last_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS outbox_next_retry_at_idx ON outbox (next_retry_at);
`;

export class OutboxService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Inicializa o DB (idempotente). Deve ser chamado antes de qualquer
   * operação. Safe para chamar múltiplas vezes — promises são cacheadas.
   */
  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(SCHEMA_SQL);
    // PRAGMA user_version para migrations futuras (não usadas em v1).
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    this.db = db;
  }

  /**
   * Enfileira um novo item. Retorna o id gerado.
   */
  async enqueue(type: OutboxType, payload: Record<string, unknown>): Promise<number> {
    await this.init();
    const db = this.requireDb();
    const now = Date.now();
    const stmt = await db.prepareAsync(
      `INSERT INTO outbox (type, payload, attempts, next_retry_at, last_error, created_at, updated_at)
       VALUES (?, ?, 0, 0, NULL, ?, ?)`,
    );
    const result = await stmt.executeAsync([type, JSON.stringify(payload), now, now]);
    await stmt.finalizeAsync();
    return result.lastInsertRowId;
  }

  /**
   * Marca item como falho: incrementa attempts e atualiza next_retry_at
   * (controlado pelo SyncWorker via backoff exponencial).
   */
  async markFailed(id: number, error: string, nextRetryAt: number): Promise<void> {
    await this.init();
    const db = this.requireDb();
    const now = Date.now();
    const stmt = await db.prepareAsync(
      `UPDATE outbox
       SET attempts = attempts + 1,
           next_retry_at = ?,
           last_error = ?,
           updated_at = ?
       WHERE id = ?`,
    );
    await stmt.executeAsync([nextRetryAt, error, now, id]);
    await stmt.finalizeAsync();
  }

  /**
   * Marca item como done: remove da tabela. Caller deve garantir que
   * o upload foi confirmado pelo backend antes de chamar.
   */
  async markDone(id: number): Promise<void> {
    await this.init();
    const db = this.requireDb();
    const stmt = await db.prepareAsync(`DELETE FROM outbox WHERE id = ?`);
    await stmt.executeAsync([id]);
    await stmt.finalizeAsync();
  }

  /**
   * Retorna o próximo item pronto para processar (next_retry_at <= now),
   * ou null se não há nada pendente. Order by created_at (FIFO).
   */
  async next(): Promise<OutboxItem | null> {
    await this.init();
    const db = this.requireDb();
    const now = Date.now();
    const stmt = await db.prepareAsync(
      `SELECT id, type, payload, attempts, next_retry_at, last_error, created_at, updated_at
       FROM outbox
       WHERE next_retry_at <= ?
       ORDER BY created_at ASC
       LIMIT 1`,
    );
    const result = await stmt.executeAsync<OutboxRow>([now]);
    const rows = await result.getAllAsync();
    await stmt.finalizeAsync();
    if (rows.length === 0) return null;
    return rowToItem(rows[0]);
  }

  /**
   * Lista todos os items (para UI de debug/inspeção). Ordena por
   * created_at DESC (mais recente primeiro).
   */
  async getAll(): Promise<OutboxItem[]> {
    await this.init();
    const db = this.requireDb();
    const stmt = await db.prepareAsync(
      `SELECT id, type, payload, attempts, next_retry_at, last_error, created_at, updated_at
       FROM outbox
       ORDER BY created_at DESC`,
    );
    const result = await stmt.executeAsync<OutboxRow>([]);
    const rows = await result.getAllAsync();
    await stmt.finalizeAsync();
    return rows.map(rowToItem);
  }

  /**
   * Conta items pendentes (para badge de UI).
   */
  async count(): Promise<number> {
    await this.init();
    const db = this.requireDb();
    const stmt = await db.prepareAsync(`SELECT COUNT(*) as c FROM outbox`);
    const result = await stmt.executeAsync<{ c: number }>([]);
    const rows = await result.getAllAsync();
    await stmt.finalizeAsync();
    return rows[0]?.c ?? 0;
  }

  /**
   * T098 — DLQ items: `attempts >= MAX_ATTEMPTS` E `next_retry_at = 0`.
   * Lista para o motorista ver o que falhou e reenviar manualmente.
   * Importante: filtra também por attempts para não confundir com items
   * "ready to process" (next_retry_at = 0 + attempts < MAX).
   */
  async getDLQItems(): Promise<OutboxItem[]> {
    await this.init();
    const db = this.requireDb();
    const stmt = await db.prepareAsync(
      `SELECT id, type, payload, attempts, next_retry_at, last_error, created_at, updated_at
       FROM outbox
       WHERE next_retry_at = 0 AND attempts >= ?
       ORDER BY created_at DESC`,
    );
    const result = await stmt.executeAsync<OutboxRow>([MAX_ATTEMPTS]);
    const rows = await result.getAllAsync();
    await stmt.finalizeAsync();
    return rows.map(rowToItem);
  }

  /**
   * T098 — badge "X itens na DLQ".
   */
  async getDLQCount(): Promise<number> {
    await this.init();
    const db = this.requireDb();
    const stmt = await db.prepareAsync(
      `SELECT COUNT(*) as c FROM outbox WHERE next_retry_at = 0 AND attempts >= ?`,
    );
    const result = await stmt.executeAsync<{ c: number }>([MAX_ATTEMPTS]);
    const rows = await result.getAllAsync();
    await stmt.finalizeAsync();
    return rows[0]?.c ?? 0;
  }

  /**
   * T098 — re-enfileira item da DLQ: zera attempts + last_error.
   * Mantém next_retry_at = 0 (immediate). SyncWorker.tick() vai pegar
   * no próximo tick.
   *
   * Pré-condição: item está na DLQ (attempts >= MAX_ATTEMPTS).
   */
  async retryDLQ(id: number): Promise<void> {
    await this.init();
    const db = this.requireDb();
    const now = Date.now();
    const stmt = await db.prepareAsync(
      `UPDATE outbox
       SET attempts = 0,
           next_retry_at = 0,
           last_error = NULL,
           updated_at = ?
       WHERE id = ? AND attempts >= ?`,
    );
    await stmt.executeAsync([now, id, MAX_ATTEMPTS]);
    await stmt.finalizeAsync();
  }

  /**
   * Fecha o DB. Útil em testes; em produção o app não chama isto.
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
      this.initPromise = null;
    }
  }

  private requireDb(): SQLite.SQLiteDatabase {
    if (!this.db) {
      throw new Error('OutboxService.init() deve ser chamado antes de qualquer operação.');
    }
    return this.db;
  }
}

function rowToItem(row: OutboxRow): OutboxItem {
  return {
    id: row.id,
    type: row.type as OutboxType,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    attempts: row.attempts,
    next_retry_at: row.next_retry_at,
    last_error: row.last_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Singleton instance para uso em produção.
export const outbox = new OutboxService();
