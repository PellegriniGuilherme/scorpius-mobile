import { fetchDeliveryOccurrences } from '@/api/occurrences';
import { outbox } from '@/services/OutboxService';
import {
  loadDeliveryOccurrencesView,
  reconcileSyncedOccurrenceOutbox,
} from '@/services/occurrenceOutboxService';
import { syncWorker } from '@/services/SyncWorker';

jest.mock('@/api/occurrences', () => ({
  fetchDeliveryOccurrences: jest.fn(),
}));

jest.mock('@/services/SyncWorker', () => ({
  syncWorker: {
    drain: jest.fn().mockResolvedValue(1),
  },
}));

describe('occurrenceOutboxService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('removes outbox items already present on server by client_local_id', async () => {
    const markDone = jest.spyOn(outbox, 'markDone').mockResolvedValue(undefined);
    jest.spyOn(outbox, 'getAll').mockResolvedValue([
      {
        id: 9,
        type: 'occurrence_report',
        payload: {
          occurrence: {
            local_id: 'local-1',
            delivery_id: 1001,
            type: 'delay',
            occurred_at: '2026-06-21T10:00:00-03:00',
          },
        },
        attempts: 0,
        next_retry_at: 0,
        last_error: null,
        created_at: 1,
        updated_at: 1,
        idempotency_key: 'key-1',
      },
    ]);

    await reconcileSyncedOccurrenceOutbox(1001, [
      {
        id: 55,
        delivery_id: 1001,
        client_local_id: 'local-1',
        status: 'open',
        created_at: '2026-06-21T10:00:00-03:00',
      },
    ]);

    expect(markDone).toHaveBeenCalledWith(9);
  });

  it('loads remote occurrences after draining outbox', async () => {
    jest.spyOn(outbox, 'getAll').mockResolvedValue([]);
    (fetchDeliveryOccurrences as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 1,
          delivery_id: 1001,
          status: 'open',
          created_at: '2026-06-21T10:00:00-03:00',
          type: { id: 1, slug: 'delay', name: 'Atraso' },
        },
      ],
    });

    const result = await loadDeliveryOccurrencesView(1001);

    expect(syncWorker.drain).toHaveBeenCalled();
    expect(result.remote).toHaveLength(1);
    expect(result.pending).toHaveLength(0);
  });
});
