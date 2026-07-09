import * as SecureStore from 'expo-secure-store';
import { SECURE_STORE_TIMEOUT_MS, withTimeout } from '@/lib/secureStoreTimeout';

const DEVICE_ID_KEY = 'scorpius.move.device_id';

let memoryDeviceId: string | null = null;
let hydrationStarted = false;

/** UUID v4 sem depender de `crypto.randomUUID()` (pode travar no Hermes/Android). */
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

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

  const id = generateUuid();
  memoryDeviceId = id;
  persistDeviceId(id);
  return id;
}

/** Test-only helper */
export function resetDeviceIdCacheForTests(): void {
  memoryDeviceId = null;
  hydrationStarted = false;
}
