jest.mock('@/services/deliveryService', () => {
  const fixtures = jest.requireActual('@/testFixtures/deliveryApi');
  return {
    fetchDeliveriesPage: jest.fn(async () => {
      const res = await fixtures.mockFetchDeliveriesWithCache();
      return {
        data: res.data,
        meta: { current_page: 1, last_page: 1, per_page: 20, total: res.data.length },
        fromCache: res.fromCache,
      };
    }),
    fetchDeliveriesWithCache: jest.fn(() => fixtures.mockFetchDeliveriesWithCache()),
    fetchDeliveryWithCache: jest.fn((id: number) => fixtures.mockFetchDeliveryWithCache(id)),
    readDeliveriesFromCache: jest.fn(async () => {
      const res = await fixtures.mockFetchDeliveriesWithCache();
      return res.data;
    }),
    mergeDeliveryPages: jest.requireActual('@/services/deliveryService').mergeDeliveryPages,
  };
});
