import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { fetchDeliveryWithCache } from '@/services/deliveryService';
import { mapDelivery, nextFsmAction } from '@/lib/mapDelivery';
import { runDeliveryAction } from '@/services/deliveryActions';
import type { DeliveryViewModel } from '@/types/delivery';
import type { DeliveryUiStatus } from '@/types/delivery';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList, 'DetalheEntrega'>;
type Route_ = RouteProp<AppStackParamList, 'DetalheEntrega'>;

function statusLabel(s: DeliveryUiStatus): string {
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
  const [delivery, setDelivery] = useState<DeliveryViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDeliveryWithCache(route.params.deliveryId);
      setDelivery(res.data ? mapDelivery(res.data) : null);
    } finally {
      setLoading(false);
    }
  }, [route.params.deliveryId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleFsmAction() {
    if (!delivery) return;
    const action = nextFsmAction(delivery.status);
    if (!action) return;
    if (action === 'proof') {
      navigation.navigate('Comprovante', { deliveryId: delivery.id });
      return;
    }
    setActing(true);
    try {
      await runDeliveryAction({
        deliveryId: delivery.id,
        action: action === 'start' ? 'start' : 'in_transit',
      });
      await load();
    } finally {
      setActing(false);
    }
  }

  async function handleFail() {
    if (!delivery) return;
    setActing(true);
    try {
      await runDeliveryAction({
        deliveryId: delivery.id,
        action: 'fail',
        reason: 'Entrega não concluída',
      });
      await load();
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!delivery) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: tokens.space[6] }}>
        <Text style={{ color: colors.textMuted }}>Entrega não encontrada.</Text>
      </View>
    );
  }

  const wStart = new Date(delivery.windowStart).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const wEnd = new Date(delivery.windowEnd).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const fsmAction = nextFsmAction(delivery.status);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[5] }}>
        <View style={{ gap: tokens.space[2] }}>
          <Text style={{ fontSize: tokens.text['3xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
            {ptBR.detail.title.replace('{code}', delivery.code)}
          </Text>
          <StatusBadge status={delivery.uiStatus} label={statusLabel(delivery.uiStatus)} />
        </View>

        <Card>
          <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, textTransform: 'uppercase' }}>
            {ptBR.detail.customerSection}
          </Text>
          <Text style={{ fontSize: tokens.text.lg, fontWeight: tokens.weight.semibold, color: colors.textPrimary, marginTop: tokens.space[1] }}>
            {delivery.customer.name}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: tokens.text.sm }}>{delivery.customer.phone}</Text>
        </Card>

        <Card>
          <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, textTransform: 'uppercase' }}>
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
          <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, textTransform: 'uppercase' }}>
            Pacotes
          </Text>
          <Text style={{ color: colors.textPrimary, marginTop: tokens.space[1] }}>
            {delivery.packageCount} pacote(s)
            {delivery.weightKg != null ? ` • ${delivery.weightKg} kg` : ''}
          </Text>
        </Card>

        <Card>
          <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, textTransform: 'uppercase' }}>
            {ptBR.detail.windowSection}
          </Text>
          <Text style={{ fontSize: tokens.text.lg, fontWeight: tokens.weight.semibold, color: colors.accent, marginTop: tokens.space[1] }}>
            {wStart}–{wEnd}
          </Text>
        </Card>

        <View style={{ gap: tokens.space[3] }}>
          <Button label={ptBR.detail.openMap} onPress={() => navigation.navigate('MapaRota', { deliveryId: delivery.id })} fullWidth />
          {fsmAction && fsmAction !== 'proof' && (
            <Button
              label={fsmAction === 'start' ? 'Iniciar rota' : 'Em trânsito'}
              onPress={() => void handleFsmAction()}
              loading={acting}
              fullWidth
            />
          )}
          {fsmAction === 'proof' && (
            <Button
              label={ptBR.detail.collectProof}
              variant="secondary"
              onPress={() => navigation.navigate('Comprovante', { deliveryId: delivery.id })}
              fullWidth
            />
          )}
          {delivery.status === 'in_transit' && (
            <Button label="Reportar ocorrência" variant="ghost" onPress={() => navigation.navigate('ReportarOcorrencia', { deliveryId: delivery.id })} fullWidth />
          )}
          {delivery.status === 'in_transit' && (
            <Button label="Marcar falha" variant="danger" onPress={() => void handleFail()} loading={acting} fullWidth />
          )}
        </View>
      </ScrollView>
    </ScrollView>
  );
}
