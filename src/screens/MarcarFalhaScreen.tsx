import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import NetInfo from '@react-native-community/netinfo';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { KeyboardFormScreen } from '@/components/KeyboardFormScreen';
import { fetchDeliveryWithCache } from '@/services/deliveryService';
import { runDeliveryAction } from '@/services/deliveryActions';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList, 'MarcarFalha'>;
type Route_ = RouteProp<AppStackParamList, 'MarcarFalha'>;
type Phase = 'form' | 'confirm';

const MIN_REASON_LENGTH = 3;

export function MarcarFalhaScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route_>();
  const { colors, tokens } = useTheme();
  const [phase, setPhase] = useState<Phase>('form');
  const [deliveryCode, setDeliveryCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedReason = reason.trim();
  const canContinue = trimmedReason.length >= MIN_REASON_LENGTH;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDeliveryWithCache(route.params.deliveryId);
      setDeliveryCode(res.data?.reference_code ?? null);
    } finally {
      setLoading(false);
    }
  }, [route.params.deliveryId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function handleConfirm() {
    if (!canContinue || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const net = await NetInfo.fetch();
      await runDeliveryAction({
        deliveryId: route.params.deliveryId,
        action: 'fail',
        reason: trimmedReason,
      });
      if (!net.isConnected) {
        navigation.goBack();
        return;
      }
      navigation.goBack();
    } catch {
      setError(ptBR.failDelivery.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardFormScreen
      footer={
        phase === 'form' ? (
          <Button
            testID="fail-delivery-review"
            label={ptBR.failDelivery.review}
            onPress={() => setPhase('confirm')}
            disabled={!canContinue}
            fullWidth
          />
        ) : (
          <View style={{ gap: tokens.space[3] }}>
            <Button
              testID="fail-delivery-confirm"
              label={ptBR.failDelivery.confirmActionExplicit}
              variant="danger"
              onPress={() => void handleConfirm()}
              loading={submitting}
              fullWidth
            />
            <Button
              testID="fail-delivery-back"
              label={ptBR.failDelivery.back}
              variant="ghost"
              onPress={() => setPhase('form')}
              disabled={submitting}
              fullWidth
            />
          </View>
        )
      }
    >
      <View style={{ gap: tokens.space[2] }}>
        <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, fontWeight: tokens.weight.medium, textTransform: 'uppercase' }}>
          {ptBR.app.name}
        </Text>
        <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
          {ptBR.failDelivery.title}
        </Text>
        {deliveryCode ? (
          <Text style={{ color: colors.textSecondary, fontSize: tokens.text.sm }}>
            {ptBR.detail.title.replace('{code}', deliveryCode)}
          </Text>
        ) : null}
        {phase === 'form' ? (
          <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm, lineHeight: 20 }}>
            {ptBR.failDelivery.formHint}
          </Text>
        ) : null}
      </View>

      {phase === 'form' ? (
        <Input
          testID="fail-delivery-reason"
          label={ptBR.failDelivery.descriptionLabel}
          placeholder={ptBR.failDelivery.descriptionPlaceholder}
          hint={ptBR.failDelivery.descriptionHint}
          error={reason.length > 0 && !canContinue ? ptBR.failDelivery.descriptionTooShort : undefined}
          value={reason}
          onChangeText={setReason}
          multiline
          maxLength={500}
          autoFocus
        />
      ) : (
        <View style={{ gap: tokens.space[4] }}>
          <Card
            style={{
              backgroundColor: colors.statusDangerSurface,
              borderColor: colors.statusDangerBorder,
            }}
          >
            <Text style={{ fontSize: tokens.text.base, fontWeight: tokens.weight.semibold, color: colors.statusDangerText }}>
              {ptBR.failDelivery.confirmConsequencesTitle}
            </Text>
            <View style={{ marginTop: tokens.space[3], gap: tokens.space[2] }}>
              {[
                ptBR.failDelivery.confirmConsequence1,
                ptBR.failDelivery.confirmConsequence2,
                ptBR.failDelivery.confirmConsequence3,
                ptBR.failDelivery.confirmConsequence4,
              ].map((line) => (
                <Text key={line} style={{ color: colors.textSecondary, fontSize: tokens.text.sm, lineHeight: 20 }}>
                  • {line}
                </Text>
              ))}
            </View>
          </Card>
          <Card>
            <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, textTransform: 'uppercase' }}>
              {ptBR.failDelivery.confirmReasonLabel}
            </Text>
            <Text
              testID="fail-delivery-reason-preview"
              style={{ color: colors.textPrimary, fontSize: tokens.text.base, marginTop: tokens.space[2] }}
            >
              {trimmedReason}
            </Text>
          </Card>
          {error ? (
            <Text style={{ color: colors.statusDangerText, fontSize: tokens.text.sm }}>{error}</Text>
          ) : null}
        </View>
      )}
    </KeyboardFormScreen>
  );
}
