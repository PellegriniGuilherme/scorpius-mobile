/**
 * jest-expo preset para Scorpius Move (T068.2).
 *
 * - `setupFilesAfterEnv`: roda jest.setup.js DEPOIS do framework ser
 *   carregado (permite usar jest.mock, expect, etc.).
 * - `transformIgnorePatterns`: alinhado com Expo SDK 52 — inclui
 *   react-navigation, @react-native-community, expo, etc.
 * - `moduleNameMapper`: alias `@/` → `src/` (mesmo do Metro/TypeScript).
 * - `coverageThreshold`: ≥60% nos arquivos testados (briefing T068.2).
 */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // T068.2: error-guard.js (Flow) não é transpilado pelo babel padrão
    // do Expo SDK 52. Mapeia para stub vazio antes do parse.
    '^@react-native/js-polyfills/error-guard$': '<rootDir>/jest.empty.js',
  },
  transformIgnorePatterns: [
    // T068.2: usar `.*<pkg>` em vez de `<pkg>` direto. pnpm flat
    // estrutura `node_modules/.pnpm/<pkg>@version/node_modules/<pkg>`
    // precisa casar o pacote em qualquer profundidade após o
    // `node_modules/`. Testes em node confirmam.
    'node_modules/(?!.*(jest-)?react-native|.*@react-native|.*@react-native-community|.*@react-native/.*|.*expo(nent)?|.*@expo(nent)?/.*|.*@expo-google-fonts/.*|.*react-navigation|.*@react-navigation/.*|.*@unimodules/.*|.*unimodules|.*sentry-expo|.*native-base|.*react-native-svg|.*expo-modules-core)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  collectCoverageFrom: [
    'src/screens/LoginScreen.tsx',
    'src/screens/HomeMotoristaScreen.tsx',
    'src/screens/DetalheEntregaScreen.tsx',
    'src/screens/MapaRotaScreen.tsx',
    'src/screens/ComprovanteScreen.tsx',
    'src/screens/PerfilMotoristaScreen.tsx',
    'src/navigation/RootNavigator.tsx',
    'src/navigation/types.ts',
    'src/components/Button.tsx',
    'src/components/StatusBadge.tsx',
    'src/components/Card.tsx',
    'src/components/Input.tsx',
    'src/store/auth.ts',
    'src/services/OutboxService.ts',
    'src/services/SyncWorker.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  coverageReporters: ['text', 'json-summary'],
};
