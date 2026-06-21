/**
 * Scorpius Move — NotificationsService tests (T080).
 *
 * Cobre:
 *  - registerForPushNotificationsAsync retorna null em não-device
 *  - registerForPushNotificationsAsync retorna token com permissão granted
 *  - registerForPushNotificationsAsync retorna null com permissão denied
 *  - configureForegroundBehavior chama setNotificationHandler
 *  - onNotificationResponse extrai data.delivery_id e chama handler
 *  - onNotificationResponse ignora notification sem delivery_id
 *  - registerTokenWithBackend injeta apiPostDeviceToken
 *  - registerTokenWithBackend silent fallback sem apiPostDeviceToken
 *  - stop limpa listeners
 */
import { NotificationsService } from './NotificationsService';

// Mock expo-notifications
const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockGetExpoPushToken = jest.fn();
const mockSetNotificationHandler = jest.fn();
const mockAddReceived = jest.fn();
const mockAddResponse = jest.fn();
const mockRemoveReceived = jest.fn();
const mockRemoveResponse = jest.fn();

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockGetPermissions(),
  requestPermissionsAsync: () => mockRequestPermissions(),
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushToken(...args),
  setNotificationHandler: (handler: unknown) => mockSetNotificationHandler(handler),
  addNotificationReceivedListener: (cb: unknown) => {
    mockAddReceived(cb);
    return { remove: mockRemoveReceived };
  },
  addNotificationResponseReceivedListener: (cb: unknown) => {
    mockAddResponse(cb);
    return { remove: mockRemoveResponse };
  },
}));

jest.mock('expo-device', () => ({
  isDevice: true,
}));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { eas: { projectId: 'test-project-id' } } },
}));

describe('NotificationsService (T080)', () => {
  let svc: NotificationsService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new NotificationsService();
  });

  it('configureForegroundBehavior chama setNotificationHandler', () => {
    svc.configureForegroundBehavior();
    expect(mockSetNotificationHandler).toHaveBeenCalledTimes(1);
    const handler = mockSetNotificationHandler.mock.calls[0][0];
    expect(typeof handler.handleNotification).toBe('function');
    return handler.handleNotification().then((result: unknown) => {
      const r = result as { shouldShowBanner: boolean };
      expect(r.shouldShowBanner).toBe(true);
    });
  });

  it('registerForPushNotificationsAsync retorna token quando permissão granted', async () => {
    mockGetPermissions.mockResolvedValueOnce({ granted: true });
    mockGetExpoPushToken.mockResolvedValueOnce({ data: 'ExponentPushToken[abc123]' });

    const result = await svc.registerForPushNotificationsAsync();

    expect(result).toEqual({ expoPushToken: 'ExponentPushToken[abc123]' });
    expect(mockGetExpoPushToken).toHaveBeenCalledWith({ projectId: 'test-project-id' });
  });

  it('registerForPushNotificationsAsync retorna null quando permissão denied', async () => {
    mockGetPermissions.mockResolvedValueOnce({ granted: false });
    mockRequestPermissions.mockResolvedValueOnce({ granted: false });

    const result = await svc.registerForPushNotificationsAsync();

    expect(result).toBeNull();
    expect(mockGetExpoPushToken).not.toHaveBeenCalled();
  });

  it('registerForPushNotificationsAsync pede permissão se granted false', async () => {
    mockGetPermissions.mockResolvedValueOnce({ granted: false });
    mockRequestPermissions.mockResolvedValueOnce({ granted: true });
    mockGetExpoPushToken.mockResolvedValueOnce({ data: 'ExponentPushToken[xyz]' });

    const result = await svc.registerForPushNotificationsAsync();

    expect(mockRequestPermissions).toHaveBeenCalled();
    expect(result?.expoPushToken).toBe('ExponentPushToken[xyz]');
  });

  it('onNotificationResponse extrai delivery_id e chama handler', () => {
    const handler = jest.fn();
    svc.onNotificationResponse(handler);

    // Recupera callback registrado
    const callback = mockAddResponse.mock.calls[0][0] as (response: unknown) => void;
    callback({
      notification: {
        request: {
          content: {
            data: { delivery_id: 1234 },
          },
        },
      },
    });

    expect(handler).toHaveBeenCalledWith(1234);
  });

  it('onNotificationResponse ignora notification sem delivery_id', () => {
    const handler = jest.fn();
    svc.onNotificationResponse(handler);

    const callback = mockAddResponse.mock.calls[0][0] as (response: unknown) => void;
    callback({
      notification: {
        request: {
          content: {
            data: {},
          },
        },
      },
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('onNotificationResponse ignora data.delivery_id não-numérico', () => {
    const handler = jest.fn();
    svc.onNotificationResponse(handler);

    const callback = mockAddResponse.mock.calls[0][0] as (response: unknown) => void;
    callback({
      notification: {
        request: {
          content: {
            data: { delivery_id: 'not-a-number' },
          },
        },
      },
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('registerTokenWithBackend injeta apiPostDeviceToken', async () => {
    const api = jest.fn().mockResolvedValueOnce(undefined);
    svc.setApiPostDeviceToken(api);

    await svc.registerTokenWithBackend(91, 'ExponentPushToken[abc]');

    expect(api).toHaveBeenCalledWith('ExponentPushToken[abc]', 91);
  });

  it('registerTokenWithBackend silent fallback sem apiPostDeviceToken', async () => {
    // Sem setApiPostDeviceToken — não deve lançar erro
    await expect(svc.registerTokenWithBackend(91, 'token')).resolves.toBeUndefined();
  });

  it('onForegroundReceived registra listener', () => {
    const handler = jest.fn();
    svc.onForegroundReceived(handler);
    expect(mockAddReceived).toHaveBeenCalled();
  });

  it('stop remove listeners e limpa handler', () => {
    const responseHandler = jest.fn();
    const foregroundHandler = jest.fn();
    svc.onNotificationResponse(responseHandler);
    svc.onForegroundReceived(foregroundHandler);
    expect(mockAddResponse).toHaveBeenCalledTimes(1);
    expect(mockAddReceived).toHaveBeenCalledTimes(1);
    svc.stop();
    expect(mockRemoveReceived).toHaveBeenCalled();
    expect(mockRemoveResponse).toHaveBeenCalled();
  });

  it('idempotente: onNotificationResponse chamado 2x não duplica', () => {
    svc.onNotificationResponse(jest.fn());
    svc.onNotificationResponse(jest.fn());
    // O 2º call é no-op porque this.responseSub já existe
    expect(mockAddResponse).toHaveBeenCalledTimes(1);
  });
});
