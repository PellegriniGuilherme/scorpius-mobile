/**
 * Scorpius Move — API client.
 *
 * Cliente axios com interceptors para:
 * - Bearer token (lê do secure store via getAccessToken)
 * - 401: limpa sessão + emite evento para o store redirecionar ao login
 * - 5xx: log silencioso
 *
 * Mirror parcial do `apps/scorpius-hub/src/api/client.ts`, com adaptações
 * para o contexto mobile (sem Sanctum cookies, sem CSRF — o backend
 * usa driver tokens opacos emitidos via OTP).
 */
import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const DEFAULT_BASE_URL = 'http://localhost:8000/api/v1';
const TIMEOUT_MS = 30_000;
const SECURE_STORE_TOKEN_KEY = 'scorpius:move:driver_token';

// ---------------------------------------------------------------------------
// Base URL resolution
// ---------------------------------------------------------------------------

function resolveBaseURL(): string {
  // 1. Env var injetada via app.config.ts (extra.apiUrl)
  const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  if (fromExtra) return fromExtra;
  // 2. Default dev local
  return DEFAULT_BASE_URL;
}

// ---------------------------------------------------------------------------
// Token store
// ---------------------------------------------------------------------------

let cachedToken: string | null = null;

export async function loadAccessToken(): Promise<string | null> {
  if (cachedToken !== null) return cachedToken;
  try {
    cachedToken = await SecureStore.getItemAsync(SECURE_STORE_TOKEN_KEY);
    return cachedToken;
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
    // SecureStore indisponível (apenas em emuladores quebrados) — segue
    // com o cache em memória; a sessão não persiste entre restarts.
  }
}

export function getAccessTokenSync(): string | null {
  return cachedToken;
}

// ---------------------------------------------------------------------------
// Session-expired event
// ---------------------------------------------------------------------------

type SessionExpiredHandler = () => void;
let sessionExpiredHandler: SessionExpiredHandler | null = null;

/**
 * Registra handler que será invocado quando o backend retornar 401
 * (token expirado/inválido). O `authStore` registra este handler no
 * boot para disparar `clearSession` e o navigation pode reagir.
 */
export function registerSessionExpiredHandler(fn: SessionExpiredHandler): void {
  sessionExpiredHandler = fn;
}

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

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
    if (error.response?.status === 401) {
      // Token inválido/expirado — limpa e notifica o store.
      await setAccessToken(null);
      sessionExpiredHandler?.();
    }
    return Promise.reject(error);
  },
);
