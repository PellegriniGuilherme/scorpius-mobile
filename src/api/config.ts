import Constants from 'expo-constants';

const DEFAULT_BASE_URL = 'http://localhost:8000/api/v1';

export function resolveBaseURL(): string {
  const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  const fromEnv =
    typeof process !== 'undefined'
      ? (process.env.EXPO_PUBLIC_API_URL as string | undefined)
      : undefined;
  const resolved = fromExtra ?? fromEnv ?? DEFAULT_BASE_URL;
  return resolved.replace(/\/$/, '');
}

export function getApiBaseUrl(): string {
  return resolveBaseURL();
}
