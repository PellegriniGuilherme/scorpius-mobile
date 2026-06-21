/**
 * Scorpius Move — OTP confirm screen.
 *
 * Recebe `phone` por route param. Após confirmar o código, chama
 * `setSession(driver)` na authStore e o RootNavigator troca para
 * a stack autenticada.
 */
import { useState, useRef, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { confirmOtp } from '@/api/auth';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AuthStackParamList } from '@/navigation/types';

type Nav = RouteProp<AuthStackParamList, 'Otp'>;

const RESEND_COOLDOWN_SEC = 30;

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

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setResendIn((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const phone = route.params?.phone ?? '';

  function isValidCode(s: string): boolean {
    return /^\d{6}$/.test(s);
  }

  async function handleSubmit() {
    if (!isValidCode(code)) {
      setError(ptBR.otp.errorInvalidCode);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await confirmOtp(phone, code, 'move-app');
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
          padding: tokens.space[6],
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
            disabled={!isValidCode(code)}
            fullWidth
          />
          <Button
            label={resendIn > 0 ? ptBR.otp.resendIn.replace('{seconds}', String(resendIn)) : ptBR.otp.resend}
            onPress={() => {
              // TODO F2 Mobile: re-chamar requestOtp
              setResendIn(RESEND_COOLDOWN_SEC);
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
