import type {
  DeliveryAddress,
  DeliveryApi,
  DeliveryApiStatus,
  DeliveryUiStatus,
  DeliveryViewModel,
} from '@/types/delivery';

export function toUiStatus(status: DeliveryApiStatus): DeliveryUiStatus {
  if (status === 'delivered') return 'delivered';
  if (status === 'failed' || status === 'cancelled') return 'failed';
  if (status === 'picked_up' || status === 'in_transit') return 'in_route';
  return 'pending';
}

function readCoords(addr: DeliveryAddress | null): { lat: number; lng: number } {
  if (!addr) return { lat: 0, lng: 0 };
  const lat = addr.lat ?? addr.latitude ?? 0;
  const lng = addr.lng ?? addr.longitude ?? 0;
  return { lat, lng };
}

export function mapDelivery(api: DeliveryApi): DeliveryViewModel {
  const addr = api.delivery_address ?? {};
  const { lat, lng } = readCoords(addr);
  const scheduled = api.delivery_scheduled_at ?? api.created_at;
  const end = api.delivered_at ?? scheduled;

  return {
    id: api.id,
    code: api.reference_code,
    status: api.status,
    uiStatus: toUiStatus(api.status),
    customer: {
      name: api.recipient.name ?? '—',
      phone: api.recipient.phone ?? '',
    },
    address: {
      street: addr.street ?? '',
      number: addr.number ?? '',
      neighborhood: addr.neighborhood ?? '',
      city: addr.city ?? '',
      state: addr.state ?? '',
      zip: addr.zip ?? '',
      lat,
      lng,
    },
    packageCount: api.package_count,
    weightKg: api.weight_kg,
    windowStart: scheduled,
    windowEnd: end,
    notes: api.notes,
  };
}

export function matchesUiFilter(delivery: DeliveryViewModel, filter: 'all' | DeliveryUiStatus): boolean {
  if (filter === 'all') return true;
  return delivery.uiStatus === filter;
}

export function nextFsmAction(
  status: DeliveryApiStatus,
): 'start' | 'in_transit' | 'proof' | 'fail' | null {
  if (status === 'assigned') return 'start';
  if (status === 'picked_up') return 'in_transit';
  if (status === 'in_transit') return 'proof';
  return null;
}
