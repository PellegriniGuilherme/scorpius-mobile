import { apiClient } from './client';

export type DocumentDeliveryStatus = 'pending' | 'delivered' | 'failed';

export interface DriverStop {
  document: {
    id: number;
    delivery_status: DocumentDeliveryStatus;
    reference_number?: string | null;
    type?: { slug: string; name: string } | null;
  };
  delivery: {
    id: number;
    reference_code: string;
    status: string;
    delivery_address: {
      street?: string;
      number?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      zip?: string;
      lat?: number;
      lng?: number;
    };
    recipient?: { name?: string; phone?: string };
    delivery_scheduled_at?: string | null;
  } | null;
}

export interface StopsResponse {
  data: DriverStop[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export async function listStops(params?: {
  delivery_status?: DocumentDeliveryStatus;
  page?: number;
}): Promise<StopsResponse> {
  const { data } = await apiClient.get<StopsResponse>('/driver/stops', { params });
  return data;
}

export interface DeliveryDetail {
  id: number;
  reference_code: string;
  status: string;
  delivery_address: DriverStop['delivery'] extends infer D ? D extends { delivery_address: infer A } ? A : never : never;
  recipient?: { name?: string; phone?: string };
  documents: Array<{
    id: number;
    reference_number?: string | null;
    delivery_status: DocumentDeliveryStatus;
    type?: { name: string; slug: string } | null;
  }>;
  documents_summary: { total: number; delivered: number; failed: number; pending: number };
}

export async function getDelivery(id: number): Promise<DeliveryDetail> {
  const { data } = await apiClient.get<{ data: DeliveryDetail }>(`/driver/deliveries/${id}`);
  return data.data;
}
