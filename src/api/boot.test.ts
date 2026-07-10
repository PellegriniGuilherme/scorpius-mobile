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
  uploadDeliveryFile: jest.fn(),
  storeDeliveryProof: jest.fn(),
  completeDelivery: jest.fn(),
}));

describe('boot wiring', () => {
  beforeEach(() => {
    _resetSyncWorkerBootForTests();
    jest.restoreAllMocks();
    (deliveries.uploadDeliveryFile as jest.Mock).mockReset();
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
    it('faz upload multipart → proof → complete', async () => {
      (deliveries.uploadDeliveryFile as jest.Mock)
        .mockResolvedValueOnce({
          key: 'companies/1/proof/photo.jpg',
          url: 'https://sfo3.digitaloceanspaces.com/scorpius.hub/companies/1/proof/photo.jpg',
          content_type: 'image/jpeg',
        })
        .mockResolvedValueOnce({
          key: 'companies/1/proof/sig.png',
          url: 'https://sfo3.digitaloceanspaces.com/scorpius.hub/companies/1/proof/sig.png',
          content_type: 'image/png',
        });
      (deliveries.storeDeliveryProof as jest.Mock).mockResolvedValue(undefined);
      (deliveries.completeDelivery as jest.Mock).mockResolvedValue({});

      const adapter = createProofUploadAdapter();
      await adapter.uploadProof({
        deliveryId: 1001,
        photoPath: 'file:///cache/proofs/1001.jpg',
        signaturePath: 'file:///cache/proofs/1001-sig.png',
        signatureName: 'João da Silva',
      });

      expect(deliveries.uploadDeliveryFile).toHaveBeenNthCalledWith(
        1,
        1001,
        'proof_of_delivery',
        'file:///cache/proofs/1001.jpg',
        'image/jpeg',
      );
      expect(deliveries.uploadDeliveryFile).toHaveBeenNthCalledWith(
        2,
        1001,
        'signature',
        'file:///cache/proofs/1001-sig.png',
        'image/png',
      );
      expect(deliveries.storeDeliveryProof).toHaveBeenCalledWith(1001, {
        photo_url: 'https://sfo3.digitaloceanspaces.com/scorpius.hub/companies/1/proof/photo.jpg',
        signature_url: 'https://sfo3.digitaloceanspaces.com/scorpius.hub/companies/1/proof/sig.png',
      });
      expect(deliveries.completeDelivery).toHaveBeenCalledWith(1001, {
        photo_url: 'https://sfo3.digitaloceanspaces.com/scorpius.hub/companies/1/proof/photo.jpg',
        signature_url: 'https://sfo3.digitaloceanspaces.com/scorpius.hub/companies/1/proof/sig.png',
        notes: 'Assinado por: João da Silva',
      });
    });

    it('faz upload parcial quando só foto é enviada', async () => {
      (deliveries.uploadDeliveryFile as jest.Mock).mockResolvedValueOnce({
        key: 'companies/1/proof/photo.jpg',
        url: 'https://sfo3.digitaloceanspaces.com/scorpius.hub/companies/1/proof/photo.jpg',
        content_type: 'image/jpeg',
      });
      (deliveries.storeDeliveryProof as jest.Mock).mockResolvedValue(undefined);
      (deliveries.completeDelivery as jest.Mock).mockResolvedValue({});

      const adapter = createProofUploadAdapter();
      await adapter.uploadProof({
        deliveryId: 1001,
        photoPath: 'file:///cache/proofs/1001.jpg',
        requiresPhoto: true,
        requiresSignature: false,
      });

      expect(deliveries.uploadDeliveryFile).toHaveBeenCalledTimes(1);
      expect(deliveries.storeDeliveryProof).toHaveBeenCalledWith(1001, {
        photo_url: 'https://sfo3.digitaloceanspaces.com/scorpius.hub/companies/1/proof/photo.jpg',
      });
      expect(deliveries.completeDelivery).toHaveBeenCalledWith(1001, {
        photo_url: 'https://sfo3.digitaloceanspaces.com/scorpius.hub/companies/1/proof/photo.jpg',
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

      expect(deliveries.uploadDeliveryFile).not.toHaveBeenCalled();
      expect(deliveries.storeDeliveryProof).not.toHaveBeenCalled();
      expect(deliveries.completeDelivery).toHaveBeenCalledWith(1002, {});
    });

    it('propaga erros do backend', async () => {
      (deliveries.uploadDeliveryFile as jest.Mock).mockRejectedValue(new Error('network error'));

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

    it('falha se upload proxy retornar erro', async () => {
      (deliveries.uploadDeliveryFile as jest.Mock).mockRejectedValue(new Error('Upload to storage failed'));

      const adapter = createProofUploadAdapter();
      await expect(
        adapter.uploadProof({
          deliveryId: 1001,
          photoPath: '/x.jpg',
          signaturePath: '/x-sig.png',
          signatureName: 'sig',
        }),
      ).rejects.toThrow('Upload to storage failed');
    });
  });
});
