/**
 * Scorpius Move — Driver auth (OTP flow).
 *
 * Endpoints consumidos (Move App only — não confundir com Hub auth):
 *  - POST /api/v1/driver/auth/otp        → request OTP via WhatsApp
 *  - POST /api/v1/driver/auth/confirm    → confirm OTP, get driver token
 *  - GET  /api/v1/driver/auth/me         → driver info (após login)
 *  - GET  /api/v1/driver/check-phone     → gate: motorista existe? (T122)
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

/**
 * T122 — resposta de `GET /driver/check-phone`.
 * Indica se o telefone informado está vinculado a um motorista cadastrado.
 * Se `exists=false`, motorista NÃO se cadastra via app — empresa provisiona.
 */
export interface CheckPhoneResponse {
  exists: boolean;
  /** Apenas presente quando exists=true (id do motorista já cadastrado). */
  driverId?: string;
}

/**
 * T122 — gate de fluxo. Verifica se telefone já tem motorista cadastrado
 * antes de prosseguir para requestOtp. Se `exists=false`, motorista é
 * bloqueado (empresa precisa provisionar antes do login).
 *
 * @param phone — telefone no formato E.164 (ex: `+5511999998888`).
 * @returns CheckPhoneResponse com `exists` boolean (e `driverId` opcional).
 * @throws AxiosError com `response.status === 422` se phone é inválido.
 */
export async function checkPhone(phone: string): Promise<CheckPhoneResponse> {
  const { data } = await apiClient.get<CheckPhoneResponse>('/driver/check-phone', {
    params: { phone },
  });
  return data;
}

export async function requestOtp(whatsapp: string, deviceId: string): Promise<OtpRequestResponse> {
  const { data } = await apiClient.post<OtpRequestResponse>('/driver/auth/otp', {
    whatsapp,
    device_id: deviceId,
  });
  return data;
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