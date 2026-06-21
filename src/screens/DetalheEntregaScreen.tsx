import { ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { findDelivery, type DeliveryStatus } from '@/mocks/deliveries';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList, 'DetalheEntrega'>;
type Route_ = RouteProp<AppStackParamList, 'DetalheEntrega'>;

function statusLabel(s: DeliveryStatus): string {
  return {
    pending: ptBR.detail.statusPending,
    in_route: ptBR.detail.statusInRoute,
    delivered: ptBR.detail.statusDelivered,
    failed: ptBR.detail.statusFailed,
  }[s];
}

export function DetalheEntregaScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route_>();
  const { colors, tokens } = useTheme();
  const delivery = findDelivery(route.params.deliveryId);

  if (!delivery) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: tokens.space[6] }}>
        <Text style={{ color: colors.textMuted }}>Entrega não encontrada.</Text>
      </View>
    );
  }

  const wStart = new Date(delivery.window_start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const wEnd = new Date(delivery.window_end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[5] }}>
        <View style={{ gap: tokens.space[2] }}>
          <Text style={{ fontSize: tokens.text['3xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
            {ptBR.detail.title.replace('{code}', delivery.code)}
          </Text>
          <StatusBadge status={delivery.status} label={statusLabel(delivery.status)} />
        </View>

        <Card>
          <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, fontWeight: tokens.weight.medium, textTransform: 'uppercase' }}>
            {ptBR.detail.customerSection}
          </Text>
          <Text style={{ fontSize: tokens.text.lg, fontWeight: tokens.weight.semibold, color: colors.textPrimary, marginTop: tokens.space[1] }}>
            {delivery.customer.name}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: tokens.text.sm }}>{delivery.customer.phone}</Text>
        </Card>

        <Card>
          <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, fontWeight: tokens.weight.medium, textTransform: 'uppercase' }}>
            {ptBR.detail.addressSection}
          </Text>
          <Text style={{ fontSize: tokens.text.base, color: colors.textPrimary, marginTop: tokens.space[1] }}>
            {delivery.address.street}, {delivery.address.number}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: tokens.text.sm }}>{delivery.address.neighborhood}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: tokens.text.sm }}>
            {delivery.address.city} / {delivery.address.state} — CEP {delivery.address.zip}
          </Text>
        </Card>

        <Card>
          <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, fontWeight: tokens.weight.medium, textTransform: 'uppercase' }}>
            {ptBR.detail.itemsSection.replace('{count}', String(delivery.items.length))}
          </Text>
          <View style={{ marginTop: tokens.space[2], gap: tokens.space[2] }}>
            {delivery.items.map((item, idx) => (
              <View
                key={`${item.sku}-${idx}`}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: tokens.space[2],
                  borderBottomColor: colors.borderDefault,
                  borderBottomWidth: idx < delivery.items.length - 1 ? 1 : 0,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: tokens.text.sm, fontWeight: tokens.weight.medium }}>
                    {item.description}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs, fontFamily: tokens.font.mono }}>
                    {item.sku}
                  </Text>
                </View>
                <Text style={{ color: colors.accent, fontSize: tokens.text.base, fontWeight: tokens.weight.bold }}>
                  ×{item.quantity}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, fontWeight: tokens.weight.medium, textTransform: 'uppercase' }}>
            {ptBR.detail.windowSection}
          </Text>
          <Text style={{ fontSize: tokens.text.lg, fontWeight: tokens.weight.semibold, color: colors.accent, marginTop: tokens.space[1] }}>
            {wStart}–{wEnd}
          </Text>
        </Card>

        <View style={{ gap: tokens.space[3] }}>
          <Button label={ptBR.detail.openMap} onPress={() => navigation.navigate('MapaRota', { deliveryId: delivery.id })} fullWidth />
          {delivery.status !== 'delivered' && (
            <Button
              label={ptBR.detail.collectProof}
              variant="secondary"
              onPress={() => navigation.navigate('Comprovante', { deliveryId: delivery.id })}
              fullWidth
            />
          )}
        </View>
      </ScrollView>
    </ScrollView>
  );
}
