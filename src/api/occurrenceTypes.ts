import { apiClient } from './client';

export type OccurrenceTypeOrigin = 'system' | 'customized_system' | 'custom';

export interface DriverOccurrenceType {
  id: number;
  slug: string;
  name: string;
  severity: string;
  requires_photo: boolean;
  is_active: boolean;
  origin: OccurrenceTypeOrigin;
}

export async function listDriverOccurrenceTypes(activeOnly = true): Promise<DriverOccurrenceType[]> {
  const { data } = await apiClient.get<{ data: DriverOccurrenceType[] }>('/driver/occurrence-types', {
    params: activeOnly ? { active_only: 1 } : undefined,
  });
  return data.data;
}

export async function registerDeviceToken(expoPushToken: string): Promise<void> {
  await apiClient.post('/driver/device-tokens', { expo_push_token: expoPushToken });
}

export async function unregisterDeviceToken(token: string): Promise<void> {
  await apiClient.delete(`/driver/device-tokens/${encodeURIComponent(token)}`);
}
