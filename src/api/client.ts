/**
 * Scorpius Move — API client with token refresh.
 */
import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { getDeviceId } from '@/lib/deviceId';
import { SECURE_STORE_TIMEOUT_MS, withTimeout } from '@/lib/secureStoreTimeout';

const DEFAULT_BASE_URL = 'http://localhost:8000/api/v1';
const TIMEOUT_MS = 30_000;
const SECURE_STORE_TOKEN_KEY = 'scorpius:move:driver_token';
const SECURE_STORE_REFRESH_KEY = 'scorpius:move:driver_refresh_token';
const TOKEN_HYDRATION_WAIT_MS = 300;

const PUBLIC_AUTH_PATHS = [
  '/driver/check-phone',
  '/driver/auth/otp',
  '/driver/auth/otp/confirm',
] as const;

function isPublicAuthRequest(url: string | undefined): boolean {
  if (!url) return false;
  return PUBLIC_AUTH_PATHS.some((path) => url.includes(path));
}

function resolveBaseURL(): string {
  const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  if (fromExtra) return fromExtra;
  return DEFAULT_BASE_URL;
}

let cachedToken: string | null = null;
let cachedRefreshToken: string | null = null;
let tokensHydrated = false;
let tokenHydrationPromise: Promise<void> | null = null;
let refreshInFlight: Promise<boolean> | null = null;

/** Hidrata tokens do SecureStore em background — não bloqueia UI/login. */
export function startTokenHydration(): void {
  if (tokenHydrationPromise) return;

  tokenHydrationPromise = (async () => {
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
    }
  })();
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

export function getApiBaseUrl(): string {
  return resolveBaseURL();
}

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

async function tryRefreshToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refreshToken = await loadRefreshToken();
    if (!refreshToken) return false;
    const deviceId = getDeviceId();
    try {
      const { data } = await axios.post<{
        access_token: string;
        refresh_token: string;
      }>(`${resolveBaseURL()}/driver/auth/refresh`, {
        refresh_token: refreshToken,
        device_id: deviceId,
      }, {
        headers: { Accept: 'application/json' },
        timeout: TIMEOUT_MS,
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

export const apiClient: AxiosInstance = axios.create({
  baseURL: resolveBaseURL(),
  timeout: TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (isPublicAuthRequest(config.url)) {
    return config;
  }

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
