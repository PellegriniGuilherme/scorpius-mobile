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

function mockDeliveriesPage(data = MOCK_DELIVERY_API, page = 1, lastPage = 1) {
  (deliveryService.fetchDeliveriesPage as jest.Mock).mockResolvedValue({
    data,
    meta: { current_page: page, last_page: lastPage, per_page: 20, total: data.length },
    fromCache: false,
  });
}

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
    mockDeliveriesPage();
    (deliveryService.readDeliveriesFromCache as jest.Mock).mockImplementation(() =>
      Promise.resolve(MOCK_DELIVERY_API),
    );
  });

  it('renders active mock deliveries with default filter', async () => {
    renderWithTheme(<HomeMotoristaScreen />);
    expect(await screen.findByText('Mercado Central Ltda')).toBeTruthy();
    expect(screen.getByText('Farmácia Paulista')).toBeTruthy();
    expect(screen.queryByText('Hospital Norte')).toBeNull();
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
    fireEvent.press(screen.getByTestId('home-filter-option-picked_up'));
    fireEvent.press(screen.getByTestId('home-filter-option-in_route'));
    fireEvent.press(screen.getByTestId('home-filter-apply'));

    expect(screen.getByText('Mercado Central Ltda')).toBeTruthy();
    expect(screen.queryByText('Farmácia Paulista')).toBeNull();
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
    mockDeliveriesPage([]);
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

  it('calls fetchDeliveriesPage with forceNetwork on pull-to-refresh', async () => {
    renderWithTheme(<HomeMotoristaScreen />);
    await screen.findByText('Mercado Central Ltda');

    const list = screen.getByTestId('home-delivery-list');
    const { refreshControl } = list.props;
    expect(refreshControl).toBeTruthy();
    await act(async () => {
      await refreshControl.props.onRefresh();
    });

    await waitFor(() => {
      expect(deliveryService.fetchDeliveriesPage).toHaveBeenCalledWith(1, { forceNetwork: true });
    });
  });

  it('loads deliveries from network on mount', async () => {
    renderWithTheme(<HomeMotoristaScreen />);
    await screen.findByText('Mercado Central Ltda');

    expect(deliveryService.fetchDeliveriesPage).toHaveBeenCalled();
    expect(mapDelivery(MOCK_DELIVERY_API[0]).customer.name).toBe('Mercado Central Ltda');
  });

  it('loads next page when list reaches the end', async () => {
    mockDeliveriesPage(MOCK_DELIVERY_API.slice(0, 1), 1, 2);
    renderWithTheme(<HomeMotoristaScreen />);
    await screen.findByText('Mercado Central Ltda');

    const list = screen.getByTestId('home-delivery-list');
    await act(async () => {
      list.props.onEndReached();
    });

    await waitFor(() => {
      expect(deliveryService.fetchDeliveriesPage).toHaveBeenCalledWith(2, { forceNetwork: undefined });
    });
  });
});
