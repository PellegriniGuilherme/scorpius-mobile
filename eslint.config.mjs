import { expo as expoConfig } from '@scorpius/eslint-config';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...expoConfig,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'babel.config.js', 'jest.config.js'],
  },
  {
    // Test setup + specs: expõe globals jest e node, desliga no-undef
    // (TypeScript já valida tipos).
    files: ['**/*.test.ts', '**/*.test.tsx', 'jest.setup.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
];
