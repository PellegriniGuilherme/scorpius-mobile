/**
 * Scorpius Move — boot wiring tests.
 */
import {
  setupSyncWorker,
  createProofUploadAdapter,
  _resetSyncWorkerBootForTests,
} from './boot';
import { syncWorker } from '@/services/SyncWorker';
import * as deliveries from '@/api/deliveries';

jest.mock('@/api/deliveries', () => ({
  requestProofUploadUrl: jest.fn(),
  storeDeliveryProof: jest.fn(),
  completeDelivery: jest.fn(),
}));

describe('boot wiring', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    _resetSyncWorkerBootForTests();
    jest.restoreAllMocks();
    global.fetch = mockFetch as typeof fetch;
    mockFetch.mockReset();
    (deliveries.requestProofUploadUrl as jest.Mock).mockReset();
    (deliveries.storeDeliveryProof as jest.Mock).mockReset();
    (deliveries.completeDelivery as jest.Mock).mockReset();
  });

  it('setupSyncWorker() injeta ApiClient no SyncWorker singleton', () => {
    setupSyncWorker();
    expect(typeof syncWorker.tick).toBe('function');
  });

  it('setupSyncWorker() é idempotente', () => {
    setupSyncWorker();
    setupSyncWorker();
  });

  it('_resetSyncWorkerBootForTests() permite re-setar o client', () => {
    setupSyncWorker();
    _resetSyncWorkerBootForTests();
    setupSyncWorker();
  });

  describe('createProofUploadAdapter', () => {
    it('faz upload-url → PUT binary → proof → complete', async () => {
      (deliveries.requestProofUploadUrl as jest.Mock)
        .mockResolvedValueOnce({
          url: 'http://mock/spaces/photo?sig=1',
          key: 'proofs/photo.jpg',
          content_type: 'image/jpeg',
          expires_at: '',
          method: 'PUT',
        })
        .mockResolvedValueOnce({
          url: 'http://mock/spaces/sig?sig=1',
          key: 'proofs/sig.png',
          content_type: 'image/png',
          expires_at: '',
          method: 'PUT',
        });
      mockFetch
        .mockResolvedValueOnce({ blob: async () => new Blob(['photo']) })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ blob: async () => new Blob(['sig']) })
        .mockResolvedValueOnce({ ok: true });
      (deliveries.storeDeliveryProof as jest.Mock).mockResolvedValue(undefined);
      (deliveries.completeDelivery as jest.Mock).mockResolvedValue({});

      const adapter = createProofUploadAdapter();
      await adapter.uploadProof({
        deliveryId: 1001,
        photoPath: 'file:///cache/proofs/1001.jpg',
        signaturePath: 'file:///cache/proofs/1001-sig.png',
        signatureName: 'João da Silva',
      });

      expect(deliveries.requestProofUploadUrl).toHaveBeenNthCalledWith(
        1,
        1001,
        'proof_of_delivery',
        'image/jpeg',
      );
      expect(deliveries.requestProofUploadUrl).toHaveBeenNthCalledWith(
        2,
        1001,
        'signature',
        'image/png',
      );
      expect(deliveries.storeDeliveryProof).toHaveBeenCalledWith(1001, {
        photo_url: 'http://mock/spaces/photo',
        signature_url: 'http://mock/spaces/sig',
      });
      expect(deliveries.completeDelivery).toHaveBeenCalledWith(1001, {
        photo_url: 'http://mock/spaces/photo',
        signature_url: 'http://mock/spaces/sig',
        notes: 'Assinado por: João da Silva',
      });
    });

    it('faz upload parcial quando só foto é enviada', async () => {
      (deliveries.requestProofUploadUrl as jest.Mock).mockResolvedValueOnce({
        url: 'http://mock/spaces/photo?sig=1',
        key: 'proofs/photo.jpg',
        content_type: 'image/jpeg',
        expires_at: '',
        method: 'PUT',
      });
      mockFetch
        .mockResolvedValueOnce({ blob: async () => new Blob(['photo']) })
        .mockResolvedValueOnce({ ok: true });
      (deliveries.storeDeliveryProof as jest.Mock).mockResolvedValue(undefined);
      (deliveries.completeDelivery as jest.Mock).mockResolvedValue({});

      const adapter = createProofUploadAdapter();
      await adapter.uploadProof({
        deliveryId: 1001,
        photoPath: 'file:///cache/proofs/1001.jpg',
        requiresPhoto: true,
        requiresSignature: false,
      });

      expect(deliveries.requestProofUploadUrl).toHaveBeenCalledTimes(1);
      expect(deliveries.storeDeliveryProof).toHaveBeenCalledWith(1001, {
        photo_url: 'http://mock/spaces/photo',
      });
      expect(deliveries.completeDelivery).toHaveBeenCalledWith(1001, {
        photo_url: 'http://mock/spaces/photo',
      });
    });

    it('completa sem proof quando nenhum arquivo é enviado', async () => {
      (deliveries.completeDelivery as jest.Mock).mockResolvedValue({});

      const adapter = createProofUploadAdapter();
      await adapter.uploadProof({
        deliveryId: 1002,
        requiresPhoto: false,
        requiresSignature: false,
      });

      expect(deliveries.requestProofUploadUrl).not.toHaveBeenCalled();
      expect(deliveries.storeDeliveryProof).not.toHaveBeenCalled();
      expect(deliveries.completeDelivery).toHaveBeenCalledWith(1002, {});
    });

    it('propaga erros do backend', async () => {
      (deliveries.requestProofUploadUrl as jest.Mock).mockRejectedValue(new Error('network error'));

      const adapter = createProofUploadAdapter();
      await expect(
        adapter.uploadProof({
          deliveryId: 1001,
          photoPath: '/x.jpg',
          signaturePath: '/x-sig.png',
          signatureName: 'sig',
        }),
      ).rejects.toThrow('network error');
    });

    it('falha se PUT presigned retornar erro', async () => {
      (deliveries.requestProofUploadUrl as jest.Mock).mockResolvedValue({
        url: 'http://mock/spaces/abc',
        key: 'k',
        content_type: 'image/jpeg',
        expires_at: '',
        method: 'PUT',
      });
      mockFetch
        .mockResolvedValueOnce({ blob: async () => new Blob(['photo']) })
        .mockResolvedValueOnce({ ok: false, status: 403 });

      const adapter = createProofUploadAdapter();
      await expect(
        adapter.uploadProof({
          deliveryId: 1001,
          photoPath: '/x.jpg',
          signaturePath: '/x-sig.png',
          signatureName: 'sig',
        }),
      ).rejects.toThrow('Presigned upload failed: 403');
    });
  });
});
