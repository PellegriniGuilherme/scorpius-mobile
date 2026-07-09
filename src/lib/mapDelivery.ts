import type {
  DeliveryAddress,
  DeliveryApi,
  DeliveryApiStatus,
  DeliveryUiStatus,
  DeliveryViewModel,
  ProofRequirements,
} from '@/types/delivery';

export const DELIVERY_UI_STATUSES: readonly DeliveryUiStatus[] = [
  'pending',
  'in_route',
  'delivered',
  'failed',
] as const;

const DEFAULT_PROOF_REQUIREMENTS: ProofRequirements = {
  requires_photo: false,
  requires_signature: false,
};

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
    failureReason: api.failure?.reason ?? null,
    proofRequirements: api.proof_requirements ?? DEFAULT_PROOF_REQUIREMENTS,
  };
}

export function matchesUiFilter(delivery: DeliveryViewModel, filter: 'all' | DeliveryUiStatus): boolean {
  if (filter === 'all') return true;
  return delivery.uiStatus === filter;
}

export function isAllUiStatusesSelected(filters: ReadonlySet<DeliveryUiStatus>): boolean {
  return DELIVERY_UI_STATUSES.every((status) => filters.has(status));
}

export function matchesUiFilters(delivery: DeliveryViewModel, filters: ReadonlySet<DeliveryUiStatus>): boolean {
  if (filters.size === 0) return false;
  if (isAllUiStatusesSelected(filters)) return true;
  return filters.has(delivery.uiStatus);
}

export function createAllUiStatusSet(): Set<DeliveryUiStatus> {
  return new Set(DELIVERY_UI_STATUSES);
}

export function countDeliveriesByUiStatus(
  deliveries: DeliveryViewModel[],
): Record<'all' | DeliveryUiStatus, number> {
  const counts = {
    all: deliveries.length,
    pending: 0,
    in_route: 0,
    delivered: 0,
    failed: 0,
  } satisfies Record<'all' | DeliveryUiStatus, number>;

  for (const delivery of deliveries) {
    counts[delivery.uiStatus] += 1;
  }

  return counts;
}

export function nextFsmAction(
  status: DeliveryApiStatus,
): 'start' | 'in_transit' | 'proof' | 'fail' | null {
  if (status === 'assigned') return 'start';
  if (status === 'picked_up') return 'in_transit';
  if (status === 'in_transit') return 'proof';
  return null;
}

export function statusAfterDeliveryAction(
  current: DeliveryApiStatus,
  action: 'start' | 'in_transit' | 'fail',
): DeliveryApiStatus {
  if (action === 'start') return 'picked_up';
  if (action === 'in_transit') return 'in_transit';
  if (action === 'fail') return 'failed';
  return current;
}
