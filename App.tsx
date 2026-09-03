/**
 * Scorpius Move — App root.
 *
 * Providers (de fora pra dentro):
 *  - SafeAreaProvider: status bar / notches
 *  - ThemeProvider: tokens + light/dark (F2.6)
 *  - RootNavigator: reage a authStore.isAuthenticated
 */
import { StatusBar } from 'expo-status-bar';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { RootNavigator } from '@/navigation/RootNavigator';

function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

export default function App(): ReactElement {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedStatusBar />
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
