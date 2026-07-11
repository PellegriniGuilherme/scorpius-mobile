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

const FLUSH_SIZE = 20;

class TelemetryService {
  private buffer: TelemetryPoint[] = [];

  record(point: TelemetryPoint): void {
    this.buffer.push(point);
    if (this.buffer.length >= FLUSH_SIZE) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
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
    }
  }
}

export const telemetryService = new TelemetryService();
