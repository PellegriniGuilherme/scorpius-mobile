/**
 * Scorpius Move — MapaRotaScreen tests (T068.3 + T080).
 *
 * T068.3: testes base (origin/destination/distance cards).
 * T080: Google Maps via Linking (PROVIDER_GOOGLE) + expo-location.
 *
 * Implementação atual (pós fix-expo merge): usa OpenStreetMap embed
 * como fallback no Expo Web + Linking para Google Maps nativo em
 * iOS/Android via `https://www.google.com/maps/dir/?api=1&destination=...`.
 *
 * Cobertura:
 *  - render com origin + destination labels
 *  - "Entrega não encontrada" para id inválido
 *  - distance/duration cards visíveis
 *  - tap em "Abrir no app de mapas" chama Linking.openURL com URL Google Maps
 *  - URL contém coords do destino
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

  it('renders mapa with origin and destination labels', () => {
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

  it('renders OpenStreetMap embed image with destination coords', () => {
    setRouteParams({ deliveryId: 1001 });
    const { toJSON } = renderWithTheme(<MapaRotaScreen />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('openstreetmap.org');
    expect(tree).toContain('-23.5613');
    expect(tree).toContain('-46.6565');
  });

  it('shows distance and duration cards', () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<MapaRotaScreen />);
    expect(screen.getByText('distância')).toBeTruthy();
    expect(screen.getByText('estimativa')).toBeTruthy();
  });

  it('opens Google Maps with destination when button pressed', () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<MapaRotaScreen />);
    const btn = screen.getByText(/Abrir no app de mapas/i);
    fireEvent.press(btn);
    expect(openURLSpy).toHaveBeenCalledTimes(1);
    const url = openURLSpy.mock.calls[0][0] as string;
    expect(url).toContain('google.com/maps');
    expect(url).toContain('destination=');
    expect(url).toContain('-23.5613');
  });

  it('shows placeholder note about Web limitation', () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<MapaRotaScreen />);
    expect(screen.getByText(/Mapa indisponível no Expo Web/i)).toBeTruthy();
  });
});