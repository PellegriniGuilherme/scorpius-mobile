import * as SecureStore from 'expo-secure-store';

const ACTIVE_DELIVERY_KEY = 'scorpius_active_tracking_delivery_id';

let memoryDeliveryId: number | null = null;

export async function setActiveTrackingDeliveryId(deliveryId: number | null): Promise<void> {
  memoryDeliveryId = deliveryId;
  if (deliveryId == null) {
    await SecureStore.deleteItemAsync(ACTIVE_DELIVERY_KEY).catch(() => undefined);
    return;
  }
  await SecureStore.setItemAsync(ACTIVE_DELIVERY_KEY, String(deliveryId));
}

export async function getActiveTrackingDeliveryId(): Promise<number | null> {
  if (memoryDeliveryId != null) {
    return memoryDeliveryId;
  }
  const stored = await SecureStore.getItemAsync(ACTIVE_DELIVERY_KEY);
  if (!stored) {
    return null;
  }
  const parsed = Number.parseInt(stored, 10);
  memoryDeliveryId = Number.isFinite(parsed) ? parsed : null;
  return memoryDeliveryId;
}

export function getActiveTrackingDeliveryIdSync(): number | null {
  return memoryDeliveryId;
}

export function _resetActiveTrackingStoreForTests(): void {
  memoryDeliveryId = null;
}
