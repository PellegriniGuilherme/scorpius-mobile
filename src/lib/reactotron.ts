/**
 * Scorpius Move — Reactotron (dev-only).
 *
 * Conecta o app ao Reactotron Desktop para logs, timeline de rede e
 * inspeção de estado. Carregado apenas em __DEV__ via entry.js.
 *
 * Expo SDK 56: networking do Reactotron depende de XHR-backed fetch.
 * Defina EXPO_PUBLIC_USE_RN_FETCH=1 no .env para capturar fetch nativo.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Reactotron from 'reactotron-react-native';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '@/api/client';

function resolveHost(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    return hostUri.split(':')[0] ?? 'localhost';
  }
  if (Platform.OS === 'android') {
    return '10.0.2.2';
  }
  return 'localhost';
}

function maskAuthHeader(headers: InternalAxiosRequestConfig['headers']): unknown {
  if (!headers) return headers;
  if (typeof headers.get === 'function' && typeof headers.set === 'function') {
    const auth = headers.get('Authorization');
    if (typeof auth !== 'string') return { authorization: auth ?? undefined };
    const preview = auth.length > 20 ? `${auth.slice(0, 16)}…` : auth;
    return { authorization: preview };
  }
  const record = headers as Record<string, string | undefined>;
  const auth = record.Authorization ?? record.authorization;
  if (!auth) return record;
  const preview = auth.length > 20 ? `${auth.slice(0, 16)}…` : auth;
  return { ...record, Authorization: preview };
}

const reactotron = Reactotron.configure({
  name: 'Scorpius Move',
  host: resolveHost(),
})
  .useReactNative({
    networking: {
      ignoreUrls: /symbolicate|logs\.reactotron|127\.0\.0\.1/,
    },
  })
  .connect();

apiClient.interceptors.request.use((config) => {
  reactotron.display({
    name: 'API →',
    preview: `${config.method?.toUpperCase() ?? 'GET'} ${config.baseURL ?? ''}${config.url ?? ''}`,
    value: {
      params: config.params,
      data: config.data,
      headers: maskAuthHeader(config.headers),
    },
  });
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    reactotron.display({
      name: 'API ←',
      preview: `${response.status} ${response.config.url ?? ''}`,
      value: response.data,
    });
    return response;
  },
  (error: AxiosError) => {
    reactotron.display({
      name: 'API ✗',
      preview: `${error.response?.status ?? 'ERR'} ${error.config?.url ?? ''}`,
      value: error.response?.data ?? error.message,
    });
    return Promise.reject(error);
  },
);

const originalLog = console.log.bind(console);
console.log = (...args: unknown[]) => {
  originalLog(...args);
  reactotron.log?.(...args);
};

declare global {
  interface Console {
    tron: typeof reactotron;
  }
}

console.tron = reactotron;

reactotron.log?.('Reactotron conectado', { host: resolveHost() });

export default reactotron;
