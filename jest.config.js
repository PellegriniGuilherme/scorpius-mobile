/**
 * jest-expo preset para Scorpius Move.
 *
 * Configuração mínima para F2 Mobile Foundation. Cobertura real
 * (cobertura, threshold) virá em T068.2.
 */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEach: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg))',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
};
