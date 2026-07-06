import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme/ThemeProvider';
import { formatBrazilPhone, extractBrazilPhoneDigits } from '@/lib/formatPhone';
import { ptBR } from '@/i18n/pt-BR';

function formatWhatsapp(raw: string): string {
  const digits = extractBrazilPhoneDigits(raw);
  if (digits.length < 12) return raw;
  return formatBrazilPhone(digits);
}

export function PerfilMotoristaScreen() {
  const { colors, tokens } = useTheme();
  const driver = useAuthStore((s) => s.driver);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [confirming, setConfirming] = useState(false);

  const appVersion = (Constants.expoConfig?.version as string | undefined) ?? '0.1.0';

  function handleLogoutPress() {
    if (confirming) {
      void clearSession();
      return;
    }
    setConfirming(true);
    Alert.alert(ptBR.profile.logoutConfirmTitle, ptBR.profile.logoutConfirmDesc, [
      { text: ptBR.profile.cancel, style: 'cancel', onPress: () => setConfirming(false) },
      { text: ptBR.profile.confirm, style: 'destructive', onPress: () => void clearSession() },
    ]);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[5] }}>
        <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
          {ptBR.profile.title}
        </Text>

        <View style={{ alignItems: 'center', gap: tokens.space[2] }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: tokens.text['3xl'], fontWeight: tokens.weight.bold, color: colors.textOnAccent }}>
              {driver?.name?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={{ fontSize: tokens.text.xl, fontWeight: tokens.weight.semibold, color: colors.textPrimary }}>
            {driver?.name ?? '—'}
          </Text>
        </View>

        <Card>
          <View style={{ gap: tokens.space[3] }}>
            <View>
              <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, textTransform: 'uppercase' }}>
                Empresa
              </Text>
              <Text style={{ fontSize: tokens.text.base, color: colors.textPrimary, marginTop: tokens.space[1] }}>
                #{driver?.company_id ?? '—'}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, textTransform: 'uppercase' }}>
                {ptBR.profile.whatsappLabel}
              </Text>
              <Text
                style={{
                  fontSize: tokens.text.base,
                  color: colors.textPrimary,
                  marginTop: tokens.space[1],
                  fontFamily: tokens.font.mono,
                }}
              >
                {driver?.whatsapp ? formatWhatsapp(driver.whatsapp) : '—'}
              </Text>
            </View>
          </View>
        </Card>

        <Button label={confirming ? ptBR.profile.confirm : ptBR.profile.logout} variant="danger" fullWidth onPress={handleLogoutPress} />

        <Text style={{ fontSize: tokens.text.xs, color: colors.textSubtle, textAlign: 'center' }}>
          {ptBR.profile.versionLabel.replace('{version}', appVersion)}
        </Text>
      </ScrollView>
    </ScrollView>
  );
}
