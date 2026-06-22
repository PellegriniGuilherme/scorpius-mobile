// Setup global para jest no Scorpius Move (T068.2).
//
// Mocks necessários para rodar testes sem dependências nativas:
// - expo-secure-store: persistência de token (nativo)
// - expo-constants: extra.apiUrl (resolve em runtime)
// - @react-navigation/native: useNavigation/useRoute (precisa mock para testes)
// - react-native-screens + native-stack: dependem de Fabric/codegen
//   (nativo) que não funciona no jest. Mock JS puro.
//
// @testing-library/react-native setup é automático (peerDep de jest-expo).

import { createElement, Fragment, type ReactNode } from 'react';

// --- expo-secure-store ---
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// --- expo-constants ---
jest.mock('expo-constants', () => ({
  expoConfig: { extra: { apiUrl: 'http://localhost:8000/api/v1' } },
}));

// --- @react-navigation/native ---
// Mock leve: tests específicos podem fazer jest.mock pontual.
// Re-exporta DefaultTheme/DarkTheme do módulo real.
jest.mock('@react-navigation/native', () => {
  const mockReal = jest.requireActual('@react-navigation/native');
  return {
    ...mockReal,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      reset: jest.fn(),
      setParams: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
      key: 'test-route',
      name: 'Test',
    }),
    NavigationContainer: ({ children }) => children,
  };
});

// --- react-native: Animated helper ---
// T115 SDK 56 + RN 0.85: caminho Libraries/Animated/ mudou para
// Libraries/NativeAnimation/. jest-expo@56 já trata Animated via
// setup próprio. Removido mock manual.

// --- react-native-screens + native-stack ---
// react-native-screens depende de Fabric/codegenNativeComponent que
// não funciona no jest. Mock do módulo para um stub JS puro.
const PassthroughView = ({ children }: { children?: ReactNode }) =>
  createElement(Fragment, null, children);
const PassthroughNavigator = (props) => createElement(Fragment, null, props.children);
const PassthroughScreen = (props) => createElement(props.component, null);

jest.mock('react-native-screens', () => ({
  enableScreens: () => {},
  enableFreeze: () => {},
  Screen: PassthroughView,
  ScreenContainer: PassthroughView,
  ScreenStack: PassthroughView,
  ScreenStackHeaderConfig: PassthroughView,
  ScreenStackHeaderRightView: PassthroughView,
  ScreenStackHeaderLeftView: PassthroughView,
  ScreenStackHeaderCenterView: PassthroughView,
  ScreenStackHeaderBackButtonImage: PassthroughView,
  screensEnabled: () => true,
  isNewBackTitleImplementation: false,
}));

// --- @react-navigation/native-stack ---
// native-stack chama createScreenFactory de r-n-s que precisa Fabric.
// Mock retorna Navigator JS puro (sem telas nativas).
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: PassthroughNavigator,
    Screen: PassthroughScreen,
    Group: PassthroughNavigator,
  }),
}));

// --- Mocks de libs nativas (T068.3) ---
// Estas libs não são importadas nos testes atuais, mas mocks preventivos
// cobrem o que F2.10 (outbox foto + push) e outbox sync vão usar. Manter
// antes de precisarmos evita gambiarras depois.

// react-native-maps: MapView, Marker, Polyline, etc. Stub como View com
// testID para asserts em testes futuros. Variável prefixada com `mock`
// para passar a regra do jest.mock (out-of-scope). `virtual: true` para
// módulos não instalados (F2.10 vai adicionar como dep).
const mockReact = jest.requireActual('react');
const mockReactCreateElement = mockReact.createElement;

jest.mock(
  'react-native-maps',
  () => ({
    __esModule: true,
    default: (props: { testID?: string; children?: unknown }) =>
      mockReactCreateElement('MapView', { testID: props.testID ?? 'map' }, props.children),
    MapView: (props: { testID?: string; children?: unknown }) =>
      mockReactCreateElement('MapView', { testID: props.testID ?? 'map' }, props.children),
    Marker: (props: { testID?: string }) =>
      mockReactCreateElement('Marker', { testID: props.testID ?? 'marker' }),
    Polyline: (props: { testID?: string }) =>
      mockReactCreateElement('Polyline', { testID: props.testID ?? 'polyline' }),
    PROVIDER_GOOGLE: 'google',
  }),
  { virtual: true }
);

// expo-camera: CameraView stub + métodos de permission.
jest.mock(
  'expo-camera',
  () => ({
    CameraView: (props: { testID?: string; children?: unknown }) =>
      mockReactCreateElement('CameraView', { testID: props.testID ?? 'camera-view' }, props.children),
    useCameraPermissions: () => [{ granted: true }, jest.fn()],
    requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  }),
  { virtual: true }
);

// expo-image-picker: launchCameraAsync/launchImageLibraryAsync (T068.5 — instalado)
// Default: cancelado. Tests podem override via jest.spyOn.
jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
  MediaTypeOptions: { Images: 'Images' },
}));

// expo-haptics: no-op para testes.
jest.mock(
  'expo-haptics',
  () => ({
    impactAsync: jest.fn().mockResolvedValue(undefined),
    notificationAsync: jest.fn().mockResolvedValue(undefined),
    selectionAsync: jest.fn().mockResolvedValue(undefined),
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  }),
  { virtual: true }
);

// expo-location: requestForegroundPermissionsAsync mock.
jest.mock(
  'expo-location',
  () => ({
    requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, status: 'granted' }),
    getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: -23.5613, longitude: -46.6565 } }),
    Accuracy: { High: 'high' },
  }),
  { virtual: true }
);

// expo-linking: openURL mock (com spy).
jest.mock(
  'expo-linking',
  () => ({
    openURL: jest.fn().mockResolvedValue(true),
    canOpenURL: jest.fn().mockResolvedValue(true),
    createURL: jest.fn((path: string) => `scorpiusmove://${path}`),
  }),
  { virtual: true }
);

// --- expo-sqlite: mock in-memory (T068.5 — instalado).
// Implementa subset da API: openDatabaseAsync, execAsync, prepareAsync,
// statement.executeAsync / finalizeAsync / getAllAsync.
import * as mockSqlite from './jest.sqlite-mock.js';
jest.mock('expo-sqlite', () => mockSqlite);

// --- expo-file-system: mock minimalista (T068.5 — instalado).
// T115 SDK 56: API reverteu para class API (Paths / File / Directory).
// Mock alinhado com SDK 56 — helpers top-level removidos.
jest.mock('expo-file-system', () => ({
  Paths: {
    cache: { uri: 'file:///cache/' },
    document: { uri: 'file:///document/' },
    bundle: { uri: 'file:///bundle/' },
  },
  File: jest.fn().mockImplementation((..._args: unknown[]) => ({
    uri: 'file:///cache/mock.jpg',
    text: jest.fn().mockResolvedValue(''),
    write: jest.fn().mockResolvedValue(undefined),
    copy: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    exists: true,
  })),
  Directory: jest.fn().mockImplementation((..._args: unknown[]) => ({
    uri: 'file:///cache/proofs/',
    create: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(undefined),
  })),
}));

// --- @react-native-community/netinfo: mock (T068.5 — instalado).
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn().mockResolvedValue({ isConnected: true }),
    addEventListener: jest.fn().mockReturnValue(() => undefined),
  },
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
  addEventListener: jest.fn().mockReturnValue(() => undefined),
}));
