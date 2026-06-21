import { expo as expoConfig } from '@scorpius/eslint-config';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...expoConfig,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'babel.config.js', 'jest.config.js', 'metro.config.js'],
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'jest.setup.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
  },
];
