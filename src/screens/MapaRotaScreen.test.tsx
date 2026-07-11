/**
 * Scorpius Move — MapaRotaScreen tests (Google Maps).
 */
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { useRoute } from '@react-navigation/native';
import { renderWithTheme, fireEvent, screen } from '@/../jest.test-utils';
import { MapaRotaScreen } from './MapaRotaScreen';

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

describe('MapaRotaScreen', () => {
  beforeEach(() => {
    openURLSpy.mockClear();
    (Constants as { expoConfig?: { extra?: { googleMapsApiKey?: string } } }).expoConfig = {
      extra: { googleMapsApiKey: 'test-google-maps-key' },
    };
    Platform.OS = 'ios';
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        status: 'OK',
        routes: [
          {
            overview_polyline: { points: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
            legs: [{ distance: { value: 5200 }, duration: { value: 900 } }],
          },
        ],
      }),
    });
  });

  it('renders pickup route for pending delivery', async () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<MapaRotaScreen />);
    expect(await screen.findByText('Rota até a retirada')).toBeTruthy();
    expect(screen.getByText(/Rua da Consolação, 900/)).toBeTruthy();
  });

  it('renders delivery route for in-transit delivery', async () => {
    setRouteParams({ deliveryId: 1002 });
    renderWithTheme(<MapaRotaScreen />);
    expect(await screen.findByText('Rota até o destino')).toBeTruthy();
    expect(screen.getByText(/Rua Augusta, 2200/)).toBeTruthy();
  });

  it('shows "Entrega não encontrada" for invalid deliveryId', async () => {
    setRouteParams({ deliveryId: 99999 });
    renderWithTheme(<MapaRotaScreen />);
    expect(await screen.findByText('Entrega não encontrada.')).toBeTruthy();
  });

  it('renders Google MapView on native when API key is set', async () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<MapaRotaScreen />);
    await screen.findByText('Rota até a retirada');
    expect(screen.getByTestId('google-map')).toBeTruthy();
    expect(screen.getByTestId('map-marker-destination')).toBeTruthy();
  });

  it('renders fallback when API key is missing', async () => {
    (Constants as { expoConfig?: { extra?: { googleMapsApiKey?: string } } }).expoConfig = {
      extra: { googleMapsApiKey: '' },
    };
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<MapaRotaScreen />);
    expect(await screen.findByTestId('map-fallback')).toBeTruthy();
  });

  it('renders Google Static Map on web when API key is set', async () => {
    Platform.OS = 'web';
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<MapaRotaScreen />);
    expect(await screen.findByTestId('google-static-map')).toBeTruthy();
  });

  it('shows distance and duration cards', async () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<MapaRotaScreen />);
    expect(await screen.findByText('5.2 km')).toBeTruthy();
    expect(screen.getByText('15 min')).toBeTruthy();
  });

  it('opens Google Maps with destination when button pressed', async () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<MapaRotaScreen />);
    const btn = await screen.findByText(/Abrir no app de mapas/i);
    fireEvent.press(btn);
    expect(openURLSpy).toHaveBeenCalledTimes(1);
    const url = openURLSpy.mock.calls[0][0] as string;
    expect(url).toContain('google.com/maps');
    expect(url).toContain('destination=');
    expect(url).toContain('-23.5489');
  });
});
