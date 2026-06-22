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
import { SyncWorker, type ApiClient, syncWorker } from './SyncWorker';
import { OutboxService } from './OutboxService';
import { __resetMockDb } from '../../jest.sqlite-mock.js';

// Mockar AppState isoladamente (mockar react-native inteiro
// dispara TurboModule que não está disponível em jest).
// T115 SDK 56 + RN 0.85 + jest-preset@0.85: o resolution de react-native
// usa `require('./Libraries/AppState/AppState').default` (default export),
// não named export. Mock precisa expor `__esModule: true` + `default`.
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  },
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
    expect(api.uploadProof).toHaveBeenCalledWith(
      {
        deliveryId: 1001,
        photoPath: '/a.jpg',
        signaturePath: 'João',
      },
      expect.objectContaining({
        idempotencyKey: expect.any(String),
      }),
    );
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
    // T091 S3: backoff 30s ± 50% jitter → [15s, 45s]
    const backoffMs = item!.next_retry_at - item!.updated_at;
    expect(backoffMs).toBeGreaterThanOrEqual(15_000);
    expect(backoffMs).toBeLessThanOrEqual(45_000);
  });

  it('backoff doubles on subsequent failures', async () => {
    const id = await outbox.enqueue('proof_upload', { deliveryId: 1001 });
    const api: ApiClient = { uploadProof: jest.fn().mockRejectedValue(new Error('net')) };
    worker.setApiClient(api);

    // 1ª falha: 30s ± 50% jitter (item.attempts=0, BACKOFF[0])
    await worker.tick();
    let items = await outbox.getAll();
    let item = items.find((i) => i.id === id);
    expect(item?.attempts).toBe(1);
    const b1 = item!.next_retry_at - item!.updated_at;
    expect(b1).toBeGreaterThanOrEqual(15_000); // 30 * 0.5
    expect(b1).toBeLessThanOrEqual(45_000); // 30 * 1.5

    // Força ready alterando next_retry_at para 0 sem bump de attempts.
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
    // 2ª falha: 60s ± 50% jitter (item.attempts=1, BACKOFF[1])
    expect(item?.attempts).toBe(2);
    const b2 = item!.next_retry_at - item!.updated_at;
    expect(b2).toBeGreaterThanOrEqual(30_000); // 60 * 0.5
    expect(b2).toBeLessThanOrEqual(90_000); // 60 * 1.5

    // 3ª: 120s ± 50% jitter
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
    const b3 = item!.next_retry_at - item!.updated_at;
    expect(b3).toBeGreaterThanOrEqual(60_000); // 120 * 0.5
    expect(b3).toBeLessThanOrEqual(180_000); // 120 * 1.5
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

  // T091 S3: jitter 50% — múltiplos items falhando juntos NÃO devem
  // tentar retry no mesmo instante (thundering herd). Valida que
  // retries espalham em janela >1s após 5 simulações.
  it('jitter espalha retries em janela >1s (evita thundering herd)', async () => {
    // Mock Math.random para ser determinístico.
    // Cada chamada de jitteredBackoff() faz Math.random() uma vez.
    // Com Math.random() retornando 0.5, 0.625, 0.75, 0.875, 1.0,
    // os multiplicadores são 1.0, 1.125, 1.25, 1.375, 1.5 → backoffs
    // de 30s, 33.75s, 37.5s, 41.25s, 45s (variação total = 15s).
    const randSpy = jest.spyOn(Math, 'random');
    const multipliers = [0.5, 0.625, 0.75, 0.875, 1.0];
    let callIdx = 0;
    randSpy.mockImplementation(() => {
      const v = multipliers[callIdx] ?? 0.5;
      callIdx += 1;
      return v;
    });

    try {
      // Cada item: enqueue + tick (falha) + capturar backoff
      const backoffs: number[] = [];
      const baseBackoffSec = 30;
      for (let i = 0; i < multipliers.length; i++) {
        // Math.random() em jitteredBackoff() é o `multipliers[i]`.
        // jitter = 0.5 + multipliers[i]; backoffMs = baseBackoffSec * jitter * 1000
        const jitter = 0.5 + multipliers[i];
        const expectedMs = baseBackoffSec * jitter * 1000;
        const id = await outbox.enqueue('proof_upload', { deliveryId: 1001 + i });
        // Sem apiClient configurado → markFailed com jitter
        await worker.tick();
        const items = await outbox.getAll();
        const item = items.find((it) => it.id === id);
        expect(item).toBeTruthy();
        backoffs.push(item!.next_retry_at - item!.updated_at);
        // Verifica que cada backoff é próximo do esperado (±500ms jitter
        // interno: Math.round arredonda 37.5 → 38 → 38000 vs esperado 37500)
        expect(backoffs[i]).toBeGreaterThanOrEqual(expectedMs - 500);
        expect(backoffs[i]).toBeLessThanOrEqual(expectedMs + 500);
      }
      // Janela total = max - min deve ser > 1000ms (1s)
      const min = Math.min(...backoffs);
      const max = Math.max(...backoffs);
      expect(max - min).toBeGreaterThan(1000);
    } finally {
      randSpy.mockRestore();
    }
  });

  it('tick() without api client configured → markFailed with backoff (15-45s com jitter)', async () => {
    const id = await outbox.enqueue('proof_upload', { deliveryId: 1001 });
    // NÃO setar apiClient
    await worker.tick();
    const items = await outbox.getAll();
    const item = items.find((i) => i.id === id);
    expect(item?.attempts).toBe(1);
    expect(item?.last_error).toContain('api client not configured');
    // T091 S3: jitter 50% — backoff é 30s ± 50% → entre 15s e 45s
    const backoffMs = item!.next_retry_at - item!.updated_at;
    expect(backoffMs).toBeGreaterThanOrEqual(15_000);
    expect(backoffMs).toBeLessThanOrEqual(45_000);
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

// ---------------------------------------------------------------------------
// T103 R-M3: boot wiring garante que SyncWorker tem ApiClient no boot.
// Sem essa wiring, todo upload do outbox fica em retry loop infinito.
// ---------------------------------------------------------------------------

describe('SyncWorker boot wiring (T103 R-M3)', () => {
  // Mock axios ANTES de qualquer import (api/boot importa api/client que usa axios)
  jest.mock('@/api/client', () => ({
    apiClient: {
      post: jest.fn().mockResolvedValue({ data: { uploadUrl: 'http://mock/spaces/abc' } }),
      put: jest.fn().mockResolvedValue({ status: 200 }),
      get: jest.fn(),
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    },
    loadAccessToken: jest.fn().mockResolvedValue(null),
    setAccessToken: jest.fn().mockResolvedValue(undefined),
    registerSessionExpiredHandler: jest.fn(),
  }));

  it('setupSyncWorker() injeta ApiClient no SyncWorker singleton e é idempotente', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { setupSyncWorker, _resetSyncWorkerBootForTests } = require('@/api/boot');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { syncWorker } = require('@/services/SyncWorker');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OutboxService } = require('@/services/OutboxService');

    _resetSyncWorkerBootForTests();

    // Act: chama 3x (deve ser idempotente)
    setupSyncWorker();
    setupSyncWorker();
    setupSyncWorker();

    // Assert: syncWorker recebeu o api client (proxy: enqueue + tick não
    // devem entrar em retry loop com "api client not configured")
    const freshOutbox = new OutboxService();
    await freshOutbox.init();
    await freshOutbox.enqueue('proof_upload', {
      deliveryId: 9999,
      photoPath: '/tmp/x.jpg',
      signaturePath: 'test',
    });
    const item = await freshOutbox.next();
    expect(item).not.toBeNull();

    // Se api foi injetado, tick vai tentar upload (mock) → markDone
    // Se api NÃO foi injetado, tick faria markFailed com "api client not configured"
    const processed = await syncWorker.tick();
    expect(processed).toBe(true);

    // Verifica que item foi consumido (sucesso) e NÃO foi para retry
    const remaining = await freshOutbox.getAll();
    expect(remaining.find((i: { payload: { deliveryId: number } }) => i.payload.deliveryId === 9999)).toBeUndefined();

    await freshOutbox.close();
  });

  // T100: idempotency-key deve ser estável por item em retries.
  it('passa o mesmo idempotencyKey para uploadProof em retries', async () => {
    const uploadCalls: Array<{ payload: unknown; options: unknown }> = [];
    const api: ApiClient = {
      uploadProof: jest.fn(async (payload, options) => {
        uploadCalls.push({ payload, options });
        // Falha 1ª vez (retry), sucesso 2ª.
        if (uploadCalls.length < 2) {
          throw new Error('temporary 500');
        }
      }),
    };
    syncWorker.setApiClient(api);

    // Enfileira item com UUID determinístico (controle de teste)
    const customKey = 'stable-uuid-1234';
    const freshOutbox = new OutboxService();
    await freshOutbox.init();
    await freshOutbox.enqueue(
      'proof_upload',
      { deliveryId: 7777, photoPath: '/a.jpg', signaturePath: 'sig' },
      { idempotencyKey: customKey },
    );

    // Tick 1: falha → markFailed com backoff 0 (immediate retry)
    await freshOutbox.markFailed(
      (await freshOutbox.getAll())[0].id,
      'temp',
      Date.now(),
    );
    await syncWorker.tick();
    // Tick 2: sucesso → markDone
    await freshOutbox.markFailed(
      (await freshOutbox.getAll())[0].id,
      'temp2',
      Date.now(),
    );
    await syncWorker.tick();

    // Verifica: as 2 chamadas tiveram o MESMO idempotencyKey (item estável).
    expect(uploadCalls).toHaveLength(2);
    expect((uploadCalls[0].options as { idempotencyKey: string }).idempotencyKey).toBe(customKey);
    expect((uploadCalls[1].options as { idempotencyKey: string }).idempotencyKey).toBe(customKey);
    // Item foi removido após sucesso do 2º tick (markDone).
    const finalItems = await freshOutbox.getAll();
    expect(finalItems.find((i) => i.payload.deliveryId === 7777)).toBeUndefined();

    await freshOutbox.close();
  });
});
