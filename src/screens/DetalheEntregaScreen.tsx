import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { AlertBanner } from '@/components/AlertBanner';
import { ActionChoiceCard } from '@/components/ActionChoiceCard';
import { StatusBadge } from '@/components/StatusBadge';
import NetInfo from '@react-native-community/netinfo';
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
  const [pendingSync, setPendingSync] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetchDeliveryWithCache(route.params.deliveryId);
      setDelivery(res.data ? mapDelivery(res.data) : null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [route.params.deliveryId]);

  const hasLoadedOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      void load(hasLoadedOnce.current);
      hasLoadedOnce.current = true;
    }, [load]),
  );

  async function runAction(payload: Parameters<typeof runDeliveryAction>[0]) {
    if (!delivery) return;
    setActing(true);
    setPendingSync(true);
    try {
      const net = await NetInfo.fetch();
      await runDeliveryAction(payload);
      setPendingSync(!net.isConnected);
      await load(true);
    } catch {
      setPendingSync(true);
    } finally {
      setActing(false);
    }
  }

  async function handleFsmAction() {
    if (!delivery) return;
    const action = nextFsmAction(delivery.status);
    if (!action) return;
    if (action === 'proof') {
      navigation.navigate('Comprovante', { deliveryId: delivery.id });
      return;
    }
    await runAction({
      deliveryId: delivery.id,
      action: action === 'start' ? 'start' : 'in_transit',
    });
  }

  async function handleFail() {
    if (!delivery) return;
    navigation.navigate('MarcarFalha', { deliveryId: delivery.id });
  }

  if (loading && !delivery) {
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
  const proofPhoto = delivery.proofRequirements.requires_photo;
  const proofSignature = delivery.proofRequirements.requires_signature;
  const proofSummary = proofPhoto && proofSignature
    ? `${ptBR.detail.proofRequirementsPhoto} e ${ptBR.detail.proofRequirementsSignature.toLowerCase()}`
    : proofPhoto
      ? ptBR.detail.proofRequirementsPhoto
      : proofSignature
        ? ptBR.detail.proofRequirementsSignature
        : ptBR.detail.proofRequirementsNone;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[5] }}
    >
      <View style={{ gap: tokens.space[2] }}>
        <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, fontWeight: tokens.weight.medium, textTransform: 'uppercase' }}>
          {ptBR.app.name}
        </Text>
        <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
          {ptBR.detail.title.replace('{code}', delivery.code)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space[2], flexWrap: 'wrap' }}>
          <StatusBadge status={delivery.uiStatus} label={statusLabel(delivery.uiStatus)} />
          {pendingSync && (
            <Text style={{ color: colors.statusWarningText, fontSize: tokens.text.xs }}>
              {ptBR.detail.pendingSync}
            </Text>
          )}
        </View>
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

      {delivery.failureReason ? (
        <Card>
          <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, textTransform: 'uppercase' }}>
            {ptBR.detail.failureSection}
          </Text>
          <Text style={{ color: colors.textPrimary, fontSize: tokens.text.base, marginTop: tokens.space[1] }}>
            {delivery.failureReason}
          </Text>
        </Card>
      ) : null}

      <View style={{ gap: tokens.space[3] }}>
        {fsmAction === 'proof' && (
          <AlertBanner
            tone="warning"
            title={ptBR.detail.proofRequirementsTitle}
            message={`${proofSummary}. ${ptBR.detail.finalizeHint}`}
            testID="detail-finalize-warning"
          />
        )}
        <Button label={ptBR.detail.openMap} onPress={() => navigation.navigate('MapaRota', { deliveryId: delivery.id })} fullWidth />
        {fsmAction && fsmAction !== 'proof' && (
          <Button
            label={fsmAction === 'start' ? ptBR.detail.startRoute : ptBR.detail.markInTransit}
            onPress={() => void handleFsmAction()}
            loading={acting}
            fullWidth
          />
        )}
        {fsmAction === 'proof' && (
          <Button
            label={ptBR.detail.collectProof}
            variant="primary"
            onPress={() => navigation.navigate('Comprovante', { deliveryId: delivery.id })}
            fullWidth
          />
        )}
        {delivery.status === 'in_transit' && (
          <View style={{ gap: tokens.space[3], marginTop: tokens.space[2] }}>
            <View style={{ gap: tokens.space[1] }}>
              <Text
                style={{
                  fontSize: tokens.text.sm,
                  fontWeight: tokens.weight.semibold,
                  color: colors.textPrimary,
                }}
              >
                {ptBR.detail.problems.sectionTitle}
              </Text>
              <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted }}>
                {ptBR.detail.problems.sectionHint}
              </Text>
            </View>
            <ActionChoiceCard
              testID="detail-occurrence-choice"
              title={ptBR.detail.problems.occurrenceTitle}
              subtitle={ptBR.detail.problems.occurrenceSubtitle}
              tone="info"
              onPress={() => navigation.navigate('ReportarOcorrencia', { deliveryId: delivery.id })}
            />
            <ActionChoiceCard
              testID="detail-fail-choice"
              title={ptBR.detail.problems.failTitle}
              subtitle={ptBR.detail.problems.failSubtitle}
              tone="danger"
              onPress={handleFail}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}
