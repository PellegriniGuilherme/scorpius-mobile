import { MOCK_DELIVERIES } from '@/mocks/deliveries';
import type { DeliveryApi, DeliveryApiStatus } from '@/types/delivery';

const STATUS_MAP: Record<string, DeliveryApiStatus> = {
  pending: 'assigned',
  in_route: 'in_transit',
  delivered: 'delivered',
  failed: 'failed',
};

export function mockDeliveryToApi(m: (typeof MOCK_DELIVERIES)[number]): DeliveryApi {
  return {
    id: m.id,
    company_id: 1,
    driver_id: m.driver_id,
    reference_code: m.code,
    status: STATUS_MAP[m.status] ?? 'assigned',
    pickup_address: m.pickup_address ? { ...m.pickup_address } : { ...m.address },
    delivery_address: { ...m.address },
    delivery_scheduled_at: m.scheduled_for,
    delivery_window_start: m.window_start,
    delivery_window_end: m.window_end,
    delivered_at: m.status === 'delivered' ? m.window_end : null,
    recipient: { name: m.customer.name, phone: m.customer.phone },
    package_count: m.items.reduce((sum, item) => sum + item.quantity, 0),
    weight_kg: null,
    notes: null,
    proof_requirements:
      m.id === 1001
        ? { requires_photo: true, requires_signature: true }
        : { requires_photo: false, requires_signature: false },
    created_at: m.scheduled_for,
    updated_at: m.scheduled_for,
  };
}

export const MOCK_DELIVERY_API = MOCK_DELIVERIES.map(mockDeliveryToApi);

export async function mockFetchDeliveriesWithCache() {
  return { data: MOCK_DELIVERY_API, fromCache: false };
}

export async function mockFetchDeliveryWithCache(id: number) {
  const data = MOCK_DELIVERY_API.find((d) => d.id === id) ?? null;
  return { data, fromCache: false };
}
