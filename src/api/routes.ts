import { apiClient } from './client';

export interface RouteEstimate {
  distance_km: number;
  duration_min: number;
  toll_estimate: {
    estimated_total_brl: number;
    plazas: Array<{ name: string; tariff_brl: number; confidence: string }>;
    disclaimer: string;
  };
  gas_stations: Array<{
    name: string;
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
