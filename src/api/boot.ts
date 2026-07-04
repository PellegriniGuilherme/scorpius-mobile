/**
 * Scorpius Move — boot wiring: SyncWorker + proof upload adapter.
 */
import {
  completeDelivery,
  requestProofUploadUrl,
  storeDeliveryProof,
} from '@/api/deliveries';
import { syncWorker, type ApiClient, type ProofUploadPayload } from '@/services/SyncWorker';

async function uploadBinaryToPresignedUrl(localUri: string, uploadUrl: string, contentType: string): Promise<string> {
  const fileResponse = await fetch(localUri);
  const blob = await fileResponse.blob();
  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!putResponse.ok) {
    throw new Error(`Presigned upload failed: ${putResponse.status}`);
  }
  return uploadUrl.split('?')[0] ?? uploadUrl;
}

export function createProofUploadAdapter(): ApiClient {
  return {
    async uploadProof(
      payload: ProofUploadPayload,
      options?: { idempotencyKey?: string },
    ): Promise<void> {
      const idempotencyKey = options?.idempotencyKey ?? crypto.randomUUID();
      void idempotencyKey;

      const photoPresign = await requestProofUploadUrl(payload.deliveryId, 'proof_of_delivery', 'image/jpeg');
      const photoUrl = await uploadBinaryToPresignedUrl(
        payload.photoPath,
        photoPresign.url,
        photoPresign.content_type,
      );

      await storeDeliveryProof(payload.deliveryId, {
        photo_url: photoUrl,
        signature_url: null,
      });

      await completeDelivery(payload.deliveryId, {
        photo_url: photoUrl,
        notes: payload.signatureName ? `Assinado por: ${payload.signatureName}` : undefined,
      });
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
      await ingestOccurrences(payload.batchId, [payload.occurrence]);
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
