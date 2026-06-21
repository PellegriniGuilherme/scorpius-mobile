/**
 * ThemeProvider — fornece o tema (light/dark + tokens) via React Context.
 *
 * API:
 *   const { colors, mode, setMode } = useTheme();
 *
 * O modo `system` espelha `Appearance.getColorScheme()` do SO e atualiza
 * em runtime (via `Appearance.addChangeListener`).
 *
 * Tokens (spacing/radius/typography) vêm de `./tokens` e não mudam
 * com o tema — só `colors` muda.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';
import { tokens } from './tokens';
import { darkPalette, lightPalette, type Theme, type ThemeMode } from './palette';

interface ThemeContextValue {
  colors: Theme['colors'];
  mode: 'light' | 'dark';
  modePreference: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  tokens: typeof tokens;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = Appearance.getColorScheme();
  const [modePreference, setModePreference] = useState<ThemeMode>('system');

  // Resolve o modo efetivo ('light' | 'dark') a partir da preferência.
  const effectiveMode: 'light' | 'dark' = useMemo(() => {
    if (modePreference === 'system') {
      return systemScheme === 'light' ? 'light' : 'dark';
    }
    return modePreference;
  }, [modePreference, systemScheme]);

  // Listener de mudança de esquema do sistema (apenas relevante em mode=system).
  useEffect(() => {
    if (modePreference !== 'system') return;
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      // Force re-render via state update
      setModePreference('system');
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modePreference]);

  const value = useMemo<ThemeContextValue>(() => {
    const colors = effectiveMode === 'light' ? lightPalette : darkPalette;
    return {
      colors,
      mode: effectiveMode,
      modePreference,
      setMode: setModePreference,
      tokens,
    };
  }, [effectiveMode, modePreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme deve ser usado dentro de <ThemeProvider>');
  }
  return ctx;
}
