import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { loadDeliveryOccurrencesView } from '@/services/occurrenceOutboxService';
import type { DriverOccurrence } from '@/api/occurrences';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { AlertBanner } from '@/components/AlertBanner';
import { ActionChoiceCard } from '@/components/ActionChoiceCard';
import { StatusBadge } from '@/components/StatusBadge';
import NetInfo from '@react-native-community/netinfo';
import { fetchDeliveryWithCache } from '@/services/deliveryService';
import { formatDeliveryWindowLabel, deliveryWindowEmptyLabel } from '@/lib/formatDeliveryWindow';
import { formatBrazilPhone, extractBrazilPhoneDigits } from '@/lib/formatPhone';
import { openRecipientPhone, openRecipientWhatsApp, recipientPhoneDigits } from '@/lib/contactRecipient';
import { mapDelivery, nextFsmAction } from '@/lib/mapDelivery';
import { runDeliveryAction } from '@/services/deliveryActions';
import type { DeliveryViewModel } from '@/types/delivery';
import type { DeliveryUiStatus } from '@/types/delivery';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList, 'DetalheEntrega'>;
type Route_ = RouteProp<AppStackParamList, 'DetalheEntrega'>;

interface PendingOccurrenceRow {
  localId: string;
  typeSlug: string;
  notes?: string;
  status: 'pending' | 'failed';
}

function statusLabel(s: DeliveryUiStatus): string {
  return {
    pending: ptBR.detail.statusPending,
    picked_up: ptBR.detail.statusPickedUp,
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
  const [occurrences, setOccurrences] = useState<DriverOccurrence[]>([]);
  const [pendingOccurrences, setPendingOccurrences] = useState<PendingOccurrenceRow[]>([]);
  const [occurrencesLoading, setOccurrencesLoading] = useState(false);

  const loadOccurrences = useCallback(async (deliveryId: number) => {
    setOccurrencesLoading(true);
    try {
      const { remote, pending } = await loadDeliveryOccurrencesView(deliveryId);
      setOccurrences(remote);
      setPendingOccurrences(pending);
    } finally {
      setOccurrencesLoading(false);
    }
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetchDeliveryWithCache(route.params.deliveryId);
      setDelivery(res.data ? mapDelivery(res.data) : null);
      if (res.data) {
        await loadOccurrences(route.params.deliveryId);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [route.params.deliveryId, loadOccurrences]);

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

  const windowLabel = formatDeliveryWindowLabel(delivery.windowStart, delivery.windowEnd);
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
  const customerPhoneDigits = recipientPhoneDigits(delivery.customer.phone);
  const customerPhoneLabel = customerPhoneDigits
    ? formatBrazilPhone(extractBrazilPhoneDigits(delivery.customer.phone))
    : delivery.customer.phone;

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
        {delivery.customer.phone ? (
          <Text style={{ color: colors.textSecondary, fontSize: tokens.text.sm, marginTop: tokens.space[1] }}>
            {customerPhoneLabel}
          </Text>
        ) : null}
        {customerPhoneDigits ? (
          <View style={{ flexDirection: 'row', gap: tokens.space[2], marginTop: tokens.space[3] }}>
            <Button
              testID="detail-call-phone"
              label={ptBR.detail.callPhone}
              variant="secondary"
              onPress={() => void openRecipientPhone(delivery.customer.phone)}
              style={{ flex: 1 }}
            />
            <Button
              testID="detail-call-whatsapp"
              label={ptBR.detail.callWhatsApp}
              variant="secondary"
              onPress={() => void openRecipientWhatsApp(delivery.customer.phone)}
              style={{ flex: 1 }}
            />
          </View>
        ) : null}
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
          {windowLabel ?? deliveryWindowEmptyLabel()}
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

      <Card>
        <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, textTransform: 'uppercase' }}>
          {ptBR.detail.occurrencesSection}
        </Text>
        {occurrencesLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: tokens.space[3] }} />
        ) : occurrences.length === 0 && pendingOccurrences.length === 0 ? (
          <Text style={{ color: colors.textSecondary, fontSize: tokens.text.sm, marginTop: tokens.space[2] }}>
            {ptBR.detail.occurrencesEmpty}
          </Text>
        ) : (
          <View style={{ marginTop: tokens.space[2], gap: tokens.space[2] }}>
            {occurrences.map((occ) => (
              <View key={`sync-${occ.id}`} style={{ gap: tokens.space[1] }}>
                <Text style={{ color: colors.textPrimary, fontWeight: tokens.weight.semibold, fontSize: tokens.text.sm }}>
                  {occ.type?.name ?? occ.type?.slug ?? 'Ocorrência'}
                </Text>
                {occ.description ? (
                  <Text style={{ color: colors.textSecondary, fontSize: tokens.text.sm }}>{occ.description}</Text>
                ) : null}
                <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs }}>
                  {occ.occurred_at
                    ? new Date(occ.occurred_at).toLocaleString('pt-BR')
                    : new Date(occ.created_at).toLocaleString('pt-BR')}
                </Text>
              </View>
            ))}
            {pendingOccurrences.map((occ) => (
              <View key={`pending-${occ.localId}`} style={{ gap: tokens.space[1] }}>
                <Text style={{ color: colors.textPrimary, fontWeight: tokens.weight.semibold, fontSize: tokens.text.sm }}>
                  {occ.typeSlug}
                </Text>
                {occ.notes ? (
                  <Text style={{ color: colors.textSecondary, fontSize: tokens.text.sm }}>{occ.notes}</Text>
                ) : null}
                <Text
                  style={{
                    color: occ.status === 'failed' ? colors.statusDangerText : colors.statusWarningText,
                    fontSize: tokens.text.xs,
                  }}
                >
                  {occ.status === 'failed'
                    ? ptBR.detail.occurrenceFailed
                    : ptBR.detail.occurrencePending}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

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
            label={fsmAction === 'start' ? ptBR.detail.pickUp : ptBR.detail.startRoute}
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
        {(delivery.status === 'picked_up' || delivery.status === 'in_transit') && (
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
