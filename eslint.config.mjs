import { expo as expoConfig } from '@scorpius/eslint-config';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...expoConfig,
  {
    ignores: ['node_modules/**', '.expo/**', 'dist/**', 'babel.config.js', 'jest.config.js'],
  },
];
