import {
  completeDelivery,
  failDelivery,
  inTransitDelivery,
  startDelivery,
} from '@/api/deliveries';
import { applyServerDelivery } from '@/services/deliveryMutationService';
import type { DeliveryApi } from '@/types/delivery';

export interface DeliveryActionPayload {
  deliveryId: number;
  action: 'start' | 'in_transit' | 'fail' | 'complete';
  reason?: string;
  notes?: string;
}

export async function executeDeliveryActionOnline(payload: DeliveryActionPayload): Promise<DeliveryApi> {
  let updated: DeliveryApi;
  switch (payload.action) {
    case 'start':
      updated = await startDelivery(payload.deliveryId);
      break;
    case 'in_transit':
      updated = await inTransitDelivery(payload.deliveryId);
      break;
    case 'fail':
      updated = await failDelivery(payload.deliveryId, payload.reason ?? 'Falha reportada pelo motorista');
      break;
    case 'complete':
      updated = await completeDelivery(payload.deliveryId, { notes: payload.notes });
      break;
    default:
      throw new Error(`Unknown delivery action: ${payload.action}`);
  }
  await applyServerDelivery(updated);
  return updated;
}
