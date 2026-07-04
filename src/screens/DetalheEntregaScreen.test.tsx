/**
 * Scorpius Move — DetalheEntregaScreen tests (T068.3).
 *
 * Cobre:
 *  - render com deliveryId param → dados da entrega mock
 *  - endereço/cliente/itens visíveis
 *  - tap "Abrir mapa" → navega para MapaRota
 *  - tap "Coletar comprovante" → navega para Comprovante
 *  - estado "entrega não encontrada" (id inválido)
 *  - botão "Coletar comprovante" some quando status = 'delivered'
 */
import { renderWithTheme, fireEvent, screen, waitFor } from '@/../jest.test-utils';
import { DetalheEntregaScreen } from './DetalheEntregaScreen';
import { useNavigation, useRoute } from '@react-navigation/native';

jest.mock('@react-navigation/native', () => {
  const mockReal = jest.requireActual('@react-navigation/native');
  return {
    ...mockReal,
    useNavigation: jest.fn(),
    useRoute: jest.fn(),
  };
});

const mockNavigate = jest.fn();
(useNavigation as jest.Mock).mockReturnValue({
  navigate: mockNavigate,
  goBack: jest.fn(),
  reset: jest.fn(),
});

function setRouteParams(params: { deliveryId: number } | undefined) {
  (useRoute as jest.Mock).mockReturnValue({
    params,
    key: 'test',
    name: 'DetalheEntrega',
  });
}

describe('DetalheEntregaScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders delivery details when deliveryId is valid', async () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<DetalheEntregaScreen />);
    expect(await screen.findByText('Mercado Central Ltda')).toBeTruthy();
    expect(screen.getByText('+551133334444')).toBeTruthy();
    expect(screen.getByText('Av. Paulista, 1500')).toBeTruthy();
  });

  it('shows "Entrega não encontrada" for invalid deliveryId', async () => {
    setRouteParams({ deliveryId: 99999 });
    renderWithTheme(<DetalheEntregaScreen />);
    expect(await screen.findByText('Entrega não encontrada.')).toBeTruthy();
  });

  it('renders package count', async () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<DetalheEntregaScreen />);
    expect(await screen.findByText(/7 pacote\(s\)/)).toBeTruthy();
  });

  it('navigates to MapaRota when "Abrir mapa" is pressed', async () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<DetalheEntregaScreen />);
    fireEvent.press(await screen.findByText('Abrir mapa'));
    expect(mockNavigate).toHaveBeenCalledWith('MapaRota', { deliveryId: 1001 });
  });

  it('navigates to Comprovante when "Coletar comprovante" is pressed', async () => {
    setRouteParams({ deliveryId: 1002 });
    renderWithTheme(<DetalheEntregaScreen />);
    fireEvent.press(await screen.findByText('Coletar comprovante'));
    expect(mockNavigate).toHaveBeenCalledWith('Comprovante', { deliveryId: 1002 });
  });

  it('hides "Coletar comprovante" button when status is delivered', async () => {
    setRouteParams({ deliveryId: 1003 });
    renderWithTheme(<DetalheEntregaScreen />);
    await screen.findByText('Hospital Norte');
    expect(screen.queryByText('Coletar comprovante')).toBeNull();
    expect(screen.getByText('Abrir mapa')).toBeTruthy();
  });
});
