/**
 * Scorpius Move — Dashboard (stub).
 *
 * Mostra nome do motorista + placeholder de próximas entregas.
 * Tela pós-login. Substituirá pelo feed real em T068.x.
 */
import { ScrollView, Text, View } from 'react-native';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';

export function DashboardScreen() {
  const { colors, tokens } = useTheme();
  const driver = useAuthStore((s) => s.driver);
  const clearSession = useAuthStore((s) => s.clearSession);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: tokens.space[6],
        gap: tokens.space[6],
      }}
    >
      <View style={{ gap: tokens.space[2] }}>
        <Text
          style={{
            fontSize: tokens.text['3xl'],
            fontWeight: tokens.weight.bold,
            color: colors.textPrimary,
          }}
        >
          {ptBR.dashboard.title.replace('{name}', driver?.name ?? 'Motorista')}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: tokens.text.base }}>
          {ptBR.dashboard.welcome}
        </Text>
      </View>

      <View
        style={{
          backgroundColor: colors.surfacePanel,
          borderColor: colors.borderDefault,
          borderWidth: 1,
          borderRadius: tokens.radius.lg,
          padding: tokens.space[5],
          gap: tokens.space[2],
        }}
      >
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: tokens.text.lg,
            fontWeight: tokens.weight.semibold,
          }}
        >
          {ptBR.dashboard.nextDeliveriesTitle}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm }}>
          {ptBR.dashboard.noDeliveries}
        </Text>
      </View>

      <Button
        label={ptBR.dashboard.logout}
        onPress={() => {
          void clearSession();
        }}
        variant="secondary"
        fullWidth
      />
    </ScrollView>
  );
}
