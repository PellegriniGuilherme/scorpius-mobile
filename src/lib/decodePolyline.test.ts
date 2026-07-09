import { decodePolyline } from './decodePolyline';

describe('decodePolyline', () => {
  it('decodes Google sample polyline', () => {
    const points = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(points.length).toBeGreaterThan(1);
    expect(points[0]).toEqual({ latitude: 38.5, longitude: -120.2 });
  });
});
