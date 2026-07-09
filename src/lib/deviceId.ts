import * as SecureStore from 'expo-secure-store';
import { SECURE_STORE_TIMEOUT_MS, withTimeout } from '@/lib/secureStoreTimeout';

const DEVICE_ID_KEY = 'scorpius:move:device_id';

let memoryDeviceId: string | null = null;
let hydrationStarted = false;

function persistDeviceId(id: string): void {
  void withTimeout(
    SecureStore.setItemAsync(DEVICE_ID_KEY, id),
    SECURE_STORE_TIMEOUT_MS,
    () => undefined,
  );
}

/**
 * Hidratação em background no boot — nunca bloqueia login/OTP.
 * SecureStore no Android preview pode travar a JS thread; por isso
 * getDeviceId() não awaita esta rotina.
 */
export function startDeviceIdHydration(): void {
  if (hydrationStarted) return;
  hydrationStarted = true;

  setTimeout(() => {
    void (async () => {
      try {
        const existing = await withTimeout(
          SecureStore.getItemAsync(DEVICE_ID_KEY),
          SECURE_STORE_TIMEOUT_MS,
          () => null,
        );
        if (existing && !memoryDeviceId) {
          memoryDeviceId = existing;
        }
      } catch {
        // memory-only fallback
      }
    })();
  }, 0);
}

/** Retorna imediatamente — sem SecureStore no caminho crítico do login. */
export function getDeviceId(): string {
  if (memoryDeviceId) return memoryDeviceId;

  const id = crypto.randomUUID();
  memoryDeviceId = id;
  persistDeviceId(id);
  return id;
}

/** Test-only helper */
export function resetDeviceIdCacheForTests(): void {
  memoryDeviceId = null;
  hydrationStarted = false;
}
