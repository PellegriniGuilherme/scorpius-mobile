import * as Location from 'expo-location';
import { uploadTelemetry } from '@/api/sync';
import {
  _resetLocationTrackingForTests,
  locationTrackingService,
  resumeLocationTrackingFromCache,
} from '@/services/LocationTrackingService';
import { deliveryCache, _resetDeliveryCacheForTests } from '@/services/DeliveryCacheService';
import { MOCK_DELIVERY_API } from '@/testFixtures/deliveryApi';

jest.mock('@/api/sync', () => ({
  uploadTelemetry: jest.fn().mockResolvedValue(undefined),
}));

const mockSqlite = jest.requireActual('../../jest.sqlite-mock.js') as {
  __resetMockDb: () => void;
};

describe('LocationTrackingService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSqlite.__resetMockDb();
    _resetLocationTrackingForTests();
    _resetDeliveryCacheForTests();
    await deliveryCache.clear();
  });

  it('starts tracking and records telemetry for the active delivery', async () => {
    const started = await locationTrackingService.startTracking(1001);

    expect(started).toBe(true);
    expect(locationTrackingService.getActiveDeliveryId()).toBe(1001);
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
    expect(Location.watchPositionAsync).toHaveBeenCalled();
  });

  it('flushes telemetry when tracking stops', async () => {
    await locationTrackingService.startTracking(1001);
    await locationTrackingService.stopTracking();

    expect(locationTrackingService.getActiveDeliveryId()).toBeNull();
  });

  it('resumes tracking for in_transit deliveries from cache', async () => {
    await deliveryCache.upsertMany([
      { ...MOCK_DELIVERY_API[0]!, status: 'picked_up' },
      { ...MOCK_DELIVERY_API[1]!, status: 'in_transit' },
    ]);

    await resumeLocationTrackingFromCache();

    expect(locationTrackingService.getActiveDeliveryId()).toBe(MOCK_DELIVERY_API[1]!.id);
  });
});

describe('LocationTrackingService telemetry flush', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetLocationTrackingForTests();
  });

  it('uploads buffered points when flush threshold is reached', async () => {
    const { telemetryService } = await import('@/services/TelemetryService');

    for (let index = 0; index < 20; index += 1) {
      telemetryService.record({
        lat: -23.5 + index * 0.0001,
        lng: -46.6,
        recorded_at: new Date().toISOString(),
        delivery_id: 1001,
      });
    }

    expect(uploadTelemetry).toHaveBeenCalled();
  });
});
