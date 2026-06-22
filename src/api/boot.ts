/**
 * Scorpius Move — boot wiring (T103 R-M3 fix).
 *
 * Background: o SyncWorker precisa de um `ApiClient` (interface com
 * `uploadProof(payload)`) para conseguir fazer upload dos items do
 * OutboxService. **Sem essa wiring, todo upload fica preso na fila**
 * porque `SyncWorker.api === null` → `processItem` faz markFailed
 * com "api client not configured" → item volta pro outbox com backoff
 * → retry loop infinito (até MAX_ATTEMPTS → DLQ órfão).
 *
 * Solução: `setupSyncWorker()` é chamado uma vez no boot do app
 * (em RootNavigator useEffect). Idempotente — safe chamar múltiplas vezes.
 */
import { apiClient } from './client';
import { syncWorker, type ApiClient, type ProofUploadPayload } from '@/services/SyncWorker';

/**
 * Adapta o `apiClient` Axios como `ApiClient` esperado pelo SyncWorker.
 *
 * Backend flow (T072 + T076 + T077):
 *   1. POST /api/v1/deliveries/{id}/proof-upload  → pre-signed URL do Spaces
 *   2. PUT <pre-signed-url>                        → upload foto + signature para Spaces
 *   3. POST /api/v1/deliveries/{id}/complete       → confirma entrega
 */
export function createProofUploadAdapter(http = apiClient): ApiClient {
  return {
    async uploadProof(
      payload: ProofUploadPayload,
      options?: { idempotencyKey?: string },
    ): Promise<void> {
      // T100: header `Idempotency-Key` por item do outbox. Estável em retries
      // → backend cacheia o response por 24h e dedup automaticamente.
      // Se options.idempotencyKey não vier (legado), gera UUID v4 via crypto.randomUUID().
      const idempotencyKey = options?.idempotencyKey ?? crypto.randomUUID();

      const presignRes = await http.post<{ uploadUrl: string }>(
        `/deliveries/${payload.deliveryId}/proof-upload`,
        { signatureName: payload.signaturePath },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      );
      const { uploadUrl } = presignRes.data;
      if (!uploadUrl) {
        throw new Error('proof-upload did not return uploadUrl');
      }

      // PUT para Spaces (pre-signed) — sem idempotency-key (URL já é único).
      await http.put(uploadUrl, {
        photoPath: payload.photoPath,
        signatureName: payload.signaturePath,
      });

      // POST /complete — mesma idempotency-key (evita double-complete).
      await http.post(
        `/deliveries/${payload.deliveryId}/complete`,
        {},
        { headers: { 'Idempotency-Key': idempotencyKey } },
      );
    },
  };
}

let booted = false;

/**
 * Wire-up do boot do app: injeta o ApiClient no SyncWorker singleton.
 *
 * Idempotente: chamadas múltiplas (hot reload, etc.) são no-op após a primeira.
 * Seguro chamar antes do login — o SyncWorker só age quando há items no outbox.
 */
export function setupSyncWorker(): void {
  if (booted) return;
  syncWorker.setApiClient(createProofUploadAdapter());
  booted = true;
}

/**
 * Reset do flag de boot (apenas para testes).
 */
export function _resetSyncWorkerBootForTests(): void {
  booted = false;
}