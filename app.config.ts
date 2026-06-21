import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Scorpius Move — Expo config (typed, F2 Mobile Foundation).
 *
 * Decisões:
 *  - `scheme: scorpiusmove` para deep linking (ex: `scorpiusmove://deliveries/123`)
 *  - `extra.apiUrl` é resolvido em runtime pelo `api/client.ts`
 *    via `Constants.expoConfig.extra.apiUrl`. Permite trocar o endpoint
 *    por build profile (development / preview / production) sem rebuild.
 *  - `newArchEnabled: true` (Fabric + TurboModules) — alinhado com
 *    Expo SDK 52 default.
 *  - Plugin `expo-secure-store` para persistência do token driver.
 *  - `experiments.typedRoutes: true` para type-safety de rotas.
 *  - T080: lê API keys de `process.env` (definidos em `.env`).
 *    `.env` é gitignored — chaves reais NÃO vão para o repo.
 *  - T082: EAS project ID fixo criado em 2026-06-21 (`eas init`).
 *    Bundle IDs internacional `com.scorpius.move` (decisão Guilherme 12:26).
 *    Google Maps config iOS/Android com chaves separadas.
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
    // T082: bundle id internacional (decisão Guilherme 12:26)
    bundleIdentifier: 'com.scorpius.move',
    // T082: Google Maps API key iOS nativo (mesma do mdt-expo — reaproveitada)
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS ?? '',
    },
    infoPlist: {
      LSApplicationQueriesSchemes: ['whatsapp'],
      // T080: Push notifications + Location (Google Maps nearby)
      NSUserNotificationsUsageDescription:
        'Receba notificações de novas entregas e atualizações de status.',
      NSLocationWhenInUseUsageDescription:
        'Mostra sua localização atual no mapa durante a entrega.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Permite rastreamento da entrega em background.',
    },
  },
  android: {
    // T082: bundle id internacional (decisão Guilherme 12:26)
    package: 'com.scorpius.move',
    // T082: Google Maps API key Android nativo
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID ?? '',
      },
    },
    adaptiveIcon: {
      backgroundColor: '#0b1220',
    },
    permissions: [
      'INTERNET',
      'ACCESS_NETWORK_STATE',
      // T080: Push + Location
      'POST_NOTIFICATIONS',
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
    ],
  },
  web: {
    bundler: 'metro',
  },
  plugins: [
    'expo-secure-store',
    'expo-localization',
    // T080: expo-notifications com icon e color
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#0b1220',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  // `extra` é injetado em runtime via Constants.expoConfig.extra.
  // eas.json (per-profile) sobrescreve apiUrl no build nativo.
  // T082: EAS project ID fixo criado via `eas init` em 2026-06-21.
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1',
    eas: {
      // T082: project ID fixo (gerado por `eas init` em 2026-06-21).
      // O fallback em .env permite override local; em produção o ID é o fixo.
      projectId: '4c02a514-a933-4599-9625-5152b1b05ab5',
    },
    googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  },
};

export default (_config: ConfigContext): ExpoConfig => config;
