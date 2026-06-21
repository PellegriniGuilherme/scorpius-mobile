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
import { renderWithTheme, fireEvent, screen } from '@/../jest.test-utils';
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

  it('renders delivery details when deliveryId is valid', () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<DetalheEntregaScreen />);
    // SC-1001 = Mercado Central Ltda
    expect(screen.getByText('Mercado Central Ltda')).toBeTruthy();
    expect(screen.getByText('+551133334444')).toBeTruthy();
    expect(screen.getByText('Av. Paulista, 1500')).toBeTruthy();
  });

  it('shows "Entrega não encontrada" for invalid deliveryId', () => {
    setRouteParams({ deliveryId: 99999 });
    renderWithTheme(<DetalheEntregaScreen />);
    expect(screen.getByText('Entrega não encontrada.')).toBeTruthy();
  });

  it('renders items with description, sku and quantity', () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<DetalheEntregaScreen />);
    // SC-1001 tem 2 itens: Caixa papelão 30x30x30 e Envelope pardo A3
    expect(screen.getByText('Caixa papelão 30x30x30')).toBeTruthy();
    expect(screen.getByText('Envelope pardo A3')).toBeTruthy();
    expect(screen.getByText('×5')).toBeTruthy();
    expect(screen.getByText('×2')).toBeTruthy();
  });

  it('navigates to MapaRota when "Abrir mapa" is pressed', () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<DetalheEntregaScreen />);
    fireEvent.press(screen.getByText('Abrir mapa'));
    expect(mockNavigate).toHaveBeenCalledWith('MapaRota', { deliveryId: 1001 });
  });

  it('navigates to Comprovante when "Coletar comprovante" is pressed', () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<DetalheEntregaScreen />);
    fireEvent.press(screen.getByText('Coletar comprovante'));
    expect(mockNavigate).toHaveBeenCalledWith('Comprovante', { deliveryId: 1001 });
  });

  it('hides "Coletar comprovante" button when status is delivered', () => {
    // SC-1003 tem status 'delivered'
    setRouteParams({ deliveryId: 1003 });
    renderWithTheme(<DetalheEntregaScreen />);
    // Botão "Coletar comprovante" NÃO deve estar presente
    expect(screen.queryByText('Coletar comprovante')).toBeNull();
    // "Abrir mapa" ainda presente
    expect(screen.getByText('Abrir mapa')).toBeTruthy();
  });
});
