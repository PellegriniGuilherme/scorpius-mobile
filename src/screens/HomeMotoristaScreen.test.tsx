/**
 * Scorpius Move — HomeMotoristaScreen tests (T068.2).
 */
import { renderWithTheme, fireEvent, screen, waitFor, act } from '@/../jest.test-utils';
import { HomeMotoristaScreen } from './HomeMotoristaScreen';
import { useAuthStore } from '@/store/auth';
import * as deliveryService from '@/services/deliveryService';
import { notifyDeliveryCacheChanged } from '@/services/deliveryCacheEvents';
import { MOCK_DELIVERY_API } from '@/testFixtures/deliveryApi';
import { mapDelivery } from '@/lib/mapDelivery';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const React = jest.requireActual('react');
  return {
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), reset: jest.fn() }),
    useRoute: () => ({ params: {}, key: 'test', name: 'HomeMotorista' }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(() => callback(), [callback]);
    },
    NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
  };
});

const DRIVER = {
  id: 91,
  name: 'Motorista Teste',
  whatsapp: '+5511999998888',
  company_id: 1,
};

describe('HomeMotoristaScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    jest.clearAllMocks();
    useAuthStore.setState({
      driver: DRIVER,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    (deliveryService.fetchDeliveriesWithCache as jest.Mock).mockImplementation(() =>
      Promise.resolve({ data: MOCK_DELIVERY_API, fromCache: false }),
    );
    (deliveryService.readDeliveriesFromCache as jest.Mock).mockImplementation(() =>
      Promise.resolve(MOCK_DELIVERY_API),
    );
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

  it('navigates to PerfilMotorista when profile button is pressed', async () => {
    renderWithTheme(<HomeMotoristaScreen />);
    await screen.findByText('Mercado Central Ltda');
    fireEvent.press(screen.getByText('Meu perfil'));
    expect(mockNavigate).toHaveBeenCalledWith('PerfilMotorista');
  });

  it('filters by status when only pending is selected in the filter modal', async () => {
    renderWithTheme(<HomeMotoristaScreen />);
    await screen.findByText('Mercado Central Ltda');

    fireEvent.press(screen.getByTestId('home-filter-trigger'));
    fireEvent.press(screen.getByTestId('home-filter-option-in_route'));
    fireEvent.press(screen.getByTestId('home-filter-option-delivered'));
    fireEvent.press(screen.getByTestId('home-filter-option-failed'));
    fireEvent.press(screen.getByTestId('home-filter-apply'));

    expect(screen.getByText('Mercado Central Ltda')).toBeTruthy();
    expect(screen.queryByText('Farmácia Paulista')).toBeNull();
    expect(screen.queryByText('Hospital Norte')).toBeNull();
  });

  it('allows selecting multiple statuses such as pending and in route', async () => {
    renderWithTheme(<HomeMotoristaScreen />);
    await screen.findByText('Mercado Central Ltda');

    fireEvent.press(screen.getByTestId('home-filter-trigger'));
    fireEvent.press(screen.getByTestId('home-filter-option-delivered'));
    fireEvent.press(screen.getByTestId('home-filter-option-failed'));
    fireEvent.press(screen.getByTestId('home-filter-apply'));

    expect(screen.getByText('Mercado Central Ltda')).toBeTruthy();
    expect(screen.getByText('Farmácia Paulista')).toBeTruthy();
    expect(screen.queryByText('Hospital Norte')).toBeNull();
  });

  it('shows empty state when no deliveries match filter', async () => {
    (deliveryService.fetchDeliveriesWithCache as jest.Mock).mockResolvedValueOnce({ data: [], fromCache: false });
    (deliveryService.readDeliveriesFromCache as jest.Mock).mockResolvedValueOnce([]);
    renderWithTheme(<HomeMotoristaScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Nenhuma entrega/i)).toBeTruthy();
    });
  });

  it('reloads from cache when delivery cache changes', async () => {
    renderWithTheme(<HomeMotoristaScreen />);
    await screen.findByText('Farmácia Paulista');

    const callsBefore = (deliveryService.readDeliveriesFromCache as jest.Mock).mock.calls.length;

    await act(async () => {
      notifyDeliveryCacheChanged();
    });

    await waitFor(() => {
      expect(deliveryService.readDeliveriesFromCache).toHaveBeenCalledTimes(callsBefore + 1);
    });
  });

  it('calls fetchDeliveriesWithCache with forceNetwork on pull-to-refresh', async () => {
    renderWithTheme(<HomeMotoristaScreen />);
    await screen.findByText('Mercado Central Ltda');

    const list = screen.getByTestId('home-delivery-list');
    const { refreshControl } = list.props;
    expect(refreshControl).toBeTruthy();
    await act(async () => {
      await refreshControl.props.onRefresh();
    });

    await waitFor(() => {
      expect(deliveryService.fetchDeliveriesWithCache).toHaveBeenCalledWith({ forceNetwork: true });
    });
  });

  it('loads deliveries from network on mount', async () => {
    renderWithTheme(<HomeMotoristaScreen />);
    await screen.findByText('Mercado Central Ltda');

    expect(deliveryService.fetchDeliveriesWithCache).toHaveBeenCalled();
    expect(mapDelivery(MOCK_DELIVERY_API[0]).customer.name).toBe('Mercado Central Ltda');
  });
});
