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

export interface PresignedUploadResponse {
  url: string;
  key: string;
  expires_at: string;
  method: string;
  content_type: string;
}

export async function requestProofUploadUrl(
  deliveryId: number,
  documentType: 'proof_of_delivery' | 'signature' | 'occurrence_photo',
  contentType: 'image/jpeg' | 'image/png' = 'image/jpeg',
): Promise<PresignedUploadResponse> {
  const { data } = await apiClient.post<{ data: PresignedUploadResponse }>(
    `/driver/deliveries/${deliveryId}/upload-url`,
    { document_type: documentType, content_type: contentType },
  );
  return data.data;
}

export async function storeDeliveryProof(
  deliveryId: number,
  payload: { photo_url?: string; signature_url?: string | null },
): Promise<void> {
  await apiClient.post(`/driver/deliveries/${deliveryId}/proof`, payload);
}
