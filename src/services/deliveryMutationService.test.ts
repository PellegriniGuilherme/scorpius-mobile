import { deliveryCache, _resetDeliveryCacheForTests } from '@/services/DeliveryCacheService';
import { subscribeDeliveryCache } from '@/services/deliveryCacheEvents';
import { applyOptimisticAction, applyServerDelivery } from '@/services/deliveryMutationService';
import { _resetLocationTrackingForTests, locationTrackingService } from '@/services/LocationTrackingService';
import { MOCK_DELIVERY_API } from '@/testFixtures/deliveryApi';

const mockSqlite = jest.requireActual('../../jest.sqlite-mock.js') as {
  __resetMockDb: () => void;
};

describe('deliveryMutationService', () => {
  beforeEach(async () => {
    mockSqlite.__resetMockDb();
    _resetDeliveryCacheForTests();
    _resetLocationTrackingForTests();
    await deliveryCache.clear();
    await deliveryCache.upsertMany(MOCK_DELIVERY_API);
  });

  it('applyOptimisticAction patches status and notifies listeners', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeDeliveryCache(listener);

    await applyOptimisticAction({ deliveryId: 1002, action: 'fail' });

    const patched = await deliveryCache.getById(1002);
    expect(patched?.status).toBe('failed');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('maps start action to picked_up', async () => {
    await applyOptimisticAction({ deliveryId: 1001, action: 'start' });
    const patched = await deliveryCache.getById(1001);
    expect(patched?.status).toBe('picked_up');
  });

  it('starts GPS tracking when route begins', async () => {
    await applyOptimisticAction({ deliveryId: 1001, action: 'in_transit' });

    expect(locationTrackingService.getActiveDeliveryId()).toBe(1001);
  });

  it('starts GPS tracking when delivery is picked up', async () => {
    await applyOptimisticAction({ deliveryId: 1001, action: 'start' });

    expect(locationTrackingService.getActiveDeliveryId()).toBe(1001);
  });

  it('stops GPS tracking when delivery is completed or failed', async () => {
    await applyOptimisticAction({ deliveryId: 1001, action: 'in_transit' });
    await applyOptimisticAction({ deliveryId: 1001, action: 'complete' });

    expect(locationTrackingService.getActiveDeliveryId()).toBeNull();
  });

  it('applyServerDelivery upserts authoritative payload and notifies', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeDeliveryCache(listener);

    const serverDelivery = { ...MOCK_DELIVERY_API[0], status: 'delivered' as const };
    await applyServerDelivery(serverDelivery);

    const stored = await deliveryCache.getById(1001);
    expect(stored?.status).toBe('delivered');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('applyServerDelivery starts tracking for picked_up deliveries', async () => {
    const serverDelivery = { ...MOCK_DELIVERY_API[0], status: 'picked_up' as const };
    await applyServerDelivery(serverDelivery);

    expect(locationTrackingService.getActiveDeliveryId()).toBe(1001);
  });
});
