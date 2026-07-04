import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'scorpius:move:device_id';

export async function getDeviceId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
