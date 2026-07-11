import { deliveryCache } from '@/services/DeliveryCacheService';
import { notifyDeliveryCacheChanged } from '@/services/deliveryCacheEvents';
import { syncLocationTrackingWithStatus } from '@/services/LocationTrackingService';
import type { DeliveryActionOutboxPayload } from '@/services/SyncWorker';
import type { DeliveryApi, DeliveryApiStatus } from '@/types/delivery';

const ACTION_TO_STATUS: Record<DeliveryActionOutboxPayload['action'], DeliveryApiStatus> = {
  start: 'picked_up',
  in_transit: 'in_transit',
  fail: 'failed',
  complete: 'delivered',
};

export async function applyOptimisticAction(payload: DeliveryActionOutboxPayload): Promise<void> {
  if (payload.action === 'fail' && payload.reason) {
    await deliveryCache.patchFailure(payload.deliveryId, payload.reason);
    await syncLocationTrackingWithStatus(payload.deliveryId, 'failed');
  } else {
    const status = ACTION_TO_STATUS[payload.action];
    await deliveryCache.patchStatus(payload.deliveryId, status);
    await syncLocationTrackingWithStatus(payload.deliveryId, status);
  }
  notifyDeliveryCacheChanged();
}

export async function applyServerDelivery(delivery: DeliveryApi): Promise<void> {
  await deliveryCache.upsertOne(delivery);
  await syncLocationTrackingWithStatus(delivery.id, delivery.status);
  notifyDeliveryCacheChanged();
}
