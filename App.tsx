/**
 * Scorpius Move — App root.
 *
 * Providers (de fora pra dentro):
 *  - SafeAreaProvider: status bar / notches
 *  - ThemeProvider: tokens + light/dark (F2.6)
 *  - RootNavigator: reage a authStore.isAuthenticated
 */
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useEffect, type ReactElement } from 'react';
import { startDeviceIdHydration } from '@/lib/deviceId';
import { startTokenHydration } from '@/api/client';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { RootNavigator } from '@/navigation/RootNavigator';

function ThemedStatusBar() {
  const { mode } = useTheme();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

// T115 SDK 56: React 19 — namespace JSX não é mais necessário (use ReactElement direto).
export default function App(): ReactElement {
  useEffect(() => {
    startDeviceIdHydration();
    startTokenHydration();
  }, []);

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <ThemeProvider>
          <ThemedStatusBar />
          <RootNavigator />
        </ThemeProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
