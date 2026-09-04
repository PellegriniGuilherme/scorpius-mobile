import { formatFuelPrices, polylineToLatLng } from './mapRouteUtils';

describe('mapRouteUtils', () => {
  it('converts ORS [lng,lat] polyline to LatLng', () => {
    expect(polylineToLatLng([[-46.65, -23.56], [-46.63, -23.55]])).toEqual([
      { latitude: -23.56, longitude: -46.65 },
      { latitude: -23.55, longitude: -46.63 },
    ]);
  });

  it('returns empty array for missing polyline', () => {
    expect(polylineToLatLng(undefined)).toEqual([]);
    expect(polylineToLatLng(null)).toEqual([]);
  });

  it('formats fuel prices', () => {
    const text = formatFuelPrices(
      { gasolina: 5.9, etanol: 4.1 },
      { gasolina: 'Gasolina', etanol: 'Etanol', diesel: 'Diesel' },
    );
    expect(text).toContain('Gasolina R$ 5.90');
    expect(text).toContain('Etanol R$ 4.10');
    expect(text).not.toContain('Diesel');
  });
});
