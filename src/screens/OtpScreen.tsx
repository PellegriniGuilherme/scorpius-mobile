/**
 * Scorpius Move — OTP confirm screen.
 *
 * Recebe `phone` por route param. Após confirmar o código, chama
 * `setSession(driver)` na authStore e o RootNavigator troca para
 * a stack autenticada.
 */
import { useState, useRef, useEffect } from 'react';
import { Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { OtpInput } from '@/components/OtpInput';
import { KeyboardFormScreen } from '@/components/KeyboardFormScreen';
import { confirmOtp, requestOtp } from '@/api/auth';
import { getDeviceId } from '@/lib/deviceId';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AuthStackParamList } from '@/navigation/types';
import { isValidOtpCode } from './OtpScreen.validation';

type Nav = RouteProp<AuthStackParamList, 'Otp'>;

const RESEND_COOLDOWN_SEC = 30;
const DEFAULT_OTP_TTL_SEC = 300;

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
  const setSession = useAuthStore((s) => s.setSession);

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN_SEC);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  async function handleSubmit(submittedCode = code) {
    if (!isValidOtpCode(submittedCode)) {
      setError(ptBR.otp.errorInvalidCode);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const deviceId = getDeviceId();
      const result = await confirmOtp(phone, submittedCode, deviceId);
      setSession(result.driver);
    } catch {
      setError(ptBR.otp.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardFormScreen
      centered
      footer={
        <>
          <Button
            label={submitting ? ptBR.otp.submitting : ptBR.otp.submit}
            onPress={handleSubmit}
            loading={submitting}
            disabled={!isValidOtpCode(code) || otpExpired}
            fullWidth
          />
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
                const deviceId = getDeviceId();
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
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: tokens.space[4] }}>
        <Logo size={120} />
        <View style={{ gap: tokens.space[4], width: '100%' }}>
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
        <OtpInput
          label={ptBR.otp.codeLabel}
          value={code}
          onChangeText={(v) => {
            setCode(v);
            if (error) setError(null);
          }}
          onComplete={(completedCode) => {
            if (!submitting && !otpExpired) {
              void handleSubmit(completedCode);
            }
          }}
          error={error ?? undefined}
          disabled={otpExpired}
        />
        </View>
      </View>
    </KeyboardFormScreen>
  );
}
