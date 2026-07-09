/**
 * Scorpius Move — API client with token refresh.
 *
 * authClient: rotas públicas de login (sem interceptors).
 * apiClient: rotas autenticadas (Bearer + refresh em 401).
 */
import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { getDeviceId } from '@/lib/deviceId';
import { getApiBaseUrl, resolveBaseURL } from '@/api/config';
import { SECURE_STORE_TIMEOUT_MS, withTimeout } from '@/lib/secureStoreTimeout';

const TIMEOUT_MS = 30_000;
const SECURE_STORE_TOKEN_KEY = 'scorpius.move.driver_token';
const SECURE_STORE_REFRESH_KEY = 'scorpius.move.driver_refresh_token';
const TOKEN_HYDRATION_WAIT_MS = 300;

function createHttpClient(): AxiosInstance {
  return axios.create({
    baseURL: resolveBaseURL(),
    timeout: TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
}

/** Login OTP — sem interceptors (não bloqueia no SecureStore). */
export const authClient: AxiosInstance = createHttpClient();

/** API autenticada do motorista. */
export const apiClient: AxiosInstance = createHttpClient();

let cachedToken: string | null = null;
let cachedRefreshToken: string | null = null;
let tokensHydrated = false;
let tokenHydrationPromise: Promise<void> | null = null;
let refreshInFlight: Promise<boolean> | null = null;

/** Hidrata tokens do SecureStore em background — não bloqueia UI/login. */
export function startTokenHydration(): void {
  if (tokenHydrationPromise) return;

  tokenHydrationPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      void (async () => {
        try {
          cachedToken = await withTimeout(
            SecureStore.getItemAsync(SECURE_STORE_TOKEN_KEY),
            SECURE_STORE_TIMEOUT_MS,
            () => null,
          );
          cachedRefreshToken = await withTimeout(
            SecureStore.getItemAsync(SECURE_STORE_REFRESH_KEY),
            SECURE_STORE_TIMEOUT_MS,
            () => null,
          );
        } catch {
          cachedToken = null;
          cachedRefreshToken = null;
        } finally {
          tokensHydrated = true;
          resolve();
        }
      })();
    }, 0);
  });
}

export async function waitForTokenHydration(
  maxMs = TOKEN_HYDRATION_WAIT_MS,
): Promise<void> {
  startTokenHydration();
  if (tokensHydrated) return;
  if (!tokenHydrationPromise) return;

  await Promise.race([
    tokenHydrationPromise,
    new Promise<void>((resolve) => {
      setTimeout(resolve, maxMs);
    }),
  ]);

  if (!tokensHydrated) {
    tokensHydrated = true;
  }
}

export async function loadAccessToken(): Promise<string | null> {
  if (!tokensHydrated) {
    await waitForTokenHydration();
  }
  return cachedToken;
}

export async function loadRefreshToken(): Promise<string | null> {
  if (!tokensHydrated) {
    await waitForTokenHydration();
  }
  return cachedRefreshToken;
}

export async function setAccessToken(token: string | null): Promise<void> {
  cachedToken = token;
  tokensHydrated = true;
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
  tokensHydrated = true;
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

export { getApiBaseUrl };

/** Test-only helper */
export function resetTokenCacheForTests(): void {
  cachedToken = null;
  cachedRefreshToken = null;
  tokensHydrated = false;
  tokenHydrationPromise = null;
}

type SessionExpiredHandler = () => void;
let sessionExpiredHandler: SessionExpiredHandler | null = null;

export function registerSessionExpiredHandler(fn: SessionExpiredHandler): void {
  sessionExpiredHandler = fn;
}

function setAuthHeader(config: InternalAxiosRequestConfig, token: string): void {
  const headers = config.headers;
  if (typeof headers.set === 'function' && typeof headers.has === 'function') {
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return;
  }
  const record = headers as Record<string, string | undefined>;
  if (!record.Authorization && !record.authorization) {
    record.Authorization = `Bearer ${token}`;
  }
}

async function tryRefreshToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = await loadRefreshToken();
    if (!refreshToken) return false;
    const deviceId = getDeviceId();
    try {
      const { data } = await authClient.post<{
        access_token: string;
        refresh_token: string;
      }>('/driver/auth/refresh', {
        refresh_token: refreshToken,
        device_id: deviceId,
      });
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

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessTokenSync();
  if (token) {
    setAuthHeader(config, token);
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
        const token = getAccessTokenSync();
        if (token) {
          setAuthHeader(original, token);
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
