/**
 * Test utilities para Scorpius Move (T068.2).
 *
 * Fornece `renderWithTheme` que envolve o componente com ThemeProvider
 * (necessário para useTheme) e NavigationContainer (necessário para
 * useNavigation/useRoute em screens).
 */
import type { ReactNode, ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react-native';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { NavigationContainer } from '@react-navigation/native';

export function renderWithTheme(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider>
        <NavigationContainer>{children}</NavigationContainer>
      </ThemeProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...options });
}

export * from '@testing-library/react-native';
