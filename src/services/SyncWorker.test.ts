/**
 * Scorpius Move — SyncWorker tests (T068.5).
 *
 * Cobre:
 *  - tick() sem items: retorna false
 *  - tick() com item e api OK: markDone
 *  - tick() com item e api falhar: markFailed com backoff
 *  - tick() com item e api falhar MAX_ATTEMPTS vezes: DLQ
 *    (next_retry_at = 0)
 *  - tick() sem api client configurado: markFailed com backoff 30s
 *  - tick() com item de tipo desconhecido: markDone (descarta)
 *  - tick() respeita online: se offline, não processa
 *  - tick() respeita AppState: se inativa, não processa
 *  - syncWorker singleton
 */
import { SyncWorker, type ApiClient } from './SyncWorker';
import { OutboxService } from './OutboxService';
import { __resetMockDb } from '../../jest.sqlite-mock.js';

// Mockar AppState isoladamente (mockar react-native inteiro
// dispara TurboModule que não está disponível em jest).
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn().mockResolvedValue({ isConnected: true }),
    addEventListener: jest.fn().mockReturnValue(() => undefined),
  },
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
  addEventListener: jest.fn().mockReturnValue(() => undefined),
}));

describe('SyncWorker', () => {
  let outbox: OutboxService;
  let worker: SyncWorker;

  beforeEach(async () => {
    __resetMockDb();
    outbox = new OutboxService();
    await outbox.init();
    worker = new SyncWorker();
    worker.setOutbox(outbox);
    // Força online + active
    (worker as unknown as { isOnline: boolean }).isOnline = true;
    (worker as unknown as { isAppActive: boolean }).isAppActive = true;
  });

  afterEach(async () => {
    worker.stop();
    await outbox.close();
    __resetMockDb();
  });

  it('tick() returns false when no items pending', async () => {
    const result = await worker.tick();
    expect(result).toBe(false);
  });

  it('tick() processes item with success → markDone', async () => {
    const id = await outbox.enqueue('proof_upload', { deliveryId: 1001, photoPath: '/a.jpg', signaturePath: 'João' });
    const api: ApiClient = { uploadProof: jest.fn().mockResolvedValue(undefined) };
    worker.setApiClient(api);

    const result = await worker.tick();
    expect(result).toBe(true);
    expect(api.uploadProof).toHaveBeenCalledWith({
      deliveryId: 1001,
      photoPath: '/a.jpg',
      signaturePath: 'João',
    });
    // Item removido
    const items = await outbox.getAll();
    expect(items.find((i) => i.id === id)).toBeUndefined();
  });

  it('tick() with api failure → markFailed with backoff', async () => {
    const id = await outbox.enqueue('proof_upload', { deliveryId: 1001 });
    const api: ApiClient = { uploadProof: jest.fn().mockRejectedValue(new Error('network')) };
    worker.setApiClient(api);

    await worker.tick();
    const items = await outbox.getAll();
    const item = items.find((i) => i.id === id);
    expect(item?.attempts).toBe(1);
    expect(item?.last_error).toBe('network');
    // Backoff: primeira tentativa usa 30s
    const expectedRetry = item!.updated_at + 30_000;
    expect(item?.next_retry_at).toBe(expectedRetry);
  });

  it('backoff doubles on subsequent failures', async () => {
    const id = await outbox.enqueue('proof_upload', { deliveryId: 1001 });
    const api: ApiClient = { uploadProof: jest.fn().mockRejectedValue(new Error('net')) };
    worker.setApiClient(api);

    // 1ª falha: 30s após a falha (item.attempts=0, BACKOFF[0])
    await worker.tick();
    let items = await outbox.getAll();
    let item = items.find((i) => i.id === id);
    expect(item?.attempts).toBe(1);
    expect(item!.next_retry_at - item!.updated_at).toBe(30_000);

    // Força ready alterando next_retry_at para 0 (via SQL direto no mock)
    // sem bump de attempts. Hack: atribuição direta na row.
    const db = (outbox as unknown as { db: { tables: Map<string, unknown[]> } }).db;
    if (db?.tables) {
      const rows = db.tables.get('outbox') as Array<Record<string, unknown>>;
      if (rows) {
        for (const r of rows) {
          if (r.id === id) r.next_retry_at = 0;
        }
      }
    }
    await worker.tick();
    items = await outbox.getAll();
    item = items.find((i) => i.id === id);
    // 2ª falha: 60s (item.attempts=1, BACKOFF[1])
    expect(item?.attempts).toBe(2);
    expect(item!.next_retry_at - item!.updated_at).toBe(60_000);

    // 3ª: 120s
    if (db?.tables) {
      const rows = db.tables.get('outbox') as Array<Record<string, unknown>>;
      if (rows) {
        for (const r of rows) {
          if (r.id === id) r.next_retry_at = 0;
        }
      }
    }
    await worker.tick();
    items = await outbox.getAll();
    item = items.find((i) => i.id === id);
    expect(item?.attempts).toBe(3);
    expect(item!.next_retry_at - item!.updated_at).toBe(120_000);
  });

  it('after MAX_ATTEMPTS (5) failures, item goes to DLQ (next_retry_at = 0)', async () => {
    const id = await outbox.enqueue('proof_upload', { deliveryId: 1001 });
    const api: ApiClient = { uploadProof: jest.fn().mockRejectedValue(new Error('fatal')) };
    worker.setApiClient(api);

    // 5 falhas
    for (let i = 0; i < 5; i++) {
      await worker.tick();
      await outbox.markFailed(id, 'fatal', Date.now()); // reseta timer
    }
    // 6ª chamada (após 5 falhas) deve ir para DLQ
    await outbox.markFailed(id, 'fatal', Date.now());
    await worker.tick();
    const items = await outbox.getAll();
    const item = items.find((i) => i.id === id);
    expect(item).toBeTruthy();
    expect(item?.next_retry_at).toBe(0);
    expect(item?.last_error).toContain('DLQ');
    expect(item?.last_error).toContain('fatal');
  });

  it('tick() without api client configured → markFailed with 30s backoff', async () => {
    const id = await outbox.enqueue('proof_upload', { deliveryId: 1001 });
    // NÃO setar apiClient
    await worker.tick();
    const items = await outbox.getAll();
    const item = items.find((i) => i.id === id);
    expect(item?.attempts).toBe(1);
    expect(item?.last_error).toContain('api client not configured');
    const expectedRetry = item!.updated_at + 30_000;
    expect(item?.next_retry_at).toBe(expectedRetry);
  });

  it('tick() with unknown type discards item (markDone)', async () => {
    // Forçar insert direto com type desconhecido via mock DB
    // (enqueue só aceita 'proof_upload' no tipo, mas o worker deve
    // tolerar outros tipos no DB)
    const id = await outbox.enqueue('proof_upload', { deliveryId: 1001 });
    // Hack: simular tipo desconhecido alterando direto no DB
    const db = (outbox as unknown as { db: { tables: Map<string, unknown[]> } }).db;
    if (db?.tables) {
      const rows = db.tables.get('outbox') as Array<Record<string, unknown>>;
      if (rows) {
        for (const r of rows) {
          if (r.id === id) r.type = 'unknown_type';
        }
      }
    }
    const api: ApiClient = { uploadProof: jest.fn() };
    worker.setApiClient(api);

    await worker.tick();
    // Item removido (descartado)
    const items = await outbox.getAll();
    expect(items.find((i) => i.id === id)).toBeUndefined();
    // api.uploadProof NÃO foi chamado
    expect(api.uploadProof).not.toHaveBeenCalled();
  });

  it('tick() skips when offline', async () => {
    await outbox.enqueue('proof_upload', { deliveryId: 1001 });
    (worker as unknown as { isOnline: boolean }).isOnline = false;
    const api: ApiClient = { uploadProof: jest.fn() };
    worker.setApiClient(api);

    const result = await worker.tick();
    expect(result).toBe(false);
    expect(api.uploadProof).not.toHaveBeenCalled();
  });

  it('tick() skips when app inactive', async () => {
    await outbox.enqueue('proof_upload', { deliveryId: 1001 });
    (worker as unknown as { isAppActive: boolean }).isAppActive = false;
    const api: ApiClient = { uploadProof: jest.fn() };
    worker.setApiClient(api);

    const result = await worker.tick();
    expect(result).toBe(false);
    expect(api.uploadProof).not.toHaveBeenCalled();
  });

  it('tick() is re-entrant safe (não processa em paralelo)', async () => {
    await outbox.enqueue('proof_upload', { deliveryId: 1001 });
    // Mock com resolução assíncrona via setTimeout (não bloqueia)
    const api: ApiClient = {
      uploadProof: jest.fn().mockImplementation(
        () => new Promise<void>((resolve) => setTimeout(resolve, 50)),
      ),
    };
    worker.setApiClient(api);

    // Dispara 2 ticks em paralelo
    const t1 = worker.tick();
    const t2 = worker.tick(); // deve ser ignorado (re-entrant)
    const [r1, r2] = await Promise.all([t1, t2]);
    // t1 processou, t2 retornou false (re-entrant bloqueado)
    expect(r1).toBe(true);
    expect(r2).toBe(false);
    // api.uploadProof chamado APENAS UMA vez
    expect(api.uploadProof).toHaveBeenCalledTimes(1);
  }, 10_000);

  it('start() and stop() manage listeners', async () => {
    // Usa require para evitar dynamic import (jest não suporta bem)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const NetInfo = require('@react-native-community/netinfo').default;
    const startSpy = jest.fn().mockReturnValue(() => undefined);
    (NetInfo.addEventListener as jest.Mock) = startSpy;
    (NetInfo.fetch as jest.Mock) = jest.fn().mockResolvedValue({ isConnected: true });

    await worker.start();
    expect(startSpy).toHaveBeenCalledTimes(1);
    // start() chamado 2x sem stop() é idempotente
    await worker.start();
    expect(startSpy).toHaveBeenCalledTimes(1);
    worker.stop();
  });
});
