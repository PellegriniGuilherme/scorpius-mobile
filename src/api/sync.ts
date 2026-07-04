import { apiClient } from './client';

export interface SyncEventPayload {
  local_id: string;
  delivery_id: number;
  event: string;
  occurred_at: string;
  payload?: Record<string, unknown>;
}

export interface SyncOccurrencePayload {
  local_id: string;
  delivery_id: number;
  type: string;
  status: 'open';
  notes?: string;
  occurred_at: string;
}

export async function ingestEvents(batchId: string, events: SyncEventPayload[]): Promise<void> {
  await apiClient.post('/sync/events', { batch_id: batchId, events });
}

export async function ingestOccurrences(
  batchId: string,
  occurrences: SyncOccurrencePayload[],
): Promise<void> {
  await apiClient.post('/sync/occurrences', { batch_id: batchId, occurrences });
}

export async function getSyncCursor(): Promise<unknown> {
  const { data } = await apiClient.get('/sync/cursor');
  return data;
}

export async function advanceSyncCursor(payload: Record<string, unknown>): Promise<void> {
  await apiClient.post('/sync/cursor/advance', payload);
}

export async function getSyncConflicts(): Promise<unknown> {
  const { data } = await apiClient.get('/sync/conflicts');
  return data;
}

export async function uploadTelemetry(payload: unknown): Promise<void> {
  await apiClient.post('/upload/telemetry', payload);
}
