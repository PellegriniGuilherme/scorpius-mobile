/**
 * Scorpius Move — MapaRotaScreen tests (T068.3 + T080).
 *
 * T068.3: testes com OpenStreetMap placeholder.
 * T080: atualizados para Google Maps + PROVIDER_GOOGLE.
 *  - API key configurada: renderiza MapView com markers + polyline
 *  - Sem API key: fallback com aviso
 *  - Tap "Abrir no Google Maps" chama Linking.openURL
 *  - Distance/duration cards visíveis
 *  - Origin + destination labels
 */
import { renderWithTheme, fireEvent, screen } from '@/../jest.test-utils';
import { MapaRotaScreen } from './MapaRotaScreen';
import { Linking } from 'react-native';
import { useRoute } from '@react-navigation/native';
import Constants from 'expo-constants';

jest.mock('@react-navigation/native', () => {
  const mockReal = jest.requireActual('@react-navigation/native');
  return {
    ...mockReal,
    useNavigation: jest.fn().mockReturnValue({ navigate: jest.fn(), goBack: jest.fn() }),
    useRoute: jest.fn(),
  };
});

const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

function setRouteParams(params: { deliveryId: number } | undefined) {
  (useRoute as jest.Mock).mockReturnValue({
    params,
    key: 'test',
    name: 'MapaRota',
  });
}

describe('MapaRotaScreen (T080: Google Maps)', () => {
  beforeEach(() => {
    openURLSpy.mockClear();
    // Default: API key presente
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Constants.expoConfig as any) = { extra: { googleMapsApiKey: 'test-key' } };
  });

  afterAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Constants.expoConfig as any) = { extra: {} };
  });

  it('renders mapa with origin and destination', () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<MapaRotaScreen />);
    expect(screen.getByText(/Hub Scorpius/i)).toBeTruthy();
    expect(screen.getByText('Av. Paulista, 1500')).toBeTruthy();
  });

  it('shows "Entrega não encontrada" for invalid deliveryId', () => {
    setRouteParams({ deliveryId: 99999 });
    renderWithTheme(<MapaRotaScreen />);
    expect(screen.getByText('Entrega não encontrada.')).toBeTruthy();
  });

  it('renders Google Maps MapView with markers (when API key configured)', () => {
    setRouteParams({ deliveryId: 1001 });
    const { toJSON } = renderWithTheme(<MapaRotaScreen />);
    // MapView, Marker origin, Marker dest, Polyline são renderizados
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('MapView');
    expect(tree).toContain('marker-origin');
    expect(tree).toContain('marker-dest');
    expect(tree).toContain('polyline');
  });

  it('falls back to placeholder when API key absent', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Constants.expoConfig as any) = { extra: { googleMapsApiKey: '' } };
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<MapaRotaScreen />);
    expect(screen.getByText(/Google Maps API key não configurada/i)).toBeTruthy();
  });

  it('opens Google Maps with destination when button pressed', () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<MapaRotaScreen />);
    const btn = screen.getByText('Abrir no Google Maps');
    fireEvent.press(btn);
    expect(openURLSpy).toHaveBeenCalledTimes(1);
    const url = openURLSpy.mock.calls[0][0] as string;
    expect(url).toContain('google.com/maps');
    expect(url).toContain('-23.5613');
  });

  it('shows distance and duration cards', () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<MapaRotaScreen />);
    expect(screen.getByText('distância')).toBeTruthy();
    expect(screen.getByText('estimativa')).toBeTruthy();
  });
});
