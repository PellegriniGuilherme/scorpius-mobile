jest.mock('@/services/deliveryService', () => {
  const fixtures = jest.requireActual('@/testFixtures/deliveryApi');
  return {
    fetchDeliveriesWithCache: jest.fn(() => fixtures.mockFetchDeliveriesWithCache()),
    fetchDeliveryWithCache: jest.fn((id: number) => fixtures.mockFetchDeliveryWithCache(id)),
    readDeliveriesFromCache: jest.fn(async () => {
      const res = await fixtures.mockFetchDeliveriesWithCache();
      return res.data;
    }),
  };
});
