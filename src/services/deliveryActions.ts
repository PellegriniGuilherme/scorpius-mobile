import { outbox } from '@/services/OutboxService';
import { syncWorker } from '@/services/SyncWorker';
import type { DeliveryActionOutboxPayload } from '@/services/SyncWorker';
import { executeDeliveryActionOnline } from '@/api/syncActions';
import { applyOptimisticAction } from '@/services/deliveryMutationService';
import { refreshOccurrenceTypesCache } from '@/services/occurrenceTypeService';
import NetInfo from '@react-native-community/netinfo';

export async function runDeliveryAction(payload: DeliveryActionOutboxPayload): Promise<void> {
  await applyOptimisticAction(payload);

  const net = await NetInfo.fetch();
  if (net.isConnected) {
    try {
      await executeDeliveryActionOnline(payload);
      if (payload.action === 'start' || payload.action === 'in_transit') {
        void refreshOccurrenceTypesCache();
      }
      return;
    } catch {
      // fall through to outbox
    }
  }

  await outbox.enqueue('delivery_action', payload as unknown as Record<string, unknown>);
  if (payload.action === 'start' || payload.action === 'in_transit') {
    void refreshOccurrenceTypesCache();
  }
  await syncWorker.tick();
}
