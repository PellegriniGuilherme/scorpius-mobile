import {
  completeDelivery,
  failDelivery,
  inTransitDelivery,
  startDelivery,
} from '@/api/deliveries';

export interface DeliveryActionPayload {
  deliveryId: number;
  action: 'start' | 'in_transit' | 'fail' | 'complete';
  reason?: string;
  notes?: string;
}

export async function executeDeliveryActionOnline(payload: DeliveryActionPayload): Promise<void> {
  switch (payload.action) {
    case 'start':
      await startDelivery(payload.deliveryId);
      break;
    case 'in_transit':
      await inTransitDelivery(payload.deliveryId);
      break;
    case 'fail':
      await failDelivery(payload.deliveryId, payload.reason ?? 'Falha reportada pelo motorista');
      break;
    case 'complete':
      await completeDelivery(payload.deliveryId, { notes: payload.notes });
      break;
    default:
      throw new Error(`Unknown delivery action: ${payload.action}`);
  }
}
