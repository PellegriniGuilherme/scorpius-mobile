/**
 * Scorpius Move — Login (OTP request) screen.
 *
 * Fluxo:
 *  1. Usuário informa WhatsApp
 *  2. App chama /driver/auth/otp
 *  3. Navega para OtpScreen com o phone em route params
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { requestOtp } from '@/api/auth';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AuthStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, tokens } = useTheme();
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = phone.replace(/\D/g, '');
  const isValid = trimmed.length >= 12; // E.164: +55 + DDD + 9 digits

  async function handleSubmit() {
    if (!isValid) {
      setError(ptBR.login.errorInvalidPhone);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const deviceId = 'move-app'; // TODO F2 Mobile: identifier per device
      await requestOtp(`+${trimmed}`, deviceId);
      navigation.navigate('Otp', { phone: `+${trimmed}` });
    } catch {
      setError(ptBR.login.errorGeneric);
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
