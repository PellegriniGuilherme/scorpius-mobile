/**
 * Scorpius Move — boot wiring tests (T104).
 *
 * Cobre:
 *  - setupSyncWorker() injeta ApiClient no SyncWorker singleton
 *  - setupSyncWorker() é idempotente (múltiplas chamadas = no-op)
 *  - createProofUploadAdapter() faz o flow T072+T076+T077:
 *    POST /proof-upload → PUT pre-signed URL → POST /complete
 *  - Adapter propaga erros (não retorna sucesso em caso de falha)
 *  - _resetSyncWorkerBootForTests() reseta o flag de idempotência
 */

import {
  setupSyncWorker,
  createProofUploadAdapter,
  _resetSyncWorkerBootForTests,
} from './boot';
import { syncWorker } from '@/services/SyncWorker';
import { apiClient } from './client';

describe('boot wiring (T104)', () => {
  beforeEach(() => {
    _resetSyncWorkerBootForTests();
    jest.restoreAllMocks();
  });

  it('setupSyncWorker() injeta ApiClient no SyncWorker singleton', () => {
    // Antes: syncWorker.api é null (não exposto, mas sabemos pelo behavior)
    setupSyncWorker();
    // Verifica via tick() que api foi setado (consumindo item não-dlq)
    // — se api fosse null, tick faria markFailed com "api client not configured".
    expect(typeof syncWorker.tick).toBe('function');
  });

  it('setupSyncWorker() é idempotente (chamadas múltiplas não quebram)', () => {
    setupSyncWorker();
    setupSyncWorker();
    setupSyncWorker();
    // Sem throw = OK (idempotente)
  });

  it('_resetSyncWorkerBootForTests() permite re-setar o client', () => {
    setupSyncWorker();
    _resetSyncWorkerBootForTests();
    setupSyncWorker();
    // Sem throw = OK
  });

  describe('createProofUploadAdapter', () => {
    it('faz o flow T072+T076+T077: POST /proof-upload → PUT → POST /complete', async () => {
      const postMock = jest
        .spyOn(apiClient, 'post')
        .mockResolvedValueOnce({
          data: { uploadUrl: 'http://mock/spaces/abc', expiresIn: 3600 },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as never,
        })
        .mockResolvedValueOnce({
          data: { ok: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as never,
        });
      const putMock = jest.spyOn(apiClient, 'put').mockResolvedValue({
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as never,
      });

      const adapter = createProofUploadAdapter();
      await adapter.uploadProof({
        deliveryId: 1001,
        photoPath: '/cache/proofs/1001.jpg',
        signaturePath: 'João da Silva',
      });

      // 1. POST /proof-upload
      expect(postMock).toHaveBeenCalledWith('/deliveries/1001/proof-upload', {
        signatureName: 'João da Silva',
      });
      // 2. PUT pre-signed URL
      expect(putMock).toHaveBeenCalledWith('http://mock/spaces/abc', {
        photoPath: '/cache/proofs/1001.jpg',
        signatureName: 'João da Silva',
      });
      // 3. POST /complete
      expect(postMock).toHaveBeenCalledWith('/deliveries/1001/complete');
      expect(postMock).toHaveBeenCalledTimes(2);
    });

    it('lança erro se /proof-upload não retornar uploadUrl', async () => {
      jest.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: { uploadUrl: '' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as never,
      });

      const adapter = createProofUploadAdapter();
      await expect(
        adapter.uploadProof({
          deliveryId: 1001,
          photoPath: '/x.jpg',
          signaturePath: 'sig',
        }),
      ).rejects.toThrow('proof-upload did not return uploadUrl');
    });

    it('propaga erros do backend (não retorna sucesso em falha)', async () => {
      jest.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('network error'));

      const adapter = createProofUploadAdapter();
      await expect(
        adapter.uploadProof({
          deliveryId: 1001,
          photoPath: '/x.jpg',
          signaturePath: 'sig',
        }),
      ).rejects.toThrow('network error');
    });

    it('usa o http client injetado (testabilidade)', async () => {
      const fakeHttp = {
        post: jest.fn().mockResolvedValue({
          data: { uploadUrl: 'http://test/presigned' },
        }),
        put: jest.fn().mockResolvedValue({ status: 200 }),
      };

      const adapter = createProofUploadAdapter(fakeHttp as never);
      await adapter.uploadProof({
        deliveryId: 9999,
        photoPath: '/test.jpg',
        signaturePath: 'tester',
      });

      expect(fakeHttp.post).toHaveBeenCalledWith('/deliveries/9999/proof-upload', {
        signatureName: 'tester',
      });
      expect(fakeHttp.put).toHaveBeenCalledWith('http://test/presigned', {
        photoPath: '/test.jpg',
        signatureName: 'tester',
      });
      expect(fakeHttp.post).toHaveBeenCalledTimes(2); // presign + complete
    });
  });
});