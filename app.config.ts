import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Scorpius Move — Expo config.
 *
 * Google Maps keys come from process.env (never commit real keys).
 * Without keys, MapView falls back to a placeholder + external deep link.
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
    backgroundColor: '#0f172a',
    resizeMode: 'contain',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'local.scorpius.move',
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS
        ?? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        ?? '',
    },
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Mostra sua localização atual no mapa durante a entrega.',
    },
  },
  android: {
    package: 'local.scorpius.move',
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID
          ?? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
          ?? '',
      },
    },
    adaptiveIcon: {
      backgroundColor: '#0f172a',
    },
    permissions: [
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
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Mostra sua localização atual no mapa durante a entrega.',
      },
    ],
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1',
    googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
    eas: {
      projectId: '4c02a514-a933-4599-9625-5152b1b05ab5',
    },
  },
  owner: 'guipellegrini',
};

export default (_ctx: ConfigContext): ExpoConfig => config;
