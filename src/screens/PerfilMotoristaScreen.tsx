import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ProfileInfoRow } from '@/components/ProfileInfoRow';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme/ThemeProvider';
import { formatBrazilPhone, extractBrazilPhoneDigits } from '@/lib/formatPhone';
import { ptBR } from '@/i18n/pt-BR';

function formatWhatsapp(raw: string): string {
  const digits = extractBrazilPhoneDigits(raw);
  if (digits.length < 12) return raw;
  return formatBrazilPhone(digits);
}

function driverInitials(name: string | undefined): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export function PerfilMotoristaScreen() {
  const { colors, tokens } = useTheme();
  const driver = useAuthStore((s) => s.driver);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const appVersion = (Constants.expoConfig?.version as string | undefined) ?? '0.1.0';
  const companyDisplay = driver?.company_name?.trim() || (driver ? ptBR.profile.platformLabel : '—');

  function handleLogoutPress() {
    setLogoutOpen(true);
  }

  function handleConfirmLogout() {
    setLogoutOpen(false);
    void clearSession();
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[5], paddingBottom: tokens.space[8] }}
      >
        <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
          {ptBR.profile.title}
        </Text>

        <Card>
          <View style={{ alignItems: 'center', gap: tokens.space[3], paddingVertical: tokens.space[2] }}>
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: colors.accentSurface,
                borderWidth: 3,
                borderColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: tokens.text['3xl'], fontWeight: tokens.weight.bold, color: colors.accent }}>
                {driverInitials(driver?.name)}
              </Text>
            </View>
            <View style={{ alignItems: 'center', gap: tokens.space[1] }}>
              <Text style={{ fontSize: tokens.text.xl, fontWeight: tokens.weight.semibold, color: colors.textPrimary }}>
                {driver?.name ?? '—'}
              </Text>
              <Text style={{ fontSize: tokens.text.sm, color: colors.textMuted }}>{ptBR.profile.driverSubtitle}</Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text
            style={{
              fontSize: tokens.text.xs,
              color: colors.textMuted,
              fontWeight: tokens.weight.semibold,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: tokens.space[4],
            }}
          >
            {ptBR.profile.accountSection}
          </Text>
          <View style={{ gap: tokens.space[4] }}>
            <ProfileInfoRow
              testID="profile-company"
              label={ptBR.profile.companyLabel}
              value={companyDisplay}
            />
            <ProfileInfoRow
              testID="profile-whatsapp"
              label={ptBR.profile.whatsappLabel}
              value={driver?.whatsapp ? formatWhatsapp(driver.whatsapp) : '—'}
              mono
            />
          </View>
        </Card>

        <Card
          style={{
            backgroundColor: colors.statusDangerSurface,
            borderColor: colors.statusDangerBorder,
          }}
        >
          <Text
            style={{
              fontSize: tokens.text.sm,
              fontWeight: tokens.weight.semibold,
              color: colors.statusDangerText,
              marginBottom: tokens.space[1],
            }}
          >
            {ptBR.profile.dangerZone}
          </Text>
          <Text style={{ fontSize: tokens.text.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: tokens.space[4] }}>
            {ptBR.profile.dangerZoneHint}
          </Text>
          <Button label={ptBR.profile.logout} variant="danger" fullWidth onPress={handleLogoutPress} />
        </Card>

        <Text style={{ fontSize: tokens.text.xs, color: colors.textSubtle, textAlign: 'center' }}>
          {ptBR.profile.versionLabel.replace('{version}', appVersion)}
        </Text>
      </ScrollView>

      <ConfirmDialog
        visible={logoutOpen}
        title={ptBR.profile.logoutConfirmTitle}
        description={ptBR.profile.logoutConfirmDesc}
        confirmLabel={ptBR.profile.confirm}
        cancelLabel={ptBR.profile.cancel}
        variant="danger"
        onConfirm={handleConfirmLogout}
        onCancel={() => setLogoutOpen(false)}
        testID="profile-logout-dialog"
      />
    </>
  );
}
