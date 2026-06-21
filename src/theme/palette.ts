/**
 * Scorpius Move — Theme palette (F2.6 parity).
 *
 * Paleta light/dark alinhada com os tokens semânticos do Hub. Aplica-se
 * via `ThemeProvider` (React Context) para que componentes consumam
 * `useTheme().colors.primary` em vez de cores diretas.
 *
 * Regra F2.8: zero cor direta fora deste arquivo (mirror do
 * `check-no-direct-colors.mjs` do Hub — futuramente podemos portar
 * a verificação para o Move App).
 */

export interface ThemeColors {
  // Brand / accent
  accent: string;
  accentMuted: string;
  accentSurface: string;
  accentBorder: string;
  // Surfaces
  surfacePanel: string;
  surfaceInset: string;
  surfaceElevated: string;
  // Borders
  borderDefault: string;
  borderStrong: string;
  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textSubtle: string;
  textInverse: string;
  textOnAccent: string;
  // Status
  statusInfoSurface: string;
  statusInfoBorder: string;
  statusInfoText: string;
  statusInfoMarker: string;
  statusSuccessSurface: string;
  statusSuccessBorder: string;
  statusSuccessText: string;
  statusSuccessMarker: string;
  statusWarningSurface: string;
  statusWarningBorder: string;
  statusWarningText: string;
  statusWarningMarker: string;
  statusDangerSurface: string;
  statusDangerBorder: string;
  statusDangerText: string;
  statusDangerMarker: string;
  statusNeutralSurface: string;
  statusNeutralBorder: string;
  statusNeutralText: string;
  statusNeutralMarker: string;
  // Focus
  focusRing: string;
  // Background
  background: string;
}

export const darkPalette: ThemeColors = {
  // Brand / accent (laranja Scorpius)
  accent: '#f97316',
  accentMuted: '#fed7aa',
  accentSurface: '#431407',
  accentBorder: '#9a3412',
  // Surfaces
  surfacePanel: '#1e293b',
  surfaceInset: '#0f172a',
  surfaceElevated: '#334155',
  // Borders
  borderDefault: '#334155',
  borderStrong: '#475569',
  // Text
  textPrimary: '#f8fafc',
  textSecondary: '#e2e8f0',
  textMuted: '#94a3b8',
  textSubtle: '#94a3b8',
  textInverse: '#0f172a',
  textOnAccent: '#111827',
  // Status (info, success, warning, danger, neutral)
  statusInfoSurface: '#172554',
  statusInfoBorder: '#2563eb',
  statusInfoText: '#bfdbfe',
  statusInfoMarker: '#60a5fa',
  statusSuccessSurface: '#052e16',
  statusSuccessBorder: '#16a34a',
  statusSuccessText: '#bbf7d0',
  statusSuccessMarker: '#4ade80',
  statusWarningSurface: '#451a03',
  statusWarningBorder: '#d97706',
  statusWarningText: '#fde68a',
  statusWarningMarker: '#facc15',
  statusDangerSurface: '#450a0a',
  statusDangerBorder: '#dc2626',
  statusDangerText: '#fecaca',
  statusDangerMarker: '#f87171',
  statusNeutralSurface: '#1e293b',
  statusNeutralBorder: '#64748b',
  statusNeutralText: '#cbd5e1',
  statusNeutralMarker: '#94a3b8',
  // Focus
  focusRing: '#fb923c',
  // Background
  background: '#0b1220',
};

export const lightPalette: ThemeColors = {
  accent: '#f97316',
  accentMuted: '#ffedd5',
  accentSurface: '#fff7ed',
  accentBorder: '#fdba74',
  surfacePanel: '#ffffff',
  surfaceInset: '#f1f5f9',
  surfaceElevated: '#f8fafc',
  borderDefault: '#e2e8f0',
  borderStrong: '#cbd5e1',
  textPrimary: '#0b1220',
  textSecondary: '#1e293b',
  textMuted: '#334155',
  textSubtle: '#475569',
  textInverse: '#f8fafc',
  textOnAccent: '#ffffff',
  statusInfoSurface: '#dbeafe',
  statusInfoBorder: '#3b82f6',
  statusInfoText: '#1e3a8a',
  statusInfoMarker: '#2563eb',
  statusSuccessSurface: '#dcfce7',
  statusSuccessBorder: '#22c55e',
  statusSuccessText: '#14532d',
  statusSuccessMarker: '#16a34a',
  statusWarningSurface: '#fef3c7',
  statusWarningBorder: '#f59e0b',
  statusWarningText: '#78350f',
  statusWarningMarker: '#d97706',
  statusDangerSurface: '#fee2e2',
  statusDangerBorder: '#ef4444',
  statusDangerText: '#7f1d1d',
  statusDangerMarker: '#dc2626',
  statusNeutralSurface: '#f1f5f9',
  statusNeutralBorder: '#94a3b8',
  statusNeutralText: '#334155',
  statusNeutralMarker: '#64748b',
  focusRing: '#f97316',
  background: '#f8fafc',
};

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Theme {
  mode: 'light' | 'dark';
  colors: ThemeColors;
}
