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
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}), { virtual: true });

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
