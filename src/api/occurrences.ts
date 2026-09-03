import { apiClient } from './client';

export type OccurrenceTypeScope = 'delivery' | 'document' | 'both';

export interface OccurrenceType {
  id: number;
  slug: string;
  name: string;
  severity: string;
  requires_photo: boolean;
  scope: OccurrenceTypeScope;
}

export async function listOccurrenceTypes(): Promise<OccurrenceType[]> {
  const { data } = await apiClient.get<{ data: OccurrenceType[] }>('/driver/occurrence-types');
  return data.data;
}

export async function createOccurrence(
  deliveryId: number,
  payload: {
    occurrence_type_id: number;
    document_id?: number;
    description: string;
    photo_paths?: string[];
    location?: { lat: number; lng: number };
  },
): Promise<void> {
  await apiClient.post(`/driver/deliveries/${deliveryId}/occurrences`, payload);
}
