/**
 * Scorpius Move — API client with token refresh.
 */
import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { getDeviceId } from '@/lib/deviceId';

const DEFAULT_BASE_URL = 'http://localhost:8000/api/v1';
const TIMEOUT_MS = 30_000;
const SECURE_STORE_TOKEN_KEY = 'scorpius:move:driver_token';
const SECURE_STORE_REFRESH_KEY = 'scorpius:move:driver_refresh_token';

function resolveBaseURL(): string {
  const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  if (fromExtra) return fromExtra;
  return DEFAULT_BASE_URL;
}

let cachedToken: string | null = null;
let cachedRefreshToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export async function loadAccessToken(): Promise<string | null> {
  if (cachedToken !== null) return cachedToken;
  try {
    cachedToken = await SecureStore.getItemAsync(SECURE_STORE_TOKEN_KEY);
    return cachedToken;
  } catch {
    return null;
  }
}

export async function loadRefreshToken(): Promise<string | null> {
  if (cachedRefreshToken !== null) return cachedRefreshToken;
  try {
    cachedRefreshToken = await SecureStore.getItemAsync(SECURE_STORE_REFRESH_KEY);
    return cachedRefreshToken;
  } catch {
    return null;
  }
}

export async function setAccessToken(token: string | null): Promise<void> {
  cachedToken = token;
  try {
    if (token === null) {
      await SecureStore.deleteItemAsync(SECURE_STORE_TOKEN_KEY);
    } else {
      await SecureStore.setItemAsync(SECURE_STORE_TOKEN_KEY, token);
    }
  } catch {
    // memory-only fallback
  }
}

export async function setRefreshToken(token: string | null): Promise<void> {
  cachedRefreshToken = token;
  try {
    if (token === null) {
      await SecureStore.deleteItemAsync(SECURE_STORE_REFRESH_KEY);
    } else {
      await SecureStore.setItemAsync(SECURE_STORE_REFRESH_KEY, token);
    }
  } catch {
    // memory-only fallback
  }
}

export function getAccessTokenSync(): string | null {
  return cachedToken;
}

type SessionExpiredHandler = () => void;
let sessionExpiredHandler: SessionExpiredHandler | null = null;

export function registerSessionExpiredHandler(fn: SessionExpiredHandler): void {
  sessionExpiredHandler = fn;
}

async function tryRefreshToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = await loadRefreshToken();
    if (!refreshToken) return false;
    const deviceId = await getDeviceId();
    try {
      const { data } = await axios.post<{
        access_token: string;
        refresh_token: string;
      }>(
        `${resolveBaseURL()}/driver/auth/refresh`,
        { refresh_token: refreshToken, device_id: deviceId },
        { headers: { Accept: 'application/json' }, timeout: TIMEOUT_MS },
      );
      await setAccessToken(data.access_token);
      await setRefreshToken(data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: resolveBaseURL(),
  timeout: TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await loadAccessToken();
  if (token && !config.headers.has('Authorization')) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        const token = await loadAccessToken();
        if (token) {
          original.headers.set('Authorization', `Bearer ${token}`);
        }
        return apiClient(original);
      }
      await setAccessToken(null);
      await setRefreshToken(null);
      sessionExpiredHandler?.();
    }
    return Promise.reject(error);
  },
);
