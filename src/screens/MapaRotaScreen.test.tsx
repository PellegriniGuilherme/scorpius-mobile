/**
 * Scorpius Move — MapaRotaScreen tests.
 */
import { Linking } from 'react-native';
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
  });

  it('renders mapa with route title and destination address', async () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<MapaRotaScreen />);
    expect(await screen.findByText('Rota até o destino')).toBeTruthy();
    expect(screen.getByText(/Av. Paulista, 1500/)).toBeTruthy();
  });

  it('shows "Entrega não encontrada" for invalid deliveryId', async () => {
    setRouteParams({ deliveryId: 99999 });
    renderWithTheme(<MapaRotaScreen />);
    expect(await screen.findByText('Entrega não encontrada.')).toBeTruthy();
  });

  it('renders OpenStreetMap embed image with destination coords', async () => {
    setRouteParams({ deliveryId: 1001 });
    const { toJSON } = renderWithTheme(<MapaRotaScreen />);
    await screen.findByText('Rota até o destino');
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('openstreetmap.org');
    expect(tree).toContain('-23.5613');
    expect(tree).toContain('-46.6565');
  });

  it('shows distance and duration cards', async () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<MapaRotaScreen />);
    expect(await screen.findByText(/\d+\.\d km/)).toBeTruthy();
    expect(screen.getByText(/\d+ min/)).toBeTruthy();
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
    expect(url).toContain('-23.5613');
  });
});
