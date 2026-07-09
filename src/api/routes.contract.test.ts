/**
 * Contract tests — canonical driver API paths.
 */
import { apiClient, authClient } from './client';
import { confirmOtp, fetchDriverMe } from './auth';
import { listDriverDeliveries, requestProofUploadUrl } from './deliveries';

jest.mock('./client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
  authClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
  loadAccessToken: jest.fn(),
  setAccessToken: jest.fn(),
  setRefreshToken: jest.fn(),
  loadRefreshToken: jest.fn(),
  registerSessionExpiredHandler: jest.fn(),
}));

describe('driver API route contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('auth confirm uses /driver/auth/otp/confirm', async () => {
    (authClient.post as jest.Mock).mockResolvedValue({
      data: { access_token: 'x', refresh_token: 'y', driver: { id: 1, name: 'T', whatsapp: '+5511', company_id: 1, company_name: 'Acme' } },
    });
    await confirmOtp('+5511999998888', '123456', 'device-1');
    expect(authClient.post).toHaveBeenCalledWith('/driver/auth/otp/confirm', {
      whatsapp: '+5511999998888',
      otp: '123456',
      device_id: 'device-1',
    });
  });

  it('fetchDriverMe uses /driver/auth/me', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: { driver: { id: 1, name: 'T', whatsapp: '+5511', company_id: 1, company_name: 'Acme' } },
    });
    await fetchDriverMe();
    expect(apiClient.get).toHaveBeenCalledWith('/driver/auth/me');
  });

  it('listDriverDeliveries uses /driver/deliveries', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ data: { data: [], meta: {} } });
    await listDriverDeliveries({ status: 'assigned' });
    expect(apiClient.get).toHaveBeenCalledWith('/driver/deliveries', { params: { status: 'assigned' } });
  });

  it('requestProofUploadUrl uses driver upload-url path', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: { data: { url: 'http://x', key: 'k', content_type: 'image/jpeg', expires_at: '', method: 'PUT' } },
    });
    await requestProofUploadUrl(42, 'proof_of_delivery', 'image/jpeg');
    expect(apiClient.post).toHaveBeenCalledWith('/driver/deliveries/42/upload-url', {
      document_type: 'proof_of_delivery',
      content_type: 'image/jpeg',
    });
  });
});
