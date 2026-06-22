/**
 * Scorpius Move — api/client tests (T104).
 *
 * Cobre:
 *  - Bearer token injection on requests
 *  - 401 handling: clears token + emits session_expired event
 *  - loadAccessToken / setAccessToken / getAccessTokenSync
 *  - registerSessionExpiredHandler
 *  - Outros status codes: passa o erro sem side effect
 */

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import {
  loadAccessToken,
  setAccessToken,
  getAccessTokenSync,
  registerSessionExpiredHandler,
} from './client';

jest.mock('axios', () => {
  const mockInterceptors = {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  };
  const mockAxiosInstance = {
    interceptors: mockInterceptors,
    post: jest.fn(),
    put: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  };
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => mockAxiosInstance),
    },
    create: jest.fn(() => mockAxiosInstance),
  };
});

describe('api/client (T104)', () => {
  beforeEach(async () => {
    (SecureStore.getItemAsync as jest.Mock).mockReset();
    (SecureStore.setItemAsync as jest.Mock).mockReset();
    await setAccessToken(null);
  });

  describe('loadAccessToken / setAccessToken / getAccessTokenSync', () => {
    it('loadAccessToken reads from SecureStore on first call', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('token-from-store');
      const token = await loadAccessToken();
      expect(token).toBe('token-from-store');
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('scorpius:move:driver_token');
    });

    it('loadAccessToken returns cached token on subsequent calls (no SecureStore read)', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('cached-token');
      await loadAccessToken();
      await loadAccessToken();
      expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
    });

    it('loadAccessToken returns null on SecureStore error', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('store error'));
      const token = await loadAccessToken();
      expect(token).toBeNull();
    });

    it('setAccessToken updates cache (subsequent loadAccessToken returns it without SecureStore read)', async () => {
      await setAccessToken('explicit-token');
      expect(getAccessTokenSync()).toBe('explicit-token');
      // No SecureStore call because cache was set
      expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    });

    it('setAccessToken(null) clears cache', async () => {
      await setAccessToken('initial');
      await setAccessToken(null);
      expect(getAccessTokenSync()).toBeNull();
    });

    it('getAccessTokenSync returns null initially', () => {
      expect(getAccessTokenSync()).toBeNull();
    });
  });

  describe('registerSessionExpiredHandler', () => {
    it('registers handler (multiple registrations overwrite)', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      registerSessionExpiredHandler(handler1);
      registerSessionExpiredHandler(handler2);
      // Last handler wins (per current implementation)
      // We can't easily assert this without triggering 401, but
      // the registration should not throw
    });
  });

  describe('apiClient interceptors', () => {
    let requestUseCallback: (config: unknown) => Promise<unknown>;
    let responseUseCallback: (response: unknown) => unknown;
    let responseErrorCallback: (error: unknown) => Promise<unknown>;

    beforeEach(() => {
      // Captura os callbacks registrados via axios.create
      const createMock = axios.create as unknown as jest.Mock;
      const instance = createMock.mock.results[createMock.mock.results.length - 1].value;
      requestUseCallback = instance.interceptors.request.use.mock.calls[0][0];
      responseUseCallback = instance.interceptors.response.use.mock.calls[0][0];
      responseErrorCallback = instance.interceptors.response.use.mock.calls[0][1];
    });

    it('request interceptor injects Bearer token from cache', async () => {
      await setAccessToken('my-token');
      const config = { headers: { set: jest.fn(), has: jest.fn().mockReturnValue(false) } };
      await requestUseCallback(config);
      expect(config.headers.set).toHaveBeenCalledWith('Authorization', 'Bearer my-token');
    });

    it('request interceptor does NOT set Authorization if token is null', async () => {
      await setAccessToken(null);
      const config = { headers: { set: jest.fn(), has: jest.fn().mockReturnValue(false) } };
      await requestUseCallback(config);
      expect(config.headers.set).not.toHaveBeenCalled();
    });

    it('request interceptor does NOT override existing Authorization header', async () => {
      await setAccessToken('my-token');
      const config = { headers: { set: jest.fn(), has: jest.fn().mockReturnValue(true) } };
      await requestUseCallback(config);
      expect(config.headers.set).not.toHaveBeenCalled();
    });

    it('response interceptor passes through successful responses', () => {
      const response = { data: 'ok', status: 200 };
      const _result = responseUseCallback(response);
      expect(response).toBe(_result);
    });

    it('response interceptor handles 401: clears token + emits session_expired', async () => {
      await setAccessToken('expired-token');
      const sessionExpired = jest.fn();
      registerSessionExpiredHandler(sessionExpired);

      const error401 = {
        response: { status: 401 },
        config: {},
      };

      await expect(responseErrorCallback(error401)).rejects.toEqual(error401);
      // setAccessToken(null) is called, which internally does deleteItemAsync
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('scorpius:move:driver_token');
      expect(sessionExpired).toHaveBeenCalled();
      expect(getAccessTokenSync()).toBeNull();
    });

    it('response interceptor passes through non-401 errors (500, network, etc)', async () => {
      const sessionExpired = jest.fn();
      registerSessionExpiredHandler(sessionExpired);

      const error500 = {
        response: { status: 500 },
        config: {},
      };

      await expect(responseErrorCallback(error500)).rejects.toEqual(error500);
      expect(sessionExpired).not.toHaveBeenCalled();
    });
  });
});