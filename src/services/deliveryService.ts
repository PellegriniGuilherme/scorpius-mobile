import NetInfo from '@react-native-community/netinfo';
import { listDriverDeliveries, getDriverDelivery } from '@/api/deliveries';
import { deliveryCache } from '@/services/DeliveryCacheService';
import type { DeliveryApi } from '@/types/delivery';

export async function fetchDeliveriesWithCache(): Promise<{ data: DeliveryApi[]; fromCache: boolean }> {
  const net = await NetInfo.fetch();
  if (net.isConnected) {
    try {
      const res = await listDriverDeliveries({ per_page: 50 });
      await deliveryCache.upsertMany(res.data);
      return { data: res.data, fromCache: false };
    } catch {
      const cached = await deliveryCache.listAll();
      return { data: cached, fromCache: true };
    }
  }
  const cached = await deliveryCache.listAll();
  return { data: cached, fromCache: true };
}

export async function fetchDeliveryWithCache(id: number): Promise<{ data: DeliveryApi | null; fromCache: boolean }> {
  const net = await NetInfo.fetch();
  if (net.isConnected) {
    try {
      const data = await getDriverDelivery(id);
      await deliveryCache.upsertOne(data);
      return { data, fromCache: false };
    } catch {
      const cached = await deliveryCache.getById(id);
      return { data: cached, fromCache: true };
    }
  }
  const cached = await deliveryCache.getById(id);
  return { data: cached, fromCache: true };
}
