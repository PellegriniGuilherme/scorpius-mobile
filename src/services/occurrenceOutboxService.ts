import { fetchDeliveryOccurrences, type DriverOccurrence } from '@/api/occurrences';
import { outbox, type OutboxItem } from '@/services/OutboxService';
import {
  fetchOccurrenceTypeNameMap,
  resolveOccurrenceTypeName,
  type OccurrenceTypeNameMap,
} from '@/services/occurrenceTypeService';
import { syncWorker, type OccurrenceOutboxPayload, MAX_ATTEMPTS } from '@/services/SyncWorker';

export interface PendingOccurrenceRow {
  localId: string;
  typeSlug: string;
  typeName: string;
  notes?: string;
  status: 'pending' | 'failed';
}

function normalizeOccurrenceDescription(notes?: string): string {
  const trimmed = notes?.trim() ?? '';
  return trimmed || 'Ocorrência reportada pelo motorista.';
}

function readOccurrencePayload(item: OutboxItem): OccurrenceOutboxPayload['occurrence'] | null {
  const payload = item.payload as Partial<OccurrenceOutboxPayload>;
  if (!payload.occurrence || typeof payload.occurrence !== 'object') {
    return null;
  }
  return payload.occurrence;
}

function matchesRemoteOccurrence(
  occurrence: OccurrenceOutboxPayload['occurrence'],
  remote: DriverOccurrence,
): boolean {
  if (remote.client_local_id && remote.client_local_id === occurrence.local_id) {
    return true;
  }

  if (remote.type?.slug !== occurrence.type) {
    return false;
  }

  if (remote.description !== normalizeOccurrenceDescription(occurrence.notes)) {
    return false;
  }

  if (!occurrence.occurred_at || !remote.occurred_at) {
    return false;
  }

  const deltaMs = Math.abs(Date.parse(remote.occurred_at) - Date.parse(occurrence.occurred_at));
  return deltaMs <= 60_000;
}

function resolveOutboxOccurrenceStatus(item: OutboxItem): 'pending' | 'failed' {
  return item.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
}

export async function reconcileSyncedOccurrenceOutbox(
  deliveryId: number,
  remote: DriverOccurrence[],
): Promise<void> {
  const outboxItems = await outbox.getAll();

  for (const item of outboxItems) {
    if (item.type !== 'occurrence_report') {
      continue;
    }

    const occurrence = readOccurrencePayload(item);
    if (!occurrence || occurrence.delivery_id !== deliveryId) {
      continue;
    }

    const synced = remote.some((remoteOccurrence) => matchesRemoteOccurrence(occurrence, remoteOccurrence));
    if (synced) {
      await outbox.markDone(item.id);
    }
  }
}

export async function loadDeliveryOccurrencesView(deliveryId: number): Promise<{
  remote: DriverOccurrence[];
  pending: PendingOccurrenceRow[];
  typeNameMap: OccurrenceTypeNameMap;
}> {
  await syncWorker.drain();

  const typeNameMap = await fetchOccurrenceTypeNameMap(true);

  const remoteResponse = await fetchDeliveryOccurrences(deliveryId).catch(() => ({
    data: [] as DriverOccurrence[],
  }));
  const remote = remoteResponse.data ?? [];

  await reconcileSyncedOccurrenceOutbox(deliveryId, remote);

  const outboxItems = await outbox.getAll();
  const pending = outboxItems
    .filter((item) => item.type === 'occurrence_report')
    .flatMap((item) => {
      const occurrence = readOccurrencePayload(item);
      if (!occurrence || occurrence.delivery_id !== deliveryId) {
        return [];
      }

      const typeSlug = occurrence.type ?? '—';

      return [
        {
          localId: occurrence.local_id ?? String(item.id),
          typeSlug,
          typeName: resolveOccurrenceTypeName(typeSlug === '—' ? null : typeSlug, typeNameMap),
          notes: occurrence.notes,
          status: resolveOutboxOccurrenceStatus(item),
        },
      ];
    });

  return { remote, pending, typeNameMap };
}
