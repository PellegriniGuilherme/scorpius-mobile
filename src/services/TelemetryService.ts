/**
 * Scorpius Move — GPS telemetry buffer (flush to POST /upload/telemetry).
 */
import { uploadTelemetry } from '@/api/sync';

export interface TelemetryPoint {
  lat: number;
  lng: number;
  recorded_at: string;
  delivery_id?: number;
}

/** Flush cedo para o hub ver a rota em tempo quase real (antes: 20 ≈ 5 min). */
const FLUSH_SIZE = 3;
const FLUSH_INTERVAL_MS = 15_000;

class TelemetryService {
  private buffer: TelemetryPoint[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;

  record(point: TelemetryPoint): void {
    this.buffer.push(point);
    if (this.buffer.length >= FLUSH_SIZE) {
      void this.flush();
      return;
    }
    this.scheduleFlush();
  }

  async flush(): Promise<void> {
    this.clearFlushTimer();
    if (this.flushing || this.buffer.length === 0) return;
    this.flushing = true;
    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      await uploadTelemetry({
        points: batch.map((point) => ({
          lat: point.lat,
          lng: point.lng,
          ts: Date.parse(point.recorded_at),
          delivery_id: point.delivery_id,
        })),
      });
    } catch {
      this.buffer.unshift(...batch);
      this.scheduleFlush();
    } finally {
      this.flushing = false;
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer != null) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  private clearFlushTimer(): void {
    if (this.flushTimer == null) return;
    clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }
}

export const telemetryService = new TelemetryService();
