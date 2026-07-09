import * as SecureStore from 'expo-secure-store';
import { SECURE_STORE_TIMEOUT_MS } from '@/lib/secureStoreTimeout';
import {
  getDeviceId,
  resetDeviceIdCacheForTests,
  startDeviceIdHydration,
} from './deviceId';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

describe('deviceId', () => {
  beforeEach(() => {
    resetDeviceIdCacheForTests();
    jest.useFakeTimers();
    (SecureStore.getItemAsync as jest.Mock).mockReset();
    (SecureStore.setItemAsync as jest.Mock).mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns id synchronously without awaiting SecureStore', () => {
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(
      () => new Promise(() => {}),
    );

    startDeviceIdHydration();
    const id = getDeviceId();

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(getDeviceId()).toBe(id);
  });

  it('does not block when SecureStore read hangs during hydration', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(
      () => new Promise(() => {}),
    );

    startDeviceIdHydration();
    jest.runOnlyPendingTimers();

    const beforeHydrationTimeout = getDeviceId();
    await jest.advanceTimersByTimeAsync(SECURE_STORE_TIMEOUT_MS);

    expect(beforeHydrationTimeout).toBe(getDeviceId());
  });

  it('reuses hydrated id when SecureStore responds before first getDeviceId', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('persisted-device');

    startDeviceIdHydration();
    await jest.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    expect(getDeviceId()).toBe('persisted-device');
  });

  it('persists generated id in background', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);

    const id = getDeviceId();
    await jest.advanceTimersByTimeAsync(SECURE_STORE_TIMEOUT_MS);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'scorpius.move.device_id',
      id,
    );
  });
});
