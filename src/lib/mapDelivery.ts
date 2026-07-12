import { formatAddressLine } from '@/lib/formatAddress';
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
  'picked_up',
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
  if (status === 'picked_up') return 'picked_up';
  if (status === 'in_transit') return 'in_route';
  return 'pending';
}

function readCoords(addr: DeliveryAddress | null): { lat: number; lng: number } {
  if (!addr) return { lat: 0, lng: 0 };
  const lat = addr.lat ?? addr.latitude ?? 0;
  const lng = addr.lng ?? addr.longitude ?? 0;
  return { lat, lng };
}

function mapAddress(addr: DeliveryAddress | null | undefined) {
  const { lat, lng } = readCoords(addr ?? null);
  return {
    street: addr?.street ?? '',
    number: addr?.number ?? '',
    neighborhood: addr?.neighborhood ?? '',
    city: addr?.city ?? '',
    state: addr?.state ?? '',
    zip: addr?.zip ?? '',
    lat,
    lng,
  };
}

export function mapDelivery(api: DeliveryApi): DeliveryViewModel {
  const addr = api.delivery_address ?? {};
  const pickupAddr = api.pickup_address ?? {};

  return {
    id: api.id,
    code: api.reference_code,
    status: api.status,
    uiStatus: toUiStatus(api.status),
    customer: {
      name: api.recipient.name ?? '—',
      phone: api.recipient.phone ?? '',
    },
    pickupAddress: mapAddress(pickupAddr),
    address: mapAddress(addr),
    packageCount: api.package_count,
    weightKg: api.weight_kg,
    windowStart: api.delivery_window_start,
    windowEnd: api.delivery_window_end,
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

export const DEFAULT_ACTIVE_UI_STATUSES: readonly DeliveryUiStatus[] = [
  'pending',
  'picked_up',
  'in_route',
] as const;

export function createDefaultActiveUiStatusSet(): Set<DeliveryUiStatus> {
  return new Set(DEFAULT_ACTIVE_UI_STATUSES);
}

export type MapRouteKind = 'pickup' | 'delivery';

export function resolveMapRouteTarget(delivery: DeliveryViewModel): {
  kind: MapRouteKind;
  coords: { lat: number; lng: number };
  addressLine: string;
} {
  if (delivery.status === 'in_transit') {
    return {
      kind: 'delivery',
      coords: { lat: delivery.address.lat, lng: delivery.address.lng },
      addressLine: formatAddressLine(delivery.address),
    };
  }

  const pickup = delivery.pickupAddress;
  const hasPickupCoords = pickup.lat !== 0 || pickup.lng !== 0;
  if (hasPickupCoords) {
    return {
      kind: 'pickup',
      coords: { lat: pickup.lat, lng: pickup.lng },
      addressLine: formatAddressLine(pickup),
    };
  }

  return {
    kind: 'delivery',
    coords: { lat: delivery.address.lat, lng: delivery.address.lng },
    addressLine: formatAddressLine(delivery.address),
  };
}

export function countDeliveriesByUiStatus(
  deliveries: DeliveryViewModel[],
): Record<'all' | DeliveryUiStatus, number> {
  const counts = {
    all: deliveries.length,
    pending: 0,
    picked_up: 0,
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
