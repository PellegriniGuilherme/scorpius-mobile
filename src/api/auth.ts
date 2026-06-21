/**
 * Scorpius Move — Driver auth (OTP flow).
 *
 * Endpoints consumidos (Move App only — não confundir com Hub auth):
 *  - POST /api/v1/driver/auth/otp     → request OTP via WhatsApp
 *  - POST /api/v1/driver/auth/confirm → confirm OTP, get driver token
 *  - GET  /api/v1/driver/auth/me      → driver info (após login)
 *
 * Backend emite token opaco (não Sanctum) — armazenado em
 * `expo-secure-store` (Keychain iOS / EncryptedSharedPreferences Android).
 */
import { apiClient } from './client';
import { setAccessToken } from './client';

export interface OtpRequestResponse {
  message: string;
  expires_in: number; // segundos até o OTP expirar
}

export interface OtpConfirmResponse {
  access_token: string;
  token_type: 'Bearer';
  driver: {
    id: number;
    name: string;
    whatsapp: string;
    status: 'active' | 'invited' | 'blocked' | 'deactivated';
  };
}

export async function requestOtp(whatsapp: string, deviceId: string): Promise<OtpRequestResponse> {
  const { data } = await apiClient.post<OtpRequestResponse>('/driver/auth/otp', {
    whatsapp,
    device_id: deviceId,
  });
  return data;
}

export async function confirmOtp(
  whatsapp: string,
  otp: string,
  deviceId: string,
): Promise<OtpConfirmResponse> {
  const { data } = await apiClient.post<OtpConfirmResponse>('/driver/auth/confirm', {
    whatsapp,
    otp,
    device_id: deviceId,
  });
  await setAccessToken(data.access_token);
  return data;
}

export interface DriverMe {
  id: number;
  name: string;
  whatsapp: string;
  status: 'active' | 'invited' | 'blocked' | 'deactivated';
}

export async function fetchDriverMe(): Promise<DriverMe> {
  const { data } = await apiClient.get<{ user: DriverMe }>('/driver/auth/me');
  return data.user;
}
