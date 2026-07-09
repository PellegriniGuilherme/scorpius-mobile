import { fetchDrivingRoute } from './googleDirections';

describe('fetchDrivingRoute', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('returns route metrics and coordinates on OK response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        status: 'OK',
        routes: [
          {
            overview_polyline: { points: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
            legs: [{ distance: { value: 5200 }, duration: { value: 900 } }],
          },
        ],
      }),
    });

    const route = await fetchDrivingRoute(
      { lat: -23.55, lng: -46.63 },
      { lat: -23.56, lng: -46.65 },
      'test-key',
    );

    expect(route).toMatchObject({
      distanceKm: 5.2,
      durationMin: 15,
      encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('maps.googleapis.com/maps/api/directions/json'),
    );
  });

  it('returns null when API key is missing', async () => {
    const route = await fetchDrivingRoute({ lat: 0, lng: 0 }, { lat: 1, lng: 1 }, '');
    expect(route).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns null on non-OK status', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ status: 'ZERO_RESULTS' }),
    });

    const route = await fetchDrivingRoute(
      { lat: -23.55, lng: -46.63 },
      { lat: -23.56, lng: -46.65 },
      'test-key',
    );
    expect(route).toBeNull();
  });
});

describe('fetchDrivingRouteWithCache', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('returns cached route without calling API on second request', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        status: 'OK',
        routes: [
          {
            overview_polyline: { points: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
            legs: [{ distance: { value: 5200 }, duration: { value: 900 } }],
          },
        ],
      }),
    });

    const { fetchDrivingRouteWithCache } = await import('./googleDirections');
    const origin = { lat: -23.55, lng: -46.63 };
    const dest = { lat: -23.56, lng: -46.65 };

    const first = await fetchDrivingRouteWithCache(origin, dest, 'test-key');
    expect(first.fromCache).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const second = await fetchDrivingRouteWithCache(origin, dest, 'test-key');
    expect(second.fromCache).toBe(true);
    expect(second.route?.distanceKm).toBe(5.2);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
