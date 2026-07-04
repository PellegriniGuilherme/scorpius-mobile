/**
 * Scorpius Move — HomeMotoristaScreen tests (T068.2).
 *
 * Cobre:
 *  - render da lista de entregas (3 mocks, filtrados pelo driver_id)
 *  - tap em uma entrega navega para DetalheEntrega
 *  - filtro por status funciona
 *  - empty state quando nenhuma entrega bate o filtro
 */
import { renderWithTheme, fireEvent, screen, waitFor } from '@/../jest.test-utils';
import { HomeMotoristaScreen } from './HomeMotoristaScreen';
import { useAuthStore } from '@/store/auth';
import * as deliveryService from '@/services/deliveryService';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), reset: jest.fn() }),
  useRoute: () => ({ params: {}, key: 'test', name: 'HomeMotorista' }),
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
}));

const DRIVER = {
  id: 91,
  name: 'Motorista Teste',
  whatsapp: '+5511999998888',
  company_id: 1,
};

describe('HomeMotoristaScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    // Hidrata a store com driver de id 91 (bate com MOCK_DELIVERIES).
    useAuthStore.setState({
      driver: DRIVER,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
  });

  it('renders 3 mock deliveries for driver 91', async () => {
    renderWithTheme(<HomeMotoristaScreen />);
    expect(await screen.findByText('Mercado Central Ltda')).toBeTruthy();
    expect(screen.getByText('Farmácia Paulista')).toBeTruthy();
    expect(screen.getByText('Hospital Norte')).toBeTruthy();
  });

  it('navigates to DetalheEntrega when a card is pressed', async () => {
    renderWithTheme(<HomeMotoristaScreen />);
    fireEvent.press(await screen.findByText('Mercado Central Ltda'));
    expect(mockNavigate).toHaveBeenCalledWith('DetalheEntrega', { deliveryId: 1001 });
  });

  it('navigates to PerfilMotorista when "Meu perfil" button is pressed', () => {
    renderWithTheme(<HomeMotoristaScreen />);
    fireEvent.press(screen.getByText('Meu perfil'));
    expect(mockNavigate).toHaveBeenCalledWith('PerfilMotorista');
  });

  it('filters by status when "Pendente" filter is pressed', async () => {
    renderWithTheme(<HomeMotoristaScreen />);
    await screen.findByText('Mercado Central Ltda');
    fireEvent.press(screen.getByTestId('filter-pending'));
    expect(screen.getByText('Mercado Central Ltda')).toBeTruthy();
    expect(screen.queryByText('Farmácia Paulista')).toBeNull();
    expect(screen.queryByText('Hospital Norte')).toBeNull();
  });

  it('shows empty state when no deliveries match filter', async () => {
    (deliveryService.fetchDeliveriesWithCache as jest.Mock).mockResolvedValueOnce({ data: [], fromCache: false });
    renderWithTheme(<HomeMotoristaScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Nenhuma entrega/i)).toBeTruthy();
    });
  });
});
