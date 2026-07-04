import Constants from 'expo-constants';

/**
 * Push remoto via expo-notifications não funciona no Expo Go (Android SDK 53+).
 * Development/production builds continuam com push normalmente.
 */
export function isRemotePushAvailable(): boolean {
  return Constants.appOwnership !== 'expo';
}
