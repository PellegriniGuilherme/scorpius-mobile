/**
 * Scorpius Move — SyncWorker.
 *
 * F2.10 outbox foto: processa items do OutboxService com retry
 * exponencial [30s, 60s, 120s, 300s, 600s] + DLQ após MAX_ATTEMPTS.
 *
 * Backoff: mesmo padrão do T069 Z-API.
 *  - attempts 0 → 1: 30s
 *  - attempts 1 → 2: 60s
 *  - attempts 2 → 3: 120s
 *  - attempts 3 → 4: 300s
 *  - attempts 4 → 5: 600s
 *  - attempts >= 5 (MAX): marca como dead (next_retry_at = 0) — UI
 *    mostra badge de failed com botão "Reenviar" (limpa attempts).
 *
 * API:
 *  - start(): inicia listener de AppState + NetInfo
 *  - stop(): para listeners + limpa timers
 *  - tick(): processa UM item (idempotente). Público para testes
 *    e para retry manual.
 *  - setApiClient(client): injeta client HTTP (testabilidade)
 *  - setOutbox(svc): injeta outbox (testabilidade)
 *
 * Flow de tick():
 *  1. next() do outbox
 *  2. Se null: nada a fazer
 *  3. Se online (NetInfo) + item existe: tenta upload
 *  4. Sucesso: markDone
 *  5. Falha: markFailed com next_retry_at = now + BACKOFF[attempts]
 *  6. Se attempts >= MAX_ATTEMPTS: força dead (next_retry_at = 0,
 *     last_error = mensagem final)
 *
 * Decisões:
 *  - Não usa setInterval: tick é on-demand (AppState change,
 *    NetInfo change, ou após enqueue). Evita drain de bateria
 *    e reduz work em background.
 *  - NetInfo offline → NÃO tenta. Pula tick e agenda próximo
 *    via listener de mudança de conectividade.
 *  - Backoff é estático [30, 60, 120, 300, 600] (sem jitter por
 *    enquanto). Adicionar jitter se for problema em produção.
 *  - DLQ: row fica na tabela, com next_retry_at = 0 e attempts
 *    saturado. UI pode re-enfileirar (zera attempts + next_retry_at).
 */
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { outbox as defaultOutbox, type OutboxItem, type OutboxService } from './OutboxService';

const BACKOFF_SECONDS = [30, 60, 120, 300, 600] as const;
export const MAX_ATTEMPTS = BACKOFF_SECONDS.length; // 5

/**
 * T091 S3: jitter exponencial para evitar thundering herd.
 * Multiplicador entre [0.5, 1.5) — 50% mais cedo ou mais tarde.
 * Sem jitter, múltiplos items falhando juntos tentariam retry no
 * mesmo instante, causando pico de carga no backend.
 */
function jitteredBackoff(baseSeconds: number): number {
  const jitter = 0.5 + Math.random(); // [0.5, 1.5)
  return Math.round(baseSeconds * jitter);
}

export interface ProofUploadPayload {
  deliveryId: number;
  photoPath: string;
  signaturePath: string;
}

export interface ApiClient {
  /**
   * Faz upload do proof (foto + assinatura) para o backend.
   * Espera-se que o backend:
   *  1. Receba o pre-signed URL T076
   *  2. PUT para Spaces
   *  3. POST /api/v1/deliveries/{id}/complete T072
   * Throws em caso de falha (network, 4xx, 5xx).
   */
  uploadProof(payload: ProofUploadPayload): Promise<void>;
}

export class SyncWorker {
  private isOnline = true;
  private isAppActive = true;
  private unsubscribeNet: (() => void) | null = null;
  private appStateSub: { remove: () => void } | null = null;
  private api: ApiClient | null = null;
  private outboxSvc: OutboxService = defaultOutbox;
  private ticking = false; // evita re-entrância

  /**
   * Inicia os listeners. Idempotente — se já estiver rodando, no-op.
   */
  async start(): Promise<void> {
    if (this.unsubscribeNet) return;
    // Estado inicial de rede
    try {
      const state = await NetInfo.fetch();
      this.isOnline = !!state.isConnected;
    } catch {
      this.isOnline = true; // assume online se NetInfo falhar
    }
    this.unsubscribeNet = NetInfo.addEventListener(this.onNetChange);
    this.appStateSub = AppState.addEventListener('change', this.onAppStateChange);
    // Tenta processar backlog inicial
    void this.tick();
  }

  /**
   * Para os listeners. Não cancela tick em andamento.
   */
  stop(): void {
    if (this.unsubscribeNet) {
      this.unsubscribeNet();
      this.unsubscribeNet = null;
    }
    if (this.appStateSub) {
      this.appStateSub.remove();
      this.appStateSub = null;
    }
  }

  /**
   * Injeta o client HTTP. Default: null (vai falhar com erro claro).
   * Em produção, setar em boot do app.
   */
  setApiClient(client: ApiClient): void {
    this.api = client;
  }

  /**
   * Injeta outbox. Default: singleton.
   */
  setOutbox(svc: OutboxService): void {
    this.outboxSvc = svc;
  }

  /**
   * Processa UM item. Público para testes e retry manual.
   * Retorna true se processou um item, false se nada a fazer.
   */
  async tick(): Promise<boolean> {
    if (this.ticking) return false;
    if (!this.isOnline) return false;
    if (!this.isAppActive) return false;
    this.ticking = true;
    try {
      const item = await this.outboxSvc.next();
      if (!item) return false;
      await this.processItem(item);
      return true;
    } finally {
      this.ticking = false;
    }
  }

  /**
   * Processa o item. Se sucesso, markDone. Se falha, markFailed
   * com backoff. Se attempts >= MAX_ATTEMPTS, vai para DLQ.
   */
  private async processItem(item: OutboxItem): Promise<void> {
    if (!this.api) {
      // Sem client: tenta de novo em 30s. Evita marcar como failed
      // se a app ainda está bootando.
      const backoffMs = jitteredBackoff(30) * 1000;
      await this.outboxSvc.markFailed(
        item.id,
        'api client not configured',
        Date.now() + backoffMs,
      );
      return;
    }
    try {
      if (item.type !== 'proof_upload') {
        // Tipo desconhecido: descarta para não bloquear a fila
        await this.outboxSvc.markDone(item.id);
        return;
      }
      const payload = item.payload as unknown as ProofUploadPayload;
      await this.api.uploadProof(payload);
      await this.outboxSvc.markDone(item.id);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const nextAttempts = item.attempts + 1;
      if (nextAttempts >= MAX_ATTEMPTS) {
        // DLQ: marca como dead (next_retry_at = 0). UI pode re-tentar.
        await this.outboxSvc.markFailed(item.id, `[DLQ] ${error}`, 0);
        return;
      }
      const backoffMs = BACKOFF_SECONDS[item.attempts] * 1000;
      const nextRetryAt = Date.now() + backoffMs;
      await this.outboxSvc.markFailed(item.id, error, nextRetryAt);
    }
  }

  private onNetChange = (state: NetInfoState): void => {
    const wasOnline = this.isOnline;
    this.isOnline = !!state.isConnected;
    // Se voltou a ficar online, tenta processar backlog
    if (!wasOnline && this.isOnline) {
      void this.tick();
    }
  };

  private onAppStateChange = (status: AppStateStatus): void => {
    const wasActive = this.isAppActive;
    this.isAppActive = status === 'active';
    if (!wasActive && this.isAppActive) {
      void this.tick();
    }
  };
}

// Singleton instance para uso em produção.
export const syncWorker = new SyncWorker();
