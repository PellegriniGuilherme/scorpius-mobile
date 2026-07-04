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
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
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
  const insets = useSafeAreaInsets();
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

      // T122: gate de fluxo. Bloqueia motorista não-cadastrado ANTES de
      // disparar OTP (evita gasto de SMS/disparo e mostra mensagem
      // acionável ao usuário).
      const check = await checkPhone(formattedPhone);

      if (!check.exists) {
        // exists=false: motorista não cadastrado. Empresa precisa provisionar.
        // NÃO chama requestOtp, NÃO navega.
        setError(ptBR.login.errorAccessNotAllowed);
        return;
      }

      // exists=true: prossegue com o fluxo OTP original.
      // T101: response.expires_in (TTL do OTP em segundos) é passado ao
      // OtpScreen para renderizar countdown regressivo.
      const response = await requestOtp(formattedPhone, deviceId);
      navigation.navigate('Otp', {
        phone: formattedPhone,
        expiresIn: response.expires_in,
      });
    } catch (err) {
      // T122: 422 do check-phone (phone mal formatado) → erro de validação.
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
          // Em devices sem notch, insets são 0 e o comportamento é
          // idêntico ao baseline.
          paddingTop: tokens.space[6] + insets.top,
          paddingBottom: tokens.space[6] + insets.bottom,
          gap: tokens.space[6],
        }}
        keyboardShouldPersistTaps="handled"
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
          <Input
            label={ptBR.login.whatsappLabel}
            placeholder={ptBR.login.whatsappPlaceholder}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            error={error ?? undefined}
            hint={!error ? 'Use o formato +55 (11) 99999-8888' : undefined}
          />
          <Button
            label={submitting ? ptBR.login.submitting : ptBR.login.submit}
            onPress={handleSubmit}
            loading={submitting}
            disabled={!isValid}
            fullWidth
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
