/**
 * Scorpius Move — RootNavigator tests (T068.2).
 *
 * Cobre:
 *  - sem driver autenticado: mostra LoginScreen
 *  - com driver autenticado: mostra HomeMotoristaScreen
 *  - preview mode (?preview=screen=home) força uma tela sem auth
 */
import { renderWithTheme, screen, waitFor } from '@/../jest.test-utils';
import { RootNavigator } from './RootNavigator';
import { useAuthStore } from '@/store/auth';
import * as clientApi from '@/api/client';

const DRIVER = {
  id: 91,
  name: 'Motorista Teste',
  whatsapp: '+5511999998888',
  status: 'active' as const,
  member_since: '2025-01-01',
};

// Mock @/api/client para que o bootstrap() do RootNavigator encontre
// um token e faça fetchDriverMe com sucesso. Sem isso, o useEffect
// reseta isAuthenticated para false antes do test conseguir ver
// HomeMotoristaScreen.
jest.mock('@/api/client', () => ({
  loadAccessToken: jest.fn().mockResolvedValue('mock-token'),
  setAccessToken: jest.fn().mockResolvedValue(undefined),
  registerSessionExpiredHandler: jest.fn(),
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('@/api/auth', () => ({
  fetchDriverMe: jest.fn().mockResolvedValue({
    id: 91,
    name: 'Motorista Teste',
    whatsapp: '+5511999998888',
    status: 'active',
  }),
  requestOtp: jest.fn(),
  confirmOtp: jest.fn(),
}));

describe('RootNavigator', () => {
  beforeEach(() => {
    useAuthStore.setState({
      driver: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it('shows LoginScreen when no driver is authenticated', async () => {
    // Para este test, mockar loadAccessToken para retornar null
    // (simula estado "não logado" sem token no SecureStore).
    (clientApi.loadAccessToken as jest.Mock).mockResolvedValueOnce(null);
    useAuthStore.setState({
      driver: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    renderWithTheme(<RootNavigator />);
    await waitFor(() => {
      // LoginScreen tem o título "Scorpius Move" e inputs
      expect(screen.getAllByText(/scorpius/i).length).toBeGreaterThan(0);
    });
  });

  it('shows HomeMotoristaScreen when driver is authenticated', async () => {
    useAuthStore.setState({
      driver: DRIVER,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    renderWithTheme(<RootNavigator />);
    // O useEffect do RootNavigator chama bootstrap() que reseta o
    // estado se loadAccessToken() retorna null. Re-seta o estado
    // APÓS o mount para prevalecer sobre o efeito.
    await waitFor(() => {
      useAuthStore.setState({
        driver: DRIVER,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    });
    // Espera a re-renderização
    await waitFor(() => {
      expect(screen.getByText(/Minhas entregas/i)).toBeTruthy();
    });
  });

  it('preview mode (?preview=screen=home) bypasses auth and shows HomeMotorista', async () => {
    // Simula query string: jest não tem URL por padrão, então stub
    // window.location.search via Object.defineProperty.
    const originalLocation = globalThis.location;
    Object.defineProperty(globalThis, 'location', {
      value: { search: '?preview=screen=home' },
      writable: true,
      configurable: true,
    });
    try {
      useAuthStore.setState({
        driver: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      renderWithTheme(<RootNavigator />);
      await waitFor(() => {
        expect(screen.getByText(/Minhas entregas/i)).toBeTruthy();
      });
    } finally {
      Object.defineProperty(globalThis, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    }
  });
});
