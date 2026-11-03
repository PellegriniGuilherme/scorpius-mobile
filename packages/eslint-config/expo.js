import base from './base.js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        // Variáveis globais que o Expo SDK expõe em runtime.
        // Documentadas em https://docs.expo.dev/versions/latest/
      },
    },
    rules: {
      'no-undef': 'off', // TypeScript já cuida disso.
    },
  },
];
