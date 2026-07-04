/**
 * Scorpius Move — OTP confirm screen.
 *
 * Recebe `phone` por route param. Após confirmar o código, chama
 * `setSession(driver)` na authStore e o RootNavigator troca para
 * a stack autenticada.
 */
import { useState, useRef, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { confirmOtp, requestOtp } from '@/api/auth';
import { getDeviceId } from '@/lib/deviceId';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AuthStackParamList } from '@/navigation/types';
import { isValidOtpCode } from './OtpScreen.validation';

type Nav = RouteProp<AuthStackParamList, 'Otp'>;

const RESEND_COOLDOWN_SEC = 30;
const DEFAULT_OTP_TTL_SEC = 300; // 5min (T101 backend retorna expires_in)

/**
 * Formata segundos em m:ss (ex: 300 → "5:00", 119 → "1:59", 9 → "0:09").
 */
function formatCountdown(totalSec: number): string {
  const safe = Math.max(0, totalSec);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function OtpScreen() {
  const route = useRoute<Nav>();
  const navigation = useNavigation();
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const setSession = useAuthStore((s) => s.setSession);

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN_SEC);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // T101: countdown OTP TTL (5min default). Lido de route.params.expiresIn.
  const initialTtl = route.params?.expiresIn ?? DEFAULT_OTP_TTL_SEC;
  const [expiresIn, setExpiresIn] = useState(initialTtl);
  const otpExpired = expiresIn <= 0;

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setResendIn((prev) => (prev > 0 ? prev - 1 : 0));
      setExpiresIn((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const phone = route.params?.phone ?? '';

  async function handleSubmit() {
    if (!isValidOtpCode(code)) {
      setError(ptBR.otp.errorInvalidCode);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const deviceId = await getDeviceId();
      const result = await confirmOtp(phone, code, deviceId);
      setSession(result.driver);
      // RootNavigator reage a isAuthenticated e troca para AppStack.
    } catch {
      setError(ptBR.otp.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: tokens.space[6],
          // T121: insets aplicados no contentContainerStyle do ScrollView
          // (não no KeyboardAvoidingView) porque o KAV sobrescreve
          // paddingTop/Bottom internamente quando behavior='padding'.
          // Em devices sem notch, insets são 0.
          paddingTop: tokens.space[6] + insets.top,
          paddingBottom: tokens.space[6] + insets.bottom,
          gap: tokens.space[6],
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: tokens.space[4] }}>
          <Text
            style={{
              fontSize: tokens.text['2xl'],
              fontWeight: tokens.weight.semibold,
              color: colors.textPrimary,
            }}
          >
            {ptBR.otp.title}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: tokens.text.base }}>
            {ptBR.otp.description.replace('{phone}', phone)}
          </Text>
          <Input
            label={ptBR.otp.codeLabel}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            error={error ?? undefined}
          />
          <Button
            label={submitting ? ptBR.otp.submitting : ptBR.otp.submit}
            onPress={handleSubmit}
            loading={submitting}
            disabled={!isValidOtpCode(code) || otpExpired}
            fullWidth
          />
          {/* T101: countdown OTP TTL + estado expirado */}
          {!otpExpired && (
            <Text
              testID="otp-countdown"
              accessibilityLabel={`Tempo restante: ${Math.ceil(expiresIn / 60)} minutos`}
              style={{ color: colors.textMuted, fontSize: tokens.text.sm, textAlign: 'center' }}
            >
              {ptBR.otp.expiresIn.replace('{time}', formatCountdown(expiresIn))}
            </Text>
          )}
          {otpExpired && (
            <Text
              testID="otp-expired"
              style={{ color: colors.statusDangerText, fontSize: tokens.text.sm, textAlign: 'center' }}
            >
              {ptBR.otp.expired}
            </Text>
          )}
          <Button
            testID="otp-resend"
            label={resendIn > 0 ? ptBR.otp.resendIn.replace('{seconds}', String(resendIn)) : ptBR.otp.resend}
            onPress={() => {
              void (async () => {
                const deviceId = await getDeviceId();
                try {
                  const response = await requestOtp(phone, deviceId);
                  setResendIn(RESEND_COOLDOWN_SEC);
                  setExpiresIn(response.expires_in ?? DEFAULT_OTP_TTL_SEC);
                } catch {
                  setError(ptBR.otp.errorGeneric);
                }
              })();
            }}
            variant="ghost"
            disabled={resendIn > 0}
            fullWidth
          />
          <Button
            label={ptBR.common.back}
            onPress={() => navigation.goBack()}
            variant="ghost"
            fullWidth
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
