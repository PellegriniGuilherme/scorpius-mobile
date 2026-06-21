/**
 * Scorpius Move — PerfilMotoristaScreen tests (T068.3).
 *
 * Cobre:
 *  - render dados do motorista (mock)
 *  - formata WhatsApp (E.164 BR)
 *  - botão logout tem variant 'danger' (via testID ou role)
 *  - tap logout → Alert.alert com 2 botões (Cancel + Confirm)
 *  - tap Confirm no Alert → chama clearSession
 *  - exibe versão do app
 *  - sem driver: mostra "—" em todos os campos
 */
import { renderWithTheme, fireEvent, screen } from '@/../jest.test-utils';
import { PerfilMotoristaScreen } from './PerfilMotoristaScreen';
import { Alert } from 'react-native';
import { useAuthStore } from '@/store/auth';

const mockClearSession = jest.fn();
jest.spyOn(Alert, 'alert').mockImplementation(
  (_title, _message, buttons) => {
    // Simula click no Confirm se fornecido
    const confirmBtn = buttons?.find((b) => b.style === 'destructive' || b.text === 'Sair');
    if (confirmBtn?.onPress) confirmBtn.onPress();
  },
);

jest.mock('@/api/client', () => ({
  loadAccessToken: jest.fn().mockResolvedValue('mock-token'),
  setAccessToken: jest.fn().mockResolvedValue(undefined),
  registerSessionExpiredHandler: jest.fn(),
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const DRIVER = {
  id: 91,
  name: 'João da Silva',
  whatsapp: '+5511999998888',
  status: 'active' as const,
  member_since: '2025-01-01',
};

describe('PerfilMotoristaScreen', () => {
  beforeEach(() => {
    mockClearSession.mockClear();
    (Alert.alert as jest.Mock).mockClear();
    useAuthStore.setState({
      driver: DRIVER,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clearSession: mockClearSession as any,
    });
  });

  it('renders driver name and avatar initial', () => {
    renderWithTheme(<PerfilMotoristaScreen />);
    expect(screen.getByText('João da Silva')).toBeTruthy();
    // Avatar mostra primeira letra do nome
    expect(screen.getByText('J')).toBeTruthy();
  });

  it('formats WhatsApp to E.164 BR pattern', () => {
    renderWithTheme(<PerfilMotoristaScreen />);
    // +55 (11) 99999-8888
    expect(screen.getByText('+55 (11) 99999-8888')).toBeTruthy();
  });

  it('shows driver status as "active"', () => {
    renderWithTheme(<PerfilMotoristaScreen />);
    // ptBR.profile.statusLabel = 'Status' (label) + valor 'active'
    expect(screen.getByText('active')).toBeTruthy();
  });

  it('logout button has accessibilityRole "button"', () => {
    renderWithTheme(<PerfilMotoristaScreen />);
    // ptBR.profile.logout = 'Sair'
    const logoutBtn = screen.getByRole('button', { name: 'Sair' });
    expect(logoutBtn).toBeTruthy();
  });

  it('tap logout shows Alert.alert with Cancel + Confirm buttons', () => {
    renderWithTheme(<PerfilMotoristaScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Sair' }));
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    // Verifica que Alert.alert foi chamado com 2 botões (Cancel + Confirm)
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as Array<{
      text: string;
      style?: string;
      onPress?: () => void;
    }>;
    expect(buttons).toHaveLength(2);
    expect(buttons[0].text).toBe('Cancelar');
    expect(buttons[0].style).toBe('cancel');
    expect(buttons[1].text).toBe('Sair');
    expect(buttons[1].style).toBe('destructive');
  });

  it('tap Confirm in Alert calls clearSession', () => {
    renderWithTheme(<PerfilMotoristaScreen />);
    // Mock do Alert.alert já chama onPress do botão destructive
    fireEvent.press(screen.getByRole('button', { name: 'Sair' }));
    expect(mockClearSession).toHaveBeenCalledTimes(1);
  });

  it('shows "—" for all fields when driver is null', () => {
    useAuthStore.setState({
      driver: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clearSession: mockClearSession as any,
    });
    renderWithTheme(<PerfilMotoristaScreen />);
    // Vários "—" para name, status, whatsapp
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it('exibe versão do app (expo-constants mock)', () => {
    renderWithTheme(<PerfilMotoristaScreen />);
    // appVersion = expoConfig?.version ?? '0.1.0' (default no jest.setup.js
    // mock de expo-constants não define version, então cai no fallback 0.1.0)
    expect(screen.getByText(/Versão 0\.1\.0/i)).toBeTruthy();
  });
});
