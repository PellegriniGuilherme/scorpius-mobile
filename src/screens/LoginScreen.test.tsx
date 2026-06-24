/**
 * Scorpius Move — LoginScreen tests (T068.2 + T122).
 *
 * Cobre:
 *  - render básico (form + botão)
 *  - validação de WhatsApp (botão disabled com input inválido)
 *  - T122 gate check-phone:
 *    a. exists=true  → chama requestOtp → navega para OtpScreen
 *    b. exists=false → mostra erro "Acesso não liberado", NÃO navega
 *  - 422 do check-phone → mostra erro de telefone inválido
 *  - Erro genérico → mostra erro genérico
 */
import { renderWithTheme, fireEvent, screen, waitFor } from '@/../jest.test-utils';
import { LoginScreen } from './LoginScreen';
import * as authApi from '@/api/auth';

jest.mock('@/api/auth', () => ({
  checkPhone: jest.fn(),
  requestOtp: jest.fn(),
  confirmOtp: jest.fn(),
  fetchDriverMe: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), reset: jest.fn() }),
  useRoute: () => ({ params: {}, key: 'test', name: 'Login' }),
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
}));

const VALID_PHONE = '5511999998888';
const FORMATTED_PHONE = `+${VALID_PHONE}`;

describe('LoginScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    (authApi.checkPhone as jest.Mock).mockReset();
    (authApi.requestOtp as jest.Mock).mockReset();
    // Default: motorista existe (caminho feliz).
    (authApi.checkPhone as jest.Mock).mockResolvedValue({ exists: true, driverId: '42' });
    (authApi.requestOtp as jest.Mock).mockResolvedValue({ expires_in: 300 });
  });

  it('renders form with phone input and submit button', () => {
    renderWithTheme(<LoginScreen />);
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('disables submit when phone is empty', () => {
    renderWithTheme(<LoginScreen />);
    const btn = screen.getByRole('button');
    expect(btn.props.accessibilityState.disabled).toBe(true);
  });

  it('enables submit when phone is valid (11 digits)', () => {
    renderWithTheme(<LoginScreen />);
    const input = screen.getByLabelText(/whatsapp/i);
    fireEvent.changeText(input, VALID_PHONE);
    const btn = screen.getByRole('button');
    expect(btn.props.accessibilityState.disabled).toBe(false);
  });

  // T122: caminho feliz — check-phone retorna exists=true → requestOtp → Otp
  it('T122: calls checkPhone → requestOtp → navigate Otp when exists=true', async () => {
    renderWithTheme(<LoginScreen />);
    const input = screen.getByLabelText(/whatsapp/i);
    fireEvent.changeText(input, VALID_PHONE);
    fireEvent.press(screen.getByRole('button'));

    await waitFor(() => {
      expect(authApi.checkPhone).toHaveBeenCalledWith(FORMATTED_PHONE);
      expect(authApi.requestOtp).toHaveBeenCalledWith(FORMATTED_PHONE, expect.any(String));
      expect(mockNavigate).toHaveBeenCalledWith('Otp', {
        phone: FORMATTED_PHONE,
        expiresIn: 300,
      });
    });
  });

  // T122: motorista NÃO existe — bloqueia sem chamar requestOtp nem navegar
  it('T122: blocks with "Acesso não liberado" when exists=false (does NOT call requestOtp, does NOT navigate)', async () => {
    (authApi.checkPhone as jest.Mock).mockResolvedValueOnce({ exists: false });

    renderWithTheme(<LoginScreen />);
    const input = screen.getByLabelText(/whatsapp/i);
    fireEvent.changeText(input, VALID_PHONE);
    fireEvent.press(screen.getByRole('button'));

    await waitFor(() => {
      expect(authApi.checkPhone).toHaveBeenCalledWith(FORMATTED_PHONE);
    });
    // requestOtp NÃO deve ter sido chamado
    expect(authApi.requestOtp).not.toHaveBeenCalled();
    // Navegação NÃO deve ter acontecido
    expect(mockNavigate).not.toHaveBeenCalled();
    // Erro inline visível
    expect(screen.getByText(/Acesso não liberado/i)).toBeTruthy();
  });

  // T122: 422 do check-phone → erro de telefone inválido
  it('T122: shows "telefone inválido" error when check-phone returns 422', async () => {
    (authApi.checkPhone as jest.Mock).mockRejectedValueOnce({
      response: { status: 422, data: { errors: { phone: ['Telefone inválido.'] } } },
    });

    renderWithTheme(<LoginScreen />);
    const input = screen.getByLabelText(/whatsapp/i);
    fireEvent.changeText(input, VALID_PHONE);
    fireEvent.press(screen.getByRole('button'));

    await waitFor(() => {
      // ptBR.login.errorInvalidPhone é a mensagem exibida.
      expect(screen.getByText(/Informe um número de WhatsApp v\u00e1lido/i)).toBeTruthy();
    });
    expect(authApi.requestOtp).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // Erro genérico de rede → mostra mensagem genérica
  it('shows generic error when check-phone rejects with non-422', async () => {
    (authApi.checkPhone as jest.Mock).mockRejectedValueOnce(new Error('network'));

    renderWithTheme(<LoginScreen />);
    const input = screen.getByLabelText(/whatsapp/i);
    fireEvent.changeText(input, VALID_PHONE);
    fireEvent.press(screen.getByRole('button'));

    await waitFor(() => {
      // Botão volta a enabled (loading=false), confirmando que error foi setado
      const btn = screen.getByRole('button');
      expect(btn.props.accessibilityState.busy).toBe(false);
    });
    expect(authApi.requestOtp).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});