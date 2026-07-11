import { mapDelivery, resolveMapRouteTarget, toUiStatus } from '@/lib/mapDelivery';
import { MOCK_DELIVERY_API } from '@/testFixtures/deliveryApi';
import type { DeliveryApi } from '@/types/delivery';

describe('mapDelivery', () => {
  it('maps delivery window from API fields', () => {
    const mapped = mapDelivery(MOCK_DELIVERY_API[0]!);
    expect(mapped.windowStart).toBe('2026-06-21T08:00:00-03:00');
    expect(mapped.windowEnd).toBe('2026-06-21T12:00:00-03:00');
  });

  it('returns null window when API has no schedule', () => {
    const api: DeliveryApi = {
      ...MOCK_DELIVERY_API[0]!,
      delivery_window_start: null,
      delivery_window_end: null,
      delivery_scheduled_at: null,
    };
    const mapped = mapDelivery(api);
    expect(mapped.windowStart).toBeNull();
    expect(mapped.windowEnd).toBeNull();
  });

  it('does not derive window from created_at or delivered_at', () => {
    const api: DeliveryApi = {
      ...MOCK_DELIVERY_API[0]!,
      delivery_window_start: null,
      delivery_window_end: null,
      delivery_scheduled_at: null,
      delivered_at: '2026-06-21T15:00:00-03:00',
      created_at: '2026-06-21T07:00:00-03:00',
    };
    const mapped = mapDelivery(api);
    expect(mapped.windowStart).toBeNull();
    expect(mapped.windowEnd).toBeNull();
  });

  it('maps picked_up and in_transit to distinct UI statuses', () => {
    expect(toUiStatus('picked_up')).toBe('picked_up');
    expect(toUiStatus('in_transit')).toBe('in_route');
  });

  it('maps in_transit to delivery destination and active statuses to pickup', () => {
    const pending = mapDelivery({ ...MOCK_DELIVERY_API[0]!, status: 'assigned' });
    const inTransit = mapDelivery({ ...MOCK_DELIVERY_API[1]!, status: 'in_transit' });

    expect(resolveMapRouteTarget(pending).kind).toBe('pickup');
    expect(resolveMapRouteTarget(pending).coords.lat).toBe(pending.pickupAddress.lat);
    expect(resolveMapRouteTarget(inTransit).kind).toBe('delivery');
    expect(resolveMapRouteTarget(inTransit).coords.lat).toBe(inTransit.address.lat);
  });
});
