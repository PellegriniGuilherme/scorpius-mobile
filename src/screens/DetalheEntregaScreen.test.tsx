/**
 * Scorpius Move — DetalheEntregaScreen tests (T068.3).
 *
 * Cobre:
 *  - render com deliveryId param → dados da entrega mock
 *  - endereço/cliente/itens visíveis
 *  - tap "Abrir mapa" → navega para MapaRota
 *  - tap "Finalizar entrega" → navega para Comprovante
 *  - estado "entrega não encontrada" (id inválido)
 *  - botão "Finalizar entrega" some quando status = 'delivered'
 */
import { renderWithTheme, fireEvent, screen, waitFor, act } from '@/../jest.test-utils';
import { Linking } from 'react-native';
import { DetalheEntregaScreen } from './DetalheEntregaScreen';
import { useNavigation, useRoute } from '@react-navigation/native';
import { syncWorker } from '@/services/SyncWorker';
import { loadDeliveryOccurrencesView } from '@/services/occurrenceOutboxService';

jest.mock('@/services/SyncWorker', () => ({
  syncWorker: {
    drain: jest.fn().mockResolvedValue(0),
  },
}));

jest.mock('@/services/occurrenceOutboxService', () => ({
  loadDeliveryOccurrencesView: jest.fn().mockResolvedValue({
    remote: [],
    pending: [],
    typeNameMap: {},
  }),
}));

jest.mock('@/services/LocationTrackingService', () => {
  const actual = jest.requireActual('@/services/LocationTrackingService');
  return {
    ...actual,
    locationTrackingService: {
      isTrackingDelivery: jest.fn().mockReturnValue(true),
      getActiveDeliveryId: jest.fn().mockReturnValue(1001),
      startTracking: jest.fn().mockResolvedValue(true),
      stopTracking: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockReturnValue(() => undefined),
      getLastLocation: jest.fn().mockReturnValue(null),
    },
    syncLocationTrackingWithStatus: jest.fn().mockResolvedValue(true),
    requestLocationPermissions: jest.fn().mockResolvedValue({ foreground: 'granted', background: 'granted' }),
    resumeLocationTrackingFromCache: jest.fn().mockResolvedValue(undefined),
    syncTrackingForCachedDeliveries: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock('@react-navigation/native', () => {
  const mockReal = jest.requireActual('@react-navigation/native');
  return {
    ...mockReal,
    useNavigation: jest.fn(),
    useRoute: jest.fn(),
  };
});

const mockNavigate = jest.fn();
const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

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
    openURLSpy.mockClear();
    (Linking.canOpenURL as jest.Mock) = jest.fn().mockResolvedValue(true);
  });

  it('renders delivery details when deliveryId is valid', async () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<DetalheEntregaScreen />);
    expect(await screen.findByText('Mercado Central Ltda')).toBeTruthy();
    expect(screen.getByText(/\+55 \(11\)/)).toBeTruthy();
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

  it('navigates to Comprovante when "Finalizar entrega" is pressed', async () => {
    setRouteParams({ deliveryId: 1002 });
    renderWithTheme(<DetalheEntregaScreen />);
    fireEvent.press(await screen.findByText('Finalizar entrega'));
    expect(mockNavigate).toHaveBeenCalledWith('Comprovante', { deliveryId: 1002 });
  });

  it('navigates to MarcarFalha when fail choice card is pressed', async () => {
    setRouteParams({ deliveryId: 1002 });
    renderWithTheme(<DetalheEntregaScreen />);
    await screen.findByText('Algo deu errado?');
    fireEvent.press(screen.getByTestId('detail-fail-choice'));
    expect(mockNavigate).toHaveBeenCalledWith('MarcarFalha', { deliveryId: 1002 });
  });

  it('navigates to ReportarOcorrencia when occurrence choice card is pressed', async () => {
    setRouteParams({ deliveryId: 1002 });
    renderWithTheme(<DetalheEntregaScreen />);
    await screen.findByText('Algo deu errado?');
    fireEvent.press(screen.getByTestId('detail-occurrence-choice'));
    expect(mockNavigate).toHaveBeenCalledWith('ReportarOcorrencia', { deliveryId: 1002 });
  });

  it('opens phone dialer and whatsapp from customer actions', async () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<DetalheEntregaScreen />);
    await screen.findByText('Mercado Central Ltda');

    fireEvent.press(screen.getByTestId('detail-call-phone'));
    expect(openURLSpy).toHaveBeenCalledWith('tel:+551133334444');

    fireEvent.press(screen.getByTestId('detail-call-whatsapp'));
    expect(openURLSpy).toHaveBeenCalledWith('whatsapp://send?phone=551133334444');
  });

  it('hides "Finalizar entrega" button when status is delivered', async () => {
    setRouteParams({ deliveryId: 1003 });
    renderWithTheme(<DetalheEntregaScreen />);
    await screen.findByText('Hospital Norte');
    expect(screen.queryByText('Finalizar entrega')).toBeNull();
    expect(screen.getByText('Abrir mapa')).toBeTruthy();
  });

  it('pull-to-refresh drains outbox and reloads occurrences', async () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<DetalheEntregaScreen />);
    await screen.findByText('Mercado Central Ltda');

    const scroll = screen.getByTestId('detail-scroll');
    const { refreshControl } = scroll.props;
    expect(refreshControl).toBeTruthy();
    await act(async () => {
      await refreshControl.props.onRefresh();
    });

    await waitFor(() => {
      expect(syncWorker.drain).toHaveBeenCalled();
      expect(loadDeliveryOccurrencesView).toHaveBeenCalledWith(1001);
    });
  });
});
