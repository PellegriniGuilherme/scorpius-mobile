import { apiClient } from './client';

export async function deliverDocument(
  documentId: number,
  proof: { photo_url?: string; signature_url?: string; notes?: string; recipient_name?: string },
): Promise<void> {
  await apiClient.post(`/driver/documents/${documentId}/deliver`, proof);
}

export async function failDocument(documentId: number, reason: string): Promise<void> {
  await apiClient.post(`/driver/documents/${documentId}/fail`, { reason });
}

export async function getDocumentUploadUrl(documentId: number): Promise<{ url: string; key: string }> {
  const { data } = await apiClient.post<{ data: { url: string; key: string } }>(
    `/driver/documents/${documentId}/upload-url`,
  );
  return data.data;
}
