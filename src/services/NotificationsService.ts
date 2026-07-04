/**
 * Scorpius Move — NotificationsService.
 *
 * T080 — Expo Push + deep linking para DetalheEntregaScreen.
 *
 * Decisão Guilherme 12:06: Push via Expo Push (NÃO polling HTTP,
 * NÃO Reverb). Backend endpoint /api/v1/driver/device-tokens (T072
 * merged) já existe.
 *
 * Flow:
 * 1. App boot: registerForPushNotificationsAsync() → ExpoPushToken
 * 2. Login success: POST /api/v1/driver/device-tokens (token + driver_id)
 * 3. Foreground: addNotificationReceivedListener (mostra in-app)
 * 4. Background tap: addNotificationResponseReceivedListener
 *    → deep linking via data.delivery_id → DetalheEntregaScreen
 *
 * Decisões:
 *  - Singleton: app inteiro compartilha subscription. Re-registrar
 *    pode causar duplicação.
 *  - Não chama registerTaskAsync (background fetch). Guilherme não
 *    pediu push offline-mode.
 *  - setNotificationHandler mostra notification mesmo em foreground
 *    (UX: motorista vê entrega nova mesmo com app aberto).
 *  - Deep linking via Linking.openURL ou NavigationContainer ref.
 *    Aqui expõe onNotificationResponse (callback) e o app registra
 *    o ref para fazer navigate.
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

export interface PushRegistration {
  expoPushToken: string;
  devicePushToken?: string;
}

export type DeepLinkHandler = (deliveryId: number) => void;

export class NotificationsService {
  private foregroundSub: { remove: () => void } | null = null;
  private responseSub: { remove: () => void } | null = null;
  private deepLinkHandler: DeepLinkHandler | null = null;
  private apiPostDeviceToken: ((token: string, driverId: number) => Promise<void>) | null = null;
  private lastRegisteredToken: string | null = null;

  /**
   * T091 R3: silent failure guard. Em production, se EAS project ID
   * estiver ausente ou malformado, emite console.warn para
   * visibilidade. Antes disso `getExpoPushTokenAsync` falharia
   * silenciosamente com erro genérico.
   */
  private warnIfInvalidEasProjectId(): void {
    if (__DEV__) return;
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    // UUID v4 tem formato 8-4-4-4-12 hex
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!projectId || projectId === '' || !UUID_REGEX.test(projectId)) {
      console.warn(
        `[NotificationsService] EXPO_PUBLIC_EAS_PROJECT_ID ausente ou inválido em production: ${JSON.stringify(projectId)}. ` +
        'getExpoPushTokenAsync vai falhar. Definir UUID válido em .env e rebuild.',
      );
    }
  }

  /**
   * Configura handler global: mostra notificação mesmo em foreground.
   */
  configureForegroundBehavior(): void {
    this.warnIfInvalidEasProjectId();
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        // Mostra a notificação mesmo se o app está em foreground
        // (UX: motorista vê entrega nova imediatamente)
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }

  /**
   * Registra push token. Pede permissão, valida que é device real
   * (não emulador), e retorna Expo push token + opcionalmente APNs/FCM
   * device token.
   */
  async registerForPushNotificationsAsync(): Promise<PushRegistration | null> {
    // Não funciona em emulador/web — fail silently
    if (!Device.isDevice) {
      return null;
    }

    // Verifica/pede permissão
    // Cast as any: expo-notifications 56 importa PermissionResponse de
    // 'expo' mas o type atual está vazio. Runtime funciona corretamente.
    const existing = (await Notifications.getPermissionsAsync()) as unknown as { granted: boolean };
    if (!existing.granted) {
      const requested = (await Notifications.requestPermissionsAsync()) as unknown as { granted: boolean };
      if (!requested.granted) {
        return null;
      }
    }

    // Expo push token (proxy que entrega via APNs/FCM)
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    const expoToken = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    return {
      expoPushToken: expoToken.data,
    };
  }

  /**
   * Registra listener de foreground (notification recebida com app aberto).
   */
  onForegroundReceived(handler: (notification: Notifications.Notification) => void): void {
    if (this.foregroundSub) return;
    this.foregroundSub = Notifications.addNotificationReceivedListener(handler);
  }

  /**
   * Registra listener de tap (usuário tocou na notification).
   * Extrai data.delivery_id e chama deepLinkHandler.
   */
  onNotificationResponse(handler: DeepLinkHandler): void {
    if (this.responseSub) return;
    this.deepLinkHandler = handler;
    this.responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      const deliveryId = typeof data?.delivery_id === 'number' ? data.delivery_id : null;
      if (deliveryId !== null && this.deepLinkHandler) {
        this.deepLinkHandler(deliveryId);
      }
    });
  }

  /**
   * Injeta função de POST para /api/v1/driver/device-tokens.
   * Default: noop (assume que o app injeta em boot).
   */
  setApiPostDeviceToken(fn: (token: string, driverId: number) => Promise<void>): void {
    this.apiPostDeviceToken = fn;
  }

  /**
   * Registra o push token no backend para o driver atual.
   * Chamado após login/refresh.
   */
  async registerTokenWithBackend(driverId: number, expoPushToken: string): Promise<void> {
    if (!this.apiPostDeviceToken) {
      // Sem API: silent fallback. App deve setar setApiPostDeviceToken
      // em boot para persistir no backend.
      return;
    }
    await this.apiPostDeviceToken(expoPushToken, driverId);
    this.lastRegisteredToken = expoPushToken;
  }

  getLastRegisteredToken(): string | null {
    return this.lastRegisteredToken;
  }

  /**
   * Limpa listeners. Chamar em cleanup / sign-out.
   */
  stop(): void {
    if (this.foregroundSub) {
      this.foregroundSub.remove();
      this.foregroundSub = null;
    }
    if (this.responseSub) {
      this.responseSub.remove();
      this.responseSub = null;
    }
    this.deepLinkHandler = null;
    this.lastRegisteredToken = null;
  }
}

// Singleton instance para uso em produção.
export const notifications = new NotificationsService();
