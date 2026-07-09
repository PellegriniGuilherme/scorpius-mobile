/**
 * Scorpius Move — boot wiring: SyncWorker + proof upload adapter.
 */
import {
  completeDelivery,
  requestProofUploadUrl,
  storeDeliveryProof,
} from '@/api/deliveries';
import { applyServerDelivery } from '@/services/deliveryMutationService';
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

      let photoUrl: string | undefined;
      if (payload.photoPath) {
        const photoPresign = await requestProofUploadUrl(payload.deliveryId, 'proof_of_delivery', 'image/jpeg');
        photoUrl = await uploadBinaryToPresignedUrl(
          payload.photoPath,
          photoPresign.url,
          photoPresign.content_type,
        );
      }

      let signatureUrl: string | undefined;
      if (payload.signaturePath) {
        const signaturePresign = await requestProofUploadUrl(payload.deliveryId, 'signature', 'image/png');
        signatureUrl = await uploadBinaryToPresignedUrl(
          payload.signaturePath,
          signaturePresign.url,
          signaturePresign.content_type,
        );
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
      const { requestProofUploadUrl } = await import('@/api/deliveries');

      let photoPaths = payload.occurrence.photo_paths;
      if (payload.photoPath) {
        const presign = await requestProofUploadUrl(
          payload.occurrence.delivery_id,
          'occurrence_photo',
          'image/jpeg',
        );
        await uploadBinaryToPresignedUrl(payload.photoPath, presign.url, presign.content_type);
        photoPaths = [presign.key];
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
