import { Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { formatAddressCompact } from '@/lib/formatAddress';
import { deliveryWindowEmptyLabel, formatDeliveryWindowLabel } from '@/lib/formatDeliveryWindow';
import { ptBR } from '@/i18n/pt-BR';
import type { DeliveryUiStatus, DeliveryViewModel } from '@/types/delivery';
import { useTheme } from '@/theme/ThemeProvider';

function statusLabel(status: DeliveryUiStatus): string {
  return {
    pending: ptBR.detail.statusPending,
    picked_up: ptBR.detail.statusPickedUp,
    in_route: ptBR.detail.statusInRoute,
    delivered: ptBR.detail.statusDelivered,
    failed: ptBR.detail.statusFailed,
  }[status];
}

function packageLabel(count: number): string {
  return count === 1
    ? ptBR.home.packageCountOne.replace('{count}', '1')
    : ptBR.home.packageCountOther.replace('{count}', String(count));
}

export function DeliveryListCard({ delivery }: { delivery: DeliveryViewModel }) {
  const { colors, tokens } = useTheme();
  const windowLabel = formatDeliveryWindowLabel(delivery.windowStart, delivery.windowEnd);
  const address = formatAddressCompact(delivery.address);
  const addressPrimary = address.primary || address.secondary;
  const addressSecondary = address.primary ? address.secondary : '';

  return (
    <Card>
      <View style={{ gap: tokens.space[3] }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: tokens.space[3],
          }}
        >
          <View style={{ flex: 1, gap: tokens.space[1], minWidth: 0 }}>
            <Text
              style={{
                fontSize: tokens.text.lg,
                fontWeight: tokens.weight.bold,
                color: colors.textPrimary,
              }}
              numberOfLines={2}
            >
              {delivery.customer.name}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs }}>
              #{delivery.code}
            </Text>
          </View>
          <StatusBadge status={delivery.uiStatus} label={statusLabel(delivery.uiStatus)} />
        </View>

        <View style={{ gap: tokens.space[1] }}>
          {addressPrimary ? (
            <Text
              style={{ color: colors.textPrimary, fontSize: tokens.text.sm, lineHeight: 20 }}
              numberOfLines={2}
            >
              {addressPrimary}
            </Text>
          ) : (
            <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm }}>
              {ptBR.home.addressUnavailable}
            </Text>
          )}
          {addressSecondary ? (
            <Text
              style={{ color: colors.textSecondary, fontSize: tokens.text.xs, lineHeight: 16 }}
              numberOfLines={1}
            >
              {addressSecondary}
            </Text>
          ) : null}
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: tokens.space[1],
            borderTopWidth: 1,
            borderTopColor: colors.borderDefault,
          }}
        >
          <Text
            style={{
              color: colors.accent,
              fontSize: tokens.text.sm,
              fontWeight: tokens.weight.semibold,
            }}
          >
            {windowLabel ?? deliveryWindowEmptyLabel()}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs }}>
            {packageLabel(delivery.packageCount)}
          </Text>
        </View>
      </View>
    </Card>
  );
}
