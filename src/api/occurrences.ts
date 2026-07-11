import { apiClient } from './client';

export type DriverOccurrenceStatus = 'open' | 'acknowledged' | 'resolved';

export interface DriverOccurrenceTypeSummary {
  id: number;
  slug: string;
  name: string;
}

export interface DriverOccurrence {
  id: number;
  delivery_id: number | null;
  type?: DriverOccurrenceTypeSummary | null;
  description?: string | null;
  status: DriverOccurrenceStatus;
  occurred_at?: string;
  created_at: string;
}

export interface DriverOccurrenceListResponse {
  data: DriverOccurrence[];
  meta: {
    has_more: boolean;
    next_cursor_id: number | null;
    per_page: number;
  };
}

export async function fetchDeliveryOccurrences(
  deliveryId: number,
  params: { cursor_id?: number; per_page?: number } = {},
): Promise<DriverOccurrenceListResponse> {
  const { data } = await apiClient.get<DriverOccurrenceListResponse>(
    `/driver/deliveries/${deliveryId}/occurrences`,
    { params },
  );
  return data;
}
