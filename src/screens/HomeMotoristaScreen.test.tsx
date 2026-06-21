/**
 * Scorpius Move — HomeMotoristaScreen tests (T068.2).
 *
 * Cobre:
 *  - render da lista de entregas (3 mocks, filtrados pelo driver_id)
 *  - tap em uma entrega navega para DetalheEntrega
 *  - filtro por status funciona
 *  - empty state quando nenhuma entrega bate o filtro
 */
import { renderWithTheme, fireEvent, screen } from '@/../jest.test-utils';
import { HomeMotoristaScreen } from './HomeMotoristaScreen';
import { useAuthStore } from '@/store/auth';

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
  status: 'active' as const,
  member_since: '2025-01-01',
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

  it('renders 3 mock deliveries for driver 91', () => {
    renderWithTheme(<HomeMotoristaScreen />);
    expect(screen.getByText('Mercado Central Ltda')).toBeTruthy();
    expect(screen.getByText('Farmácia Paulista')).toBeTruthy();
    expect(screen.getByText('Hospital Norte')).toBeTruthy();
  });

  it('navigates to DetalheEntrega when a card is pressed', () => {
    renderWithTheme(<HomeMotoristaScreen />);
    fireEvent.press(screen.getByText('Mercado Central Ltda'));
    expect(mockNavigate).toHaveBeenCalledWith('DetalheEntrega', { deliveryId: 1001 });
  });

  it('navigates to PerfilMotorista when "Meu perfil" button is pressed', () => {
    renderWithTheme(<HomeMotoristaScreen />);
    fireEvent.press(screen.getByText('Meu perfil'));
    expect(mockNavigate).toHaveBeenCalledWith('PerfilMotorista');
  });

  it('filters by status when "Pendente" filter is pressed', () => {
    renderWithTheme(<HomeMotoristaScreen />);
    // Filter chip Pendente (testID adicionado para distinguir do badge).
    fireEvent.press(screen.getByTestId('filter-pending'));
    // Após filtro, apenas 1 visível (SC-1001 pending)
    expect(screen.getByText('Mercado Central Ltda')).toBeTruthy();
    expect(screen.queryByText('Farmácia Paulista')).toBeNull();
    expect(screen.queryByText('Hospital Norte')).toBeNull();
  });

  it('shows empty state when no deliveries match', () => {
    // Filtra por status que não tem entrega: "failed" não existe nos mocks
    renderWithTheme(<HomeMotoristaScreen />);
    // Sem clicar em "Falhou" (filtro não está nos chips visíveis)
    // validamos o empty state direto: setar driver_id inexistente
    useAuthStore.setState({
      driver: { ...DRIVER, id: 999 },
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    renderWithTheme(<HomeMotoristaScreen />);
    // Empty title aparece
    expect(screen.getByText(/Nenhuma entrega/i)).toBeTruthy();
  });
});
