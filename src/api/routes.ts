import { apiClient } from './client';

export interface GeoPointLabel {
  lat: number;
  lng: number;
  label?: string;
}

export interface RouteEstimate {
  distance_km: number;
  duration_min: number;
  polyline?: Array<[number, number]> | null;
  origin?: GeoPointLabel;
  destination?: GeoPointLabel;
  toll_estimate: {
    estimated_total_brl: number;
    plazas: Array<{
      name: string;
      highway?: string | null;
      lat?: number;
      lng?: number;
      tariff_brl: number;
      confidence: string;
    }>;
    disclaimer: string;
  };
  gas_stations: Array<{
    name: string;
    brand?: string | null;
    lat: number;
    lng: number;
    distance_km: number;
    prices: Record<string, number>;
    price_age_days?: number | null;
  }>;
  disclaimer: string;
}

export async function getDeliveryRoute(deliveryId: number): Promise<RouteEstimate> {
  const { data } = await apiClient.get<{ data: RouteEstimate }>(`/driver/deliveries/${deliveryId}/route`);
  return data.data;
}
