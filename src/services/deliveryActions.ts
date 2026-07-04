import { outbox } from '@/services/OutboxService';
import { syncWorker } from '@/services/SyncWorker';
import type { DeliveryActionOutboxPayload } from '@/services/SyncWorker';
import { executeDeliveryActionOnline } from '@/api/syncActions';
import NetInfo from '@react-native-community/netinfo';

export async function runDeliveryAction(payload: DeliveryActionOutboxPayload): Promise<void> {
  const net = await NetInfo.fetch();
  if (net.isConnected) {
    try {
      await executeDeliveryActionOnline(payload);
      return;
    } catch {
      // fall through to outbox
    }
  }
  await outbox.enqueue('delivery_action', payload as unknown as Record<string, unknown>);
  await syncWorker.tick();
}
