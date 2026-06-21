/**
 * Scorpius Move — RootNavigator.
 *
 * Reage a `isAuthenticated` da authStore. Mostra AuthStack (Login/OTP)
 * quando deslogado, AppStack quando autenticado. Inclui estado de
 * loading (bootstrap inicial) com splash nativo.
 *
 * **Modo preview (?preview=NAME):** força uma tela específica
 * sem precisar de login real. Usado em screenshots/E2E. Em produção
 * este caminho é no-op (params da URL não confiáveis).
 *
 * Valores aceitos: `login | otp | home | detalhe | mapa | comprovante | perfil`.
 *
 * **ATENÇÃO:** a URL é `?preview=NAME`, NÃO `?preview=screen=NAME` ou
 * `?preview=NAME&...` seguido de `=`. `URLSearchParams.get('preview')`
 * retorna tudo até o próximo `&`, então `?preview=screen=home` faz o
 * valor ser a string literal `"screen=home"`, que não bate com nenhum
 * screen válido e cai no fallback (AuthStack → LoginScreen). Use sempre
 * `?preview=home` (e similares).
 */
import { useEffect, useMemo } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { LoginScreen } from '@/screens/LoginScreen';
import { OtpScreen } from '@/screens/OtpScreen';
import { HomeMotoristaScreen } from '@/screens/HomeMotoristaScreen';
import { DetalheEntregaScreen } from '@/screens/DetalheEntregaScreen';
import { MapaRotaScreen } from '@/screens/MapaRotaScreen';
import { ComprovanteScreen } from '@/screens/ComprovanteScreen';
import { PerfilMotoristaScreen } from '@/screens/PerfilMotoristaScreen';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme/ThemeProvider';
import type { AuthStackParamList, AppStackParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function AuthFlow() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Otp" component={OtpScreen} />
    </AuthStack.Navigator>
  );
}

function AppFlow({ initial }: { initial?: keyof AppStackParamList }) {
  return (
    <AppStack.Navigator initialRouteName={initial ?? 'HomeMotorista'} screenOptions={{ headerShown: true }}>
      <AppStack.Screen name="HomeMotorista" component={HomeMotoristaScreen} options={{ title: 'Scorpius Move', headerShown: false }} />
      <AppStack.Screen name="DetalheEntrega" component={DetalheEntregaScreen} options={{ title: 'Entrega' }} />
      <AppStack.Screen name="MapaRota" component={MapaRotaScreen} options={{ title: 'Rota' }} />
      <AppStack.Screen name="Comprovante" component={ComprovanteScreen} options={{ title: 'Comprovante' }} />
      <AppStack.Screen name="PerfilMotorista" component={PerfilMotoristaScreen} options={{ title: 'Perfil' }} />
    </AppStack.Navigator>
  );
}

type PreviewScreen = 'login' | 'otp' | 'home' | 'detalhe' | 'mapa' | 'comprovante' | 'perfil';

function readPreviewFromUrl(): PreviewScreen | null {
  // Em ambiente sem window (SSR/native real) ou sem location (jest node
  // sem jsdom), não há preview. Defesa em profundidade para ambientes
  // parciais.
  if (typeof window === 'undefined' || !window.location) return null;
  const params = new URLSearchParams(window.location.search);
  // ATENÇÃO: get('preview') retorna o valor cru até o próximo '&'. Se a
  // URL for `?preview=screen=home` o retorno é a string literal
  // 'screen=home', que não está em `valid` e cai no fallback Login.
  // Formato correto: `?preview=home` (e similares).
  const v = params.get('preview');
  const valid: PreviewScreen[] = ['login', 'otp', 'home', 'detalhe', 'mapa', 'comprovante', 'perfil'];
  return valid.includes((v ?? '') as PreviewScreen) ? (v as PreviewScreen) : null;
}

function PreviewFlow({ screen }: { screen: PreviewScreen }) {
  const { mode, colors } = useTheme();
  const navTheme = {
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.surfacePanel,
      text: colors.textPrimary,
      border: colors.borderDefault,
      primary: colors.accent,
    },
  };
  if (screen === 'login') {
    return (
      <NavigationContainer theme={navTheme}>
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
        </AuthStack.Navigator>
      </NavigationContainer>
    );
  }
  if (screen === 'otp') {
    return (
      <NavigationContainer theme={navTheme}>
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Otp" component={OtpScreen} initialParams={{ phone: '+5511999998888' }} />
        </AuthStack.Navigator>
      </NavigationContainer>
    );
  }
  const initial: keyof AppStackParamList =
    screen === 'detalhe' ? 'DetalheEntrega' :
    screen === 'mapa' ? 'MapaRota' :
    screen === 'comprovante' ? 'Comprovante' :
    screen === 'perfil' ? 'PerfilMotorista' : 'HomeMotorista';
  const initialParamsLookup: Record<string, object> = {
    DetalheEntrega: { deliveryId: 1001 },
    MapaRota: { deliveryId: 1001 },
    Comprovante: { deliveryId: 1001 },
  };
  const initialParams = initialParamsLookup[initial as string];
  return (
    <NavigationContainer theme={navTheme}>
      <AppStack.Navigator initialRouteName={initial} screenOptions={{ headerShown: true }}>
        <AppStack.Screen name="HomeMotorista" component={HomeMotoristaScreen} options={{ title: 'Scorpius Move', headerShown: false }} />
        <AppStack.Screen name="DetalheEntrega" component={DetalheEntregaScreen} options={{ title: 'Entrega #SC-1001' }} initialParams={initial === 'DetalheEntrega' ? (initialParams as never) : undefined} />
        <AppStack.Screen name="MapaRota" component={MapaRotaScreen} options={{ title: 'Rota' }} initialParams={initial === 'MapaRota' ? (initialParams as never) : undefined} />
        <AppStack.Screen name="Comprovante" component={ComprovanteScreen} options={{ title: 'Comprovante' }} initialParams={initial === 'Comprovante' ? (initialParams as never) : undefined} />
        <AppStack.Screen name="PerfilMotorista" component={PerfilMotoristaScreen} options={{ title: 'Perfil' }} />
      </AppStack.Navigator>
    </NavigationContainer>
  );
}

export function RootNavigator() {
  const { mode, colors } = useTheme();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const previewScreen = useMemo(() => readPreviewFromUrl(), []);

  if (previewScreen) {
    return <PreviewFlow screen={previewScreen} />;
  }

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const navTheme = {
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.surfacePanel,
      text: colors.textPrimary,
      border: colors.borderDefault,
      primary: colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>{isAuthenticated ? <AppFlow /> : <AuthFlow />}</NavigationContainer>
  );
}
