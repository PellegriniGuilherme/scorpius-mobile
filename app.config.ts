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
    package: 'local.scorpius.move',
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
  // T080: eas.projectId para NotificationsService.getExpoPushTokenAsync.
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1',
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? '',
    },
    googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  },
};

export default (_config: ConfigContext): ExpoConfig => config;
