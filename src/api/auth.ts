/**
 * Driver auth — OTP flow aligned with hub-api.
 */
import { apiClient, setAccessToken } from './client';
import * as SecureStore from 'expo-secure-store';

const DRIVER_KEY = 'scorpius:move:driver';

export interface OtpRequestResponse {
  message: string;
  expires_in: number;
}

export interface DriverMe {
  id: number;
  name: string;
  whatsapp: string;
  company_id?: number;
  status?: 'active' | 'invited' | 'blocked' | 'deactivated';
}

export interface OtpConfirmResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  driver: DriverMe;
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
  const { data } = await apiClient.post<OtpConfirmResponse>('/driver/auth/otp/confirm', {
    whatsapp,
    otp,
    device_id: deviceId,
  });
  await setAccessToken(data.access_token);
  await persistDriver(data.driver);
  return data;
}

export async function persistDriver(driver: DriverMe): Promise<void> {
  try {
    await SecureStore.setItemAsync(DRIVER_KEY, JSON.stringify(driver));
  } catch {
    // ignore
  }
}

export async function loadPersistedDriver(): Promise<DriverMe | null> {
  try {
    const raw = await SecureStore.getItemAsync(DRIVER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DriverMe;
  } catch {
    return null;
  }
}

export async function clearPersistedDriver(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(DRIVER_KEY);
  } catch {
    // ignore
  }
}
