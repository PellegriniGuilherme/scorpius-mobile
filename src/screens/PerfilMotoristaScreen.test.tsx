import { renderWithTheme, fireEvent, screen } from '@/../jest.test-utils';
import { PerfilMotoristaScreen } from './PerfilMotoristaScreen';
import { useAuthStore } from '@/store/auth';

const mockClearSession = jest.fn();

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
  company_id: 42,
  company_name: 'Acme Transportes',
};

describe('PerfilMotoristaScreen', () => {
  beforeEach(() => {
    mockClearSession.mockClear();
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
    expect(screen.getByText('JS')).toBeTruthy();
  });

  it('formats WhatsApp to E.164 BR pattern', () => {
    renderWithTheme(<PerfilMotoristaScreen />);
    expect(screen.getByText('+55 (11) 99999-8888')).toBeTruthy();
  });

  it('shows platform label when company_name is absent', () => {
    useAuthStore.setState({
      driver: { ...DRIVER, company_name: null },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clearSession: mockClearSession as any,
    });
    renderWithTheme(<PerfilMotoristaScreen />);
    expect(screen.getByText('Plataforma Scorpius')).toBeTruthy();
  });

  it('shows driver company name', () => {
    renderWithTheme(<PerfilMotoristaScreen />);
    expect(screen.getByText('Acme Transportes')).toBeTruthy();
    expect(screen.queryByText('#42')).toBeNull();
  });

  it('tap logout opens ConfirmDialog with cancel and confirm', () => {
    renderWithTheme(<PerfilMotoristaScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Sair' }));
    expect(screen.getByTestId('profile-logout-dialog')).toBeTruthy();
    expect(screen.getByText('Sair da conta?')).toBeTruthy();
    expect(screen.getByTestId('profile-logout-dialog-cancel')).toBeTruthy();
    expect(screen.getByTestId('profile-logout-dialog-confirm')).toBeTruthy();
  });

  it('tap Confirm in dialog calls clearSession', () => {
    renderWithTheme(<PerfilMotoristaScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Sair' }));
    fireEvent.press(screen.getByTestId('profile-logout-dialog-confirm'));
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
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('exibe versão do app (expo-constants mock)', () => {
    renderWithTheme(<PerfilMotoristaScreen />);
    expect(screen.getByText(/Versão 0\.1\.0/i)).toBeTruthy();
  });
});
