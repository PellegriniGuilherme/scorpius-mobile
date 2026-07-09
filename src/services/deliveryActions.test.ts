import NetInfo from '@react-native-community/netinfo';
import { executeDeliveryActionOnline } from '@/api/syncActions';
import { deliveryCache, _resetDeliveryCacheForTests } from '@/services/DeliveryCacheService';
import { runDeliveryAction } from '@/services/deliveryActions';
import { outbox } from '@/services/OutboxService';
import { syncWorker } from '@/services/SyncWorker';
import { MOCK_DELIVERY_API } from '@/testFixtures/deliveryApi';

const mockSqlite = jest.requireActual('../../jest.sqlite-mock.js') as {
  __resetMockDb: () => void;
};

jest.mock('@/api/syncActions', () => ({
  executeDeliveryActionOnline: jest.fn(),
}));

jest.mock('@/services/OutboxService', () => ({
  outbox: {
    enqueue: jest.fn().mockResolvedValue(1),
  },
}));

jest.mock('@/services/SyncWorker', () => ({
  syncWorker: {
    tick: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('@/services/occurrenceTypeService', () => ({
  refreshOccurrenceTypesCache: jest.fn(),
}));

describe('runDeliveryAction', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSqlite.__resetMockDb();
    _resetDeliveryCacheForTests();
    await deliveryCache.clear();
    await deliveryCache.upsertMany(MOCK_DELIVERY_API);
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
  });

  it('patches cache optimistically and uses server response when online', async () => {
    const serverDelivery = { ...MOCK_DELIVERY_API[1], status: 'failed' as const };
    (executeDeliveryActionOnline as jest.Mock).mockResolvedValue(serverDelivery);

    await runDeliveryAction({ deliveryId: 1002, action: 'fail', reason: 'test' });

    const stored = await deliveryCache.getById(1002);
    expect(stored?.status).toBe('failed');
    expect(executeDeliveryActionOnline).toHaveBeenCalledWith({
      deliveryId: 1002,
      action: 'fail',
      reason: 'test',
    });
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('patches cache optimistically and enqueues when offline', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });

    await runDeliveryAction({ deliveryId: 1002, action: 'fail', reason: 'offline' });

    const stored = await deliveryCache.getById(1002);
    expect(stored?.status).toBe('failed');
    expect(outbox.enqueue).toHaveBeenCalledWith('delivery_action', {
      deliveryId: 1002,
      action: 'fail',
      reason: 'offline',
    });
    expect(syncWorker.tick).toHaveBeenCalled();
    expect(executeDeliveryActionOnline).not.toHaveBeenCalled();
  });

  it('enqueues when online request fails after optimistic patch', async () => {
    (executeDeliveryActionOnline as jest.Mock).mockRejectedValue(new Error('network'));

    await runDeliveryAction({ deliveryId: 1002, action: 'fail' });

    const stored = await deliveryCache.getById(1002);
    expect(stored?.status).toBe('failed');
    expect(outbox.enqueue).toHaveBeenCalled();
  });
});
