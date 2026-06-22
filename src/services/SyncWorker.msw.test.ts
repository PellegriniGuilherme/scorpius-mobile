/**
 * Scorpius Move — SyncWorker + OutboxService E2E integration test (T106).
 *
 * Valida o flow R-M3 end-to-end usando jest.spyOn em apiClient (evita
 * jest.mock complications).
 */

import { setupSyncWorker, _resetSyncWorkerBootForTests, createProofUploadAdapter } from '@/api/boot';
import { OutboxService, outbox as defaultOutbox } from './OutboxService';
import { syncWorker } from './SyncWorker';
import { apiClient } from '@/api/client';
import { __resetMockDb } from '../../jest.sqlite-mock.js';

describe('SyncWorker E2E integration (T106 — R-M3)', () => {
  let freshOutbox: OutboxService;
  let postSpy: jest.SpyInstance;
  let putSpy: jest.SpyInstance;

  beforeEach(async () => {
    __resetMockDb();
    _resetSyncWorkerBootForTests();
    // Reset singleton internal state via type assertion (test-only).
    const w = syncWorker as unknown as {
      isOnline: boolean;
      isAppActive: boolean;
      ticking: boolean;
      unsubscribeNet: (() => void) | null;
      appStateSub: { remove: () => void } | null;
    };
    w.isOnline = true;
    w.isAppActive = true;
    w.ticking = false;
    w.unsubscribeNet?.();
    w.appStateSub?.remove();
    w.unsubscribeNet = null;
    w.appStateSub = null;
    syncWorker.setApiClient(null as never);
    setupSyncWorker();
    // Spy on apiClient.post/put com fresh jest.fn mocks
    postSpy = jest.spyOn(apiClient, 'post').mockImplementation(() => Promise.resolve({ data: {} } as never));
    putSpy = jest.spyOn(apiClient, 'put').mockImplementation(() => Promise.resolve({ data: {} } as never));
    freshOutbox = new OutboxService();
    await freshOutbox.init();
    // IMPORTANTE: syncWorker precisa usar freshOutbox (defaultOutbox é o
    // singleton com DB stale após resetMockDb).
    syncWorker.setOutbox(freshOutbox);
  });

  afterEach(async () => {
    await freshOutbox.close();
    postSpy.mockRestore();
    putSpy.mockRestore();
    syncWorker.setApiClient(null as never);
    // Reset outbox to singleton for next test isolation
    syncWorker.setOutbox(defaultOutbox);
  });

  it('happy path: setupSyncWorker + enqueue + tick → markDone (item removido)', async () => {
    postSpy
      .mockResolvedValueOnce({ data: { uploadUrl: 'http://mock-spaces/upload/abc' } } as never)
      .mockResolvedValueOnce({ data: { ok: true } } as never);
    putSpy.mockResolvedValueOnce({ data: { ok: true } } as never);

    const id = await freshOutbox.enqueue('proof_upload', {
      deliveryId: 1001,
      photoPath: '/cache/proofs/1001.jpg',
      signaturePath: 'João da Silva',
    });

    const processed = await syncWorker.tick();
    expect(processed).toBe(true);

    expect(postSpy).toHaveBeenCalledWith(
      '/deliveries/1001/proof-upload',
      { signatureName: 'João da Silva' },
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': expect.stringMatching(/^[0-9a-f-]{36}$/),
        }),
      }),
    );
    expect(putSpy).toHaveBeenCalledWith('http://mock-spaces/upload/abc', {
      photoPath: '/cache/proofs/1001.jpg',
      signatureName: 'João da Silva',
    });
    expect(postSpy).toHaveBeenCalledWith(
      '/deliveries/1001/complete',
      {},
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': expect.stringMatching(/^[0-9a-f-]{36}$/),
        }),
      }),
    );

    const after = await freshOutbox.getAll();
    expect(after.find((i) => i.id === id)).toBeUndefined();
  });

  it('falha 500 no pre-signed: item fica pending com backoff (não loop infinito)', async () => {
    postSpy.mockRejectedValueOnce(new Error('500 server error'));

    const id = await freshOutbox.enqueue('proof_upload', {
      deliveryId: 2002,
      photoPath: '/cache/x.jpg',
      signaturePath: 'tester',
    });

    const processed = await syncWorker.tick();
    expect(processed).toBe(true);

    const after = await freshOutbox.getAll();
    const item = after.find((i) => i.id === id);
    expect(item).toBeDefined();
    expect(item?.attempts).toBe(1);
    expect(item?.last_error).toContain('500 server error');
    expect(item?.next_retry_at).toBeGreaterThan(Date.now() - 1000);
    expect(putSpy).not.toHaveBeenCalled();
  });

  it('falha no PUT Spaces: item fica pending com backoff', async () => {
    postSpy.mockResolvedValueOnce({ data: { uploadUrl: 'http://mock-spaces/x' } } as never);
    putSpy.mockRejectedValueOnce(new Error('upload failed'));

    const id = await freshOutbox.enqueue('proof_upload', {
      deliveryId: 3003,
      photoPath: '/cache/y.jpg',
      signaturePath: 'sig',
    });

    await syncWorker.tick();

    const after = await freshOutbox.getAll();
    const item = after.find((i) => i.id === id);
    expect(item).toBeDefined();
    expect(item?.attempts).toBe(1);
    expect(item?.last_error).toContain('upload failed');
    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  it('falha no POST /complete: item fica pending com backoff', async () => {
    postSpy
      .mockResolvedValueOnce({ data: { uploadUrl: 'http://mock-spaces/x' } } as never)
      .mockRejectedValueOnce(new Error('complete failed'));
    putSpy.mockResolvedValueOnce({ data: { ok: true } } as never);

    const id = await freshOutbox.enqueue('proof_upload', {
      deliveryId: 4004,
      photoPath: '/cache/z.jpg',
      signaturePath: 'sig2',
    });

    await syncWorker.tick();

    const after = await freshOutbox.getAll();
    const item = after.find((i) => i.id === id);
    expect(item).toBeDefined();
    expect(item?.attempts).toBe(1);
    expect(item?.last_error).toContain('complete failed');
  });

  it('5 falhas consecutivas → item vai para DLQ (next_retry_at = 0 + attempts = 5)', async () => {
    const id = await freshOutbox.enqueue('proof_upload', {
      deliveryId: 5005,
      photoPath: '/cache/dlq.jpg',
      signaturePath: 'never-works',
    });

    for (let i = 0; i < 5; i++) {
      await freshOutbox.markFailed(id, 'simulated failure', 0);
    }

    const after = await freshOutbox.getAll();
    const item = after.find((i) => i.id === id);
    expect(item).toBeDefined();
    expect(item?.attempts).toBe(5);
    expect(item?.next_retry_at).toBe(0);
  });

  it('sem setupSyncWorker (api=null): tick marca como pending com "api client not configured"', async () => {
    _resetSyncWorkerBootForTests();
    syncWorker.setApiClient(null as never);

    const id = await freshOutbox.enqueue('proof_upload', {
      deliveryId: 6006,
      photoPath: '/cache/none.jpg',
      signaturePath: 'tester',
    });

    const processed = await syncWorker.tick();
    expect(processed).toBe(true);

    const after = await freshOutbox.getAll();
    const item = after.find((i) => i.id === id);
    expect(item).toBeDefined();
    expect(item?.last_error).toContain('api client not configured');
  });

  it('createProofUploadAdapter pode ser injetado com http customizado (testabilidade)', async () => {
    const fakeHttp = {
      post: jest.fn().mockResolvedValue({ data: { uploadUrl: 'http://test/x' } }),
      put: jest.fn().mockResolvedValue({ status: 200 }),
    };
    const adapter = createProofUploadAdapter(fakeHttp as never);
    await adapter.uploadProof({
      deliveryId: 7777,
      photoPath: '/custom.jpg',
      signaturePath: 'custom',
    });

    expect(fakeHttp.post).toHaveBeenCalledWith(
      '/deliveries/7777/proof-upload',
      { signatureName: 'custom' },
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': expect.any(String),
        }),
      }),
    );
    expect(fakeHttp.put).toHaveBeenCalledWith('http://test/x', {
      photoPath: '/custom.jpg',
      signatureName: 'custom',
    });
    expect(fakeHttp.post).toHaveBeenCalledWith(
      '/deliveries/7777/complete',
      {},
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': expect.any(String),
        }),
      }),
    );

    // T100: mesma key nos dois POSTs (item estável).
    const calls = (fakeHttp.post as jest.Mock).mock.calls;
    const presignKey = (calls[0][2] as { headers: Record<string, string> }).headers['Idempotency-Key'];
    const completeKey = (calls[1][2] as { headers: Record<string, string> }).headers['Idempotency-Key'];
    expect(presignKey).toBe(completeKey);
  });
});