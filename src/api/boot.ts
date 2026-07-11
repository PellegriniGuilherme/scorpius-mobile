/**
 * Scorpius Move — boot wiring: SyncWorker + proof upload adapter.
 */
import {
  completeDelivery,
  storeDeliveryProof,
  uploadDeliveryFile,
} from '@/api/deliveries';
import { generateUuid } from '@/lib/uuid';
import { applyServerDelivery } from '@/services/deliveryMutationService';
import { syncWorker, type ApiClient, type ProofUploadPayload } from '@/services/SyncWorker';

async function uploadLocalFileToBackend(
  localUri: string,
  deliveryId: number,
  documentType: 'proof_of_delivery' | 'signature' | 'occurrence_photo',
  contentType: 'image/jpeg' | 'image/png',
): Promise<{ key: string; url: string }> {
  const uploaded = await uploadDeliveryFile(deliveryId, documentType, localUri, contentType);
  return { key: uploaded.key, url: uploaded.url };
}

export function createProofUploadAdapter(): ApiClient {
  return {
    async uploadProof(
      payload: ProofUploadPayload,
      options?: { idempotencyKey?: string },
    ): Promise<void> {
      const idempotencyKey = options?.idempotencyKey ?? generateUuid();
      void idempotencyKey;

      let photoUrl: string | undefined;
      if (payload.photoPath) {
        const uploaded = await uploadLocalFileToBackend(
          payload.photoPath,
          payload.deliveryId,
          'proof_of_delivery',
          'image/jpeg',
        );
        photoUrl = uploaded.url;
      }

      let signatureUrl: string | undefined;
      if (payload.signaturePath) {
        const uploaded = await uploadLocalFileToBackend(
          payload.signaturePath,
          payload.deliveryId,
          'signature',
          'image/png',
        );
        signatureUrl = uploaded.url;
      }

      if (photoUrl || signatureUrl) {
        await storeDeliveryProof(payload.deliveryId, {
          ...(photoUrl ? { photo_url: photoUrl } : {}),
          ...(signatureUrl ? { signature_url: signatureUrl } : {}),
        });
      }

      const updated = await completeDelivery(payload.deliveryId, {
        ...(photoUrl ? { photo_url: photoUrl } : {}),
        ...(signatureUrl ? { signature_url: signatureUrl } : {}),
        ...(payload.signatureName ? { notes: `Assinado por: ${payload.signatureName}` } : {}),
      });
      await applyServerDelivery(updated);
    },
  };
}

/** Extended API client for SyncWorker outbox types */
export function createSyncApiClient(): ApiClient {
  const proofClient = createProofUploadAdapter();
  return {
    ...proofClient,
    async uploadProof(payload, options) {
      return proofClient.uploadProof(payload, options);
    },
    async executeDeliveryAction(payload) {
      const { executeDeliveryActionOnline } = await import('@/api/syncActions');
      await executeDeliveryActionOnline(payload);
    },
    async uploadOccurrence(payload) {
      const { ingestOccurrences } = await import('@/api/sync');

      let photoPaths = payload.occurrence.photo_paths;
      if (payload.photoPath) {
        const uploaded = await uploadLocalFileToBackend(
          payload.photoPath,
          payload.occurrence.delivery_id,
          'occurrence_photo',
          'image/jpeg',
        );
        photoPaths = [uploaded.key];
      }

      await ingestOccurrences(payload.batchId, [
        {
          ...payload.occurrence,
          photo_paths: photoPaths,
        },
      ]);
    },
  };
}

let booted = false;

export function setupSyncWorker(): void {
  if (booted) return;
  syncWorker.setApiClient(createSyncApiClient());
  booted = true;
}

export function _resetSyncWorkerBootForTests(): void {
  booted = false;
}
