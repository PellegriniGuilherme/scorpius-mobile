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
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '@/components/Button';
import { KeyboardFormScreen } from '@/components/KeyboardFormScreen';
import { PhoneInput } from '@/components/PhoneInput';
import { checkPhone, requestOtp } from '@/api/auth';
import { getDeviceId } from '@/lib/deviceId';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AuthStackParamList } from '@/navigation/types';
import { validateWhatsappInput } from './LoginScreen.validation';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, tokens } = useTheme();
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = phone.replace(/\D/g, '');
  const isValid = validateWhatsappInput(phone);

  /**
   * T122 — gate check-phone.
   * Backend decide se motorista existe antes de prosseguir.
   * exists=true → requestOtp → OtpScreen
   * exists=false → erro inline "Acesso não liberado" (sem navegação)
   */
  async function handleSubmit() {
    if (!isValid) {
      setError(ptBR.login.errorInvalidPhone);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const deviceId = await getDeviceId();
      const formattedPhone = `+${trimmed}`;

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
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        (err as { response?: { status?: number } }).response?.status === 422
      ) {
        setError(ptBR.login.errorInvalidPhone);
      } else {
        setError(ptBR.login.errorGeneric);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardFormScreen
      centered
      footer={
        <Button
          label={submitting ? ptBR.login.submitting : ptBR.login.submit}
          onPress={handleSubmit}
          loading={submitting}
          disabled={!isValid}
          fullWidth
        />
      }
    >
      <View style={{ alignItems: 'center', gap: tokens.space[2] }}>
        <Text
          style={{
            fontSize: tokens.text['3xl'],
            fontWeight: tokens.weight.bold,
            color: colors.textPrimary,
          }}
        >
          {ptBR.app.name}
        </Text>
        <Text
          style={{
            fontSize: tokens.text.sm,
            color: colors.textMuted,
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
          onChangeText={setPhone}
          error={error ?? undefined}
        />
      </View>
    </KeyboardFormScreen>
  );
}
