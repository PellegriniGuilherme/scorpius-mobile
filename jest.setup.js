// Setup global para jest no Move App.
// Mock mínimo para expo-secure-store e expo-constants — evita
// dependência de módulos nativos em testes.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: { apiUrl: 'http://localhost:8000/api/v1' } },
}));
