/**
 * Scorpius Move — Driver auth (OTP flow).
 */
import { apiClient, authClient, loadRefreshToken, setAccessToken, setRefreshToken } from './client';

export interface OtpRequestResponse {
  message: string;
  expires_in: number;
}

export interface CheckPhoneResponse {
  exists: boolean;
  driverId?: string;
}

export async function checkPhone(phone: string): Promise<CheckPhoneResponse> {
  const { data } = await authClient.get<CheckPhoneResponse>('/driver/check-phone', {
    params: { phone },
  });
  return data;
}

export async function requestOtp(whatsapp: string, deviceId: string): Promise<OtpRequestResponse> {
  const { data } = await authClient.post<OtpRequestResponse>('/driver/auth/otp', {
    whatsapp,
    device_id: deviceId,
  });
  return data;
}

export interface DriverSession {
  id: number;
  name: string;
  whatsapp: string;
  company_id: number;
}

export interface OtpConfirmResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  driver: DriverSession;
}

export async function confirmOtp(
  whatsapp: string,
  otp: string,
  deviceId: string,
): Promise<OtpConfirmResponse> {
  const { data } = await authClient.post<OtpConfirmResponse>('/driver/auth/otp/confirm', {
    whatsapp,
    otp,
    device_id: deviceId,
  });
  await setAccessToken(data.access_token);
  await setRefreshToken(data.refresh_token);
  return data;
}

export async function refreshTokens(deviceId: string): Promise<boolean> {
  const refreshToken = await loadRefreshToken();
  if (!refreshToken) return false;
  try {
    const { data } = await authClient.post<OtpConfirmResponse>('/driver/auth/refresh', {
      refresh_token: refreshToken,
      device_id: deviceId,
    });
    await setAccessToken(data.access_token);
    await setRefreshToken(data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

export async function logoutDriver(deviceId: string): Promise<void> {
  try {
    await apiClient.post('/driver/auth/logout', { device_id: deviceId });
  } catch {
    // best-effort
  }
  await setAccessToken(null);
  await setRefreshToken(null);
}

export async function fetchDriverMe(): Promise<DriverSession> {
  const { data } = await apiClient.get<{ driver: DriverSession }>('/driver/auth/me');
  return data.driver;
}
