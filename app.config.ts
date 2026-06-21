import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Scorpius Move — Expo config (typed, F2 Mobile Foundation).
 *
 * Decisões:
 *  - `scheme: scorpiusmove` para deep linking futuro
 *    (ex: `scorpiusmove://deliveries/123`)
 *  - `extra.apiUrl` é resolvido em runtime pelo `api/client.ts`
 *    via `Constants.expoConfig.extra.apiUrl`. Permite trocar o endpoint
 *    por build profile (development / preview / production) sem rebuild.
 *  - `newArchEnabled: true` (Fabric + TurboModules) — alinhado com
 *    Expo SDK 52 default.
 *  - Plugin `expo-secure-store` para persistência do token driver.
 *  - `experiments.typedRoutes: true` para type-safety de rotas
 *    (preparado para F2.10 com expo-router — não usado ainda).
 */
const config: ExpoConfig = {
  name: 'Scorpius Move',
  slug: 'scorpius-move',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'scorpiusmove',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    backgroundColor: '#0b1220',
    resizeMode: 'contain',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'local.scorpius.move',
    infoPlist: {
      LSApplicationQueriesSchemes: ['whatsapp'],
    },
  },
  android: {
    package: 'local.scorpius.move',
    adaptiveIcon: {
      backgroundColor: '#0b1220',
    },
    permissions: ['INTERNET', 'ACCESS_NETWORK_STATE'],
  },
  web: {
    bundler: 'metro',
  },
  plugins: ['expo-secure-store', 'expo-localization'],
  experiments: {
    typedRoutes: true,
  },
  // `extra` é injetado em runtime via Constants.expoConfig.extra.
  // eas.json (per-profile) sobrescreve apiUrl no build nativo.
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1',
  },
};

export default (_config: ConfigContext): ExpoConfig => config;
