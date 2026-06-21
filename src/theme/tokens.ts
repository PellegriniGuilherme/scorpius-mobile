/**
 * Scorpius Move — Design tokens (F2.6 / ADR-0005/0006/0007 parity).
 *
 * Mirror do `apps/scorpius-hub/src/styles/tokens.css` (Hub) para uso
 * em React Native. O Hub usa CSS variables em web; aqui expomos
 * constantes JS consumidas via `StyleSheet.create`.
 *
 * Nomes alinhados 1:1 com o Hub para que a equipe de design mantenha
 * UMA fonte de verdade conceitual (valores podem divergir em unidades,
 * mas semântica e nomes batem).
 *
 * Status: F2 Mobile Foundation (T068-NX). Apenas tokens semânticos
 * (sem light/dark ainda — virá em T056.6 mobile polish).
 */

export const tokens = {
  // ---- Spacing (4px base scale) ----
  space: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
    20: 80,
  },
  // ---- Radius ----
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  // ---- Typography ----
  font: {
    sans: 'System', // SF Pro iOS / Roboto Android; DS v2 não customiza
    mono: 'Menlo', // iOS; 'monospace' no Android
  },
  text: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  // ---- Motion (mirror Hub) ----
  motion: {
    durationFast: 150,
    durationBase: 220,
    durationSlow: 320,
  },
} as const;

export type Tokens = typeof tokens;
export type SpaceToken = keyof Tokens['space'];
export type RadiusToken = keyof Tokens['radius'];
export type TextToken = keyof Tokens['text'];
