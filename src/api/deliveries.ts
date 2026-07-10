import { apiClient } from './client';
import type { DeliveryApi, DeliveryApiStatus, DeliveryListResponse } from '@/types/delivery';

export interface ListDriverDeliveriesParams {
  status?: DeliveryApiStatus;
  per_page?: number;
  page?: number;
}

export async function listDriverDeliveries(
  params: ListDriverDeliveriesParams = {},
): Promise<DeliveryListResponse> {
  const { data } = await apiClient.get<DeliveryListResponse>('/driver/deliveries', { params });
  return data;
}

export async function getDriverDelivery(id: number): Promise<DeliveryApi> {
  const { data } = await apiClient.get<{ data: DeliveryApi }>(`/driver/deliveries/${id}`);
  return data.data;
}

export async function startDelivery(id: number): Promise<DeliveryApi> {
  const { data } = await apiClient.post<{ data: DeliveryApi }>(`/driver/deliveries/${id}/start`);
  return data.data;
}

export async function pickupDelivery(id: number): Promise<DeliveryApi> {
  const { data } = await apiClient.post<{ data: DeliveryApi }>(`/driver/deliveries/${id}/pickup`);
  return data.data;
}

export async function inTransitDelivery(id: number): Promise<DeliveryApi> {
  const { data } = await apiClient.post<{ data: DeliveryApi }>(`/driver/deliveries/${id}/in-transit`);
  return data.data;
}

export async function completeDelivery(
  id: number,
  payload: { photo_url?: string; signature_url?: string; notes?: string } = {},
): Promise<DeliveryApi> {
  const { data } = await apiClient.post<{ data: DeliveryApi }>(`/driver/deliveries/${id}/complete`, payload);
  return data.data;
}

export async function failDelivery(id: number, reason: string): Promise<DeliveryApi> {
  const { data } = await apiClient.post<{ data: DeliveryApi }>(`/driver/deliveries/${id}/fail`, { reason });
  return data.data;
}

export interface DeliveryFileUploadResponse {
  key: string;
  url: string;
  content_type: string;
}

export async function uploadDeliveryFile(
  deliveryId: number,
  documentType: 'proof_of_delivery' | 'signature' | 'occurrence_photo',
  localUri: string,
  contentType: 'image/jpeg' | 'image/png' = 'image/jpeg',
): Promise<DeliveryFileUploadResponse> {
  const formData = new FormData();
  formData.append('document_type', documentType);
  formData.append('file', {
    uri: localUri,
    name: documentType === 'signature' ? 'signature.png' : 'photo.jpg',
    type: contentType,
  } as unknown as Blob);

  const { data } = await apiClient.post<{ data: DeliveryFileUploadResponse }>(
    `/driver/deliveries/${deliveryId}/upload`,
    formData,
    { timeout: 60_000 },
  );
  return data.data;
}

export async function storeDeliveryProof(
  deliveryId: number,
  payload: { photo_url?: string; signature_url?: string | null },
): Promise<void> {
  await apiClient.post(`/driver/deliveries/${deliveryId}/proof`, payload);
}
