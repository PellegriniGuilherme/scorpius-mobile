/**
 * Scorpius Move — SyncWorker + OutboxService E2E integration test (T106).
 */
jest.mock('@/api/deliveries', () => ({
  uploadDeliveryFile: jest.fn(),
  storeDeliveryProof: jest.fn(),
  completeDelivery: jest.fn(),
}));

import * as deliveries from '@/api/deliveries';
import { setupSyncWorker, _resetSyncWorkerBootForTests, createProofUploadAdapter } from '@/api/boot';
import { OutboxService, outbox as defaultOutbox } from './OutboxService';
import { syncWorker } from './SyncWorker';
import { __resetMockDb } from '../../jest.sqlite-mock.js';

describe('SyncWorker E2E integration (T106 — R-M3)', () => {
  let freshOutbox: OutboxService;

  beforeEach(async () => {
    __resetMockDb();
    _resetSyncWorkerBootForTests();
    (deliveries.uploadDeliveryFile as jest.Mock).mockResolvedValue({
      key: 'companies/1/proof/abc.jpg',
      url: 'https://sfo3.digitaloceanspaces.com/scorpius.hub/companies/1/proof/abc.jpg',
      content_type: 'image/jpeg',
    });
    (deliveries.storeDeliveryProof as jest.Mock).mockResolvedValue(undefined);
    (deliveries.completeDelivery as jest.Mock).mockResolvedValue({});
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
    freshOutbox = new OutboxService();
    await freshOutbox.init();
    syncWorker.setOutbox(freshOutbox);
  });

  afterEach(async () => {
    await freshOutbox.close();
    syncWorker.setApiClient(null as never);
    syncWorker.setOutbox(defaultOutbox);
  });

  it('happy path: setupSyncWorker + enqueue + tick → markDone (item removido)', async () => {
    const id = await freshOutbox.enqueue('proof_upload', {
      deliveryId: 1001,
      photoPath: '/cache/proofs/1001.jpg',
      signatureName: 'João da Silva',
    });

    const processed = await syncWorker.tick();
    expect(processed).toBe(true);

    expect(deliveries.uploadDeliveryFile).toHaveBeenCalledWith(
      1001,
      'proof_of_delivery',
      '/cache/proofs/1001.jpg',
      'image/jpeg',
    );
    expect(deliveries.completeDelivery).toHaveBeenCalled();

    const after = await freshOutbox.getAll();
    expect(after.find((i) => i.id === id)).toBeUndefined();
  });

  it('falha 500 no upload proxy: item fica pending com backoff (não loop infinito)', async () => {
    (deliveries.uploadDeliveryFile as jest.Mock).mockRejectedValueOnce(new Error('500 server error'));

    const id = await freshOutbox.enqueue('proof_upload', {
      deliveryId: 2002,
      photoPath: '/cache/x.jpg',
      signatureName: 'tester',
    });

    const processed = await syncWorker.tick();
    expect(processed).toBe(true);

    const after = await freshOutbox.getAll();
    const item = after.find((i) => i.id === id);
    expect(item).toBeDefined();
    expect(item?.attempts).toBe(1);
    expect(item?.last_error).toContain('500 server error');
    expect(item?.next_retry_at).toBeGreaterThan(Date.now() - 1000);
  });

  it('falha no upload proxy: item fica pending com backoff', async () => {
    (deliveries.uploadDeliveryFile as jest.Mock).mockRejectedValueOnce(new Error('Upload to storage failed'));

    const id = await freshOutbox.enqueue('proof_upload', {
      deliveryId: 3003,
      photoPath: '/cache/y.jpg',
      signatureName: 'sig',
    });

    await syncWorker.tick();

    const after = await freshOutbox.getAll();
    const item = after.find((i) => i.id === id);
    expect(item).toBeDefined();
    expect(item?.attempts).toBe(1);
    expect(item?.last_error).toContain('Upload to storage failed');
  });

  it('falha no POST /complete: item fica pending com backoff', async () => {
    (deliveries.completeDelivery as jest.Mock).mockRejectedValueOnce(new Error('complete failed'));

    const id = await freshOutbox.enqueue('proof_upload', {
      deliveryId: 4004,
      photoPath: '/cache/z.jpg',
      signatureName: 'sig2',
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
      signatureName: 'never-works',
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
      signatureName: 'tester',
    });

    const processed = await syncWorker.tick();
    expect(processed).toBe(true);

    const after = await freshOutbox.getAll();
    const item = after.find((i) => i.id === id);
    expect(item).toBeDefined();
    expect(item?.last_error).toContain('api client not configured');
  });

  it('createProofUploadAdapter expõe uploadProof', () => {
    const adapter = createProofUploadAdapter();
    expect(adapter.uploadProof).toBeDefined();
  });
});
