/**
 * Scorpius Move — MapaRotaScreen tests (T068.3).
 *
 * Cobre:
 *  - render com deliveryId param
 *  - mostra origem/destino/distância/duração
 *  - tap "Abrir no Google Maps" chama Linking.openURL
 *  - estado "Entrega não encontrada" para id inválido
 *  - exibe Image com URL do OpenStreetMap
 */
import { renderWithTheme, fireEvent, screen } from '@/../jest.test-utils';
import { MapaRotaScreen } from './MapaRotaScreen';
import { Linking } from 'react-native';
import { useRoute } from '@react-navigation/native';

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

  it('renders mapa with origin and destination', () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<MapaRotaScreen />);
    // Origem: 'Hub Scorpius — Av. Paulista'
    expect(screen.getByText(/Hub Scorpius/i)).toBeTruthy();
    // Destino: 'Av. Paulista, 1500' (SC-1001)
    expect(screen.getByText('Av. Paulista, 1500')).toBeTruthy();
  });

  it('shows "Entrega não encontrada" for invalid deliveryId', () => {
    setRouteParams({ deliveryId: 99999 });
    renderWithTheme(<MapaRotaScreen />);
    expect(screen.getByText('Entrega não encontrada.')).toBeTruthy();
  });

  it('renders OpenStreetMap image with destination coordinates', () => {
    setRouteParams({ deliveryId: 1001 });
    const { toJSON } = renderWithTheme(<MapaRotaScreen />);
    // Verifica que há uma Image com source.uri (os mocks de Image do
    // react-native mantêm props.source na serialização).
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('openstreetmap.org');
    expect(tree).toContain('-23.5613'); // lat destino
  });

  it('opens Google Maps with destination when "Abrir no app de mapas" pressed', () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<MapaRotaScreen />);
    // ptBR.map.openExternal = 'Abrir no app de mapas'
    const btn = screen.getByText(/Abrir no app/i);
    fireEvent.press(btn);
    expect(openURLSpy).toHaveBeenCalledTimes(1);
    const url = openURLSpy.mock.calls[0][0] as string;
    expect(url).toContain('google.com/maps');
    expect(url).toContain('-23.5613'); // lat destino SC-1001
  });

  it('shows distance and duration cards', () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<MapaRotaScreen />);
    // ptBR.map.distance e ptBR.map.duration têm placeholders {km}/{min}.
    // Após substituição: distância (km) e estimativa (min). Verifica que
    // os labels "distância" e "estimativa" estão presentes.
    expect(screen.getByText('distância')).toBeTruthy();
    expect(screen.getByText('estimativa')).toBeTruthy();
  });
});
