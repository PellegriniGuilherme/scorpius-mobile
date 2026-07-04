/**
 * Scorpius Move — Auth store (Zustand).
 */
import { create } from 'zustand';
import { loadAccessToken, registerSessionExpiredHandler } from '@/api/client';
import { fetchDriverMe, logoutDriver, type DriverSession } from '@/api/auth';
import { unregisterDeviceToken } from '@/api/occurrenceTypes';
import { getDeviceId } from '@/lib/deviceId';
import { deliveryCache } from '@/services/DeliveryCacheService';
import { syncWorker } from '@/services/SyncWorker';

interface AuthState {
  driver: DriverSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  bootstrap: () => Promise<void>;
  setSession: (driver: DriverSession) => void;
  clearSession: () => Promise<void>;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  driver: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  bootstrap: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = await loadAccessToken();
      if (token == null) {
        set({ isLoading: false, isAuthenticated: false, driver: null });
        return;
      }
      const driver = await fetchDriverMe();
      set({ driver, isAuthenticated: true, isLoading: false });
    } catch {
      set({ isLoading: false, isAuthenticated: false, driver: null });
    }
  },

  setSession: (driver) => {
    set({ driver, isAuthenticated: true, isLoading: false, error: null });
  },

  clearSession: async () => {
    syncWorker.stop();
    const deviceId = await getDeviceId();
    await logoutDriver(deviceId);
    try {
      const { notifications } = await import('@/services/NotificationsService');
      const token = notifications.getLastRegisteredToken();
      if (token) {
        await unregisterDeviceToken(token);
      }
      notifications.stop();
    } catch {
      // best-effort push unregister
    }
    await deliveryCache.clear();
    set({ driver: null, isAuthenticated: false, isLoading: false, error: null });
  },

  setError: (error) => set({ error }),
}));

registerSessionExpiredHandler(() => {
  void useAuthStore.getState().clearSession();
});
