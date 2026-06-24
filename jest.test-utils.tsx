/**
 * Test utilities para Scorpius Move (T068.2).
 *
 * Fornece `renderWithTheme` que envolve o componente com SafeAreaProvider
 * (necessário para useSafeAreaInsets — T121), ThemeProvider (necessário
 * para useTheme) e NavigationContainer (necessário para useNavigation/
 * useRoute em screens).
 *
 * T121: aceita `initialMetrics` opcional para simular devices com notch
 * (iPhone X etc). Default = device sem notch (insets = 0).
 */
import type { ReactNode, ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react-native';
import {
  SafeAreaProvider,
  type EdgeInsets,
  type Metrics,
} from 'react-native-safe-area-context';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { NavigationContainer } from '@react-navigation/native';

const DEFAULT_INSETS: EdgeInsets = { top: 0, left: 0, right: 0, bottom: 0 };

const DEFAULT_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: DEFAULT_INSETS,
};

export interface RenderWithThemeOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Insets iniciais do SafeAreaProvider (T121). Default = 0. */
  initialMetrics?: Metrics;
}

export function renderWithTheme(ui: ReactElement, options: RenderWithThemeOptions = {}) {
  const { initialMetrics = DEFAULT_METRICS, ...rest } = options;
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <ThemeProvider>
          <NavigationContainer>{children}</NavigationContainer>
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...rest });
}

export * from '@testing-library/react-native';
