/**
 * Scorpius Move — Login (phone + OTP) screen.
 *
 * Fluxo (T122 — gate de check-phone):
 *  1. Usuário informa WhatsApp
 *  2. App chama `GET /driver/check-phone?phone=+55...`
 *     a. exists=true  → chama `requestOtp()` → navega para OtpScreen
 *     b. exists=false → mostra erro inline "Acesso não liberado..."
 *        (motorista NÃO se cadastra via app — empresa provisiona)
 *     c. 422 (phone inválido) → mostra erro de telefone
 *  3. OtpScreen confirma código via `POST /driver/auth/confirm`
 */
import axios from 'axios';
import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { KeyboardFormScreen } from '@/components/KeyboardFormScreen';
import { PhoneInput } from '@/components/PhoneInput';
import { checkPhone, requestOtp } from '@/api/auth';
import { getDeviceId } from '@/lib/deviceId';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AuthStackParamList } from '@/navigation/types';
import { validateWhatsappInput } from './LoginScreen.validation';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

function isHttpStatus(error: unknown, status: number): boolean {
  if (axios.isAxiosError(error)) {
    return error.response?.status === status;
  }
  return false;
}

export function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, tokens } = useTheme();
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return;

    if (!validateWhatsappInput(phone)) {
      setError(ptBR.login.errorInvalidPhone);
      return;
    }

    submittingRef.current = true;
    setError(null);
    setSubmitting(true);

    try {
      const trimmed = phone.replace(/\D/g, '');
      const formattedPhone = `+${trimmed}`;
      const deviceId = getDeviceId();
      const check = await checkPhone(formattedPhone);

      if (!check.exists) {
        setError(ptBR.login.errorAccessNotAllowed);
        return;
      }

      const response = await requestOtp(formattedPhone, deviceId);
      navigation.navigate('Otp', {
        phone: formattedPhone,
        expiresIn: response.expires_in,
      });
    } catch (err) {
      if (isHttpStatus(err, 422)) {
        setError(ptBR.login.errorInvalidPhone);
      } else {
        setError(ptBR.login.errorGeneric);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [navigation, phone]);

  return (
    <KeyboardFormScreen
      centered
      footer={
        <Button
          testID="login-submit-button"
          label={submitting ? ptBR.login.submitting : ptBR.login.submit}
          onPress={() => {
            void handleSubmit();
          }}
          loading={submitting}
          fullWidth
        />
      }
    >
      <View style={{ alignItems: 'center', gap: tokens.space[2] }}>
        <Logo size={140} />
        <Text
          style={{
            fontSize: tokens.text.sm,
            color: colors.textMuted,
            textAlign: 'center',
          }}
        >
          {ptBR.app.tagline}
        </Text>
      </View>

      <View style={{ gap: tokens.space[4] }}>
        <Text
          style={{
            fontSize: tokens.text['2xl'],
            fontWeight: tokens.weight.semibold,
            color: colors.textPrimary,
          }}
        >
          {ptBR.login.title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: tokens.text.base }}>
          {ptBR.login.description}
        </Text>
        <PhoneInput
          label={ptBR.login.whatsappLabel}
          placeholder={ptBR.login.whatsappPlaceholder}
          value={phone}
          onChangeText={(value) => {
            setPhone(value);
            if (error) setError(null);
          }}
          error={error ?? undefined}
        />
      </View>
    </KeyboardFormScreen>
  );
}
