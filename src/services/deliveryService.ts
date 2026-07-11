import NetInfo from '@react-native-community/netinfo';
import { listDriverDeliveries, getDriverDelivery } from '@/api/deliveries';
import { deliveryCache } from '@/services/DeliveryCacheService';
import type { DeliveryApi, DeliveryListResponse } from '@/types/delivery';

export const DELIVERIES_PAGE_SIZE = 20;

export interface FetchDeliveriesPageResult {
  data: DeliveryApi[];
  meta: NonNullable<DeliveryListResponse['meta']>;
  fromCache: boolean;
}

export async function readDeliveriesFromCache(): Promise<DeliveryApi[]> {
  return deliveryCache.listAll();
}

function buildPageMeta(total: number, page: number, perPage: number): NonNullable<DeliveryListResponse['meta']> {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  return {
    current_page: page,
    last_page: lastPage,
    per_page: perPage,
    total,
  };
}

export async function fetchDeliveriesPage(
  page: number,
  options?: { forceNetwork?: boolean; perPage?: number },
): Promise<FetchDeliveriesPageResult> {
  const perPage = options?.perPage ?? DELIVERIES_PAGE_SIZE;
  const net = await NetInfo.fetch();
  const cached = await deliveryCache.listAll();

  if (!net.isConnected || options?.forceNetwork === false) {
    const start = (page - 1) * perPage;
    const slice = cached.slice(start, start + perPage);
    return {
      data: slice,
      meta: buildPageMeta(cached.length, page, perPage),
      fromCache: true,
    };
  }

  try {
    const res = await listDriverDeliveries({ page, per_page: perPage });
    await deliveryCache.upsertMany(res.data);
    const meta = res.meta ?? buildPageMeta(res.data.length, page, perPage);
    return { data: res.data, meta, fromCache: false };
  } catch {
    const start = (page - 1) * perPage;
    const slice = cached.slice(start, start + perPage);
    return {
      data: slice,
      meta: buildPageMeta(cached.length, page, perPage),
      fromCache: true,
    };
  }
}

export async function fetchDeliveriesWithCache(
  options?: { forceNetwork?: boolean },
): Promise<{ data: DeliveryApi[]; fromCache: boolean }> {
  const firstPage = await fetchDeliveriesPage(1, options);
  return { data: firstPage.data, fromCache: firstPage.fromCache };
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

export function mergeDeliveryPages(existing: DeliveryApi[], incoming: DeliveryApi[]): DeliveryApi[] {
  const byId = new Map<number, DeliveryApi>();
  for (const delivery of existing) {
    byId.set(delivery.id, delivery);
  }
  for (const delivery of incoming) {
    byId.set(delivery.id, delivery);
  }
  return Array.from(byId.values());
}
