/**
 * Scorpius Move — Auth store (Zustand).
 *
 * State: { driver, isAuthenticated, isLoading }.
 * O access_token é gerenciado pelo `api/client.ts` (SecureStore);
 * esta store apenas rastreia o objeto Driver para uso na UI.
 *
 * Persistência do driver: NÃO persistido (driver é recarregado via
 * /driver/auth/me no boot se o token existir).
 */
import { create } from 'zustand';
import { loadAccessToken, setAccessToken, registerSessionExpiredHandler } from '@/api/client';
import { fetchDriverMe, type DriverMe } from '@/api/auth';

interface AuthState {
  driver: DriverMe | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  bootstrap: () => Promise<void>;
  setSession: (driver: DriverMe) => void;
  clearSession: () => Promise<void>;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  driver: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  /**
   * Chamado no boot do app. Se há token no SecureStore, tenta
   * revalidar via /driver/auth/me. Em sucesso, hidrata a store.
   * Em 401, o interceptor do apiClient já limpou o token.
   */
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
    await setAccessToken(null);
    set({ driver: null, isAuthenticated: false, isLoading: false, error: null });
  },

  setError: (error) => set({ error }),
}));

// ---------------------------------------------------------------------------
// Wire o interceptor 401 para limpar a store quando o token expira.
// ---------------------------------------------------------------------------
registerSessionExpiredHandler(() => {
  void useAuthStore.getState().clearSession();
});
