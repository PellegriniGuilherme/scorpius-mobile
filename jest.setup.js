// Setup global para jest no Scorpius Move (T068.2).
//
// Mocks necessários para rodar testes sem dependências nativas:
// - expo-secure-store: persistência de token (nativo)
// - expo-constants: extra.apiUrl (resolve em runtime)
// - @react-navigation/native: useNavigation/useRoute (precisa mock para testes)
//
// @testing-library/react-native setup é automático (peerDep de jest-expo).

import type { ReactNode } from 'react';

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
// Mock leve: tests específicos podem fazer jest.mock
// pontual para customizar retornos. Default abaixo é seguro.
jest.mock('@react-navigation/native', () => ({
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
  NavigationContainer: ({ children }: { children: ReactNode }) => children,
}));

// --- react-native: Animated helper ---
// react-native Animated warning "Animated: useNativeDriver is not supported"
// aparece em alguns testes; silencia.
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}), { virtual: true });
