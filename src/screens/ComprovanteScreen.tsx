import { useState } from 'react';
import { ScrollView, Text, View, TextInput } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { findDelivery } from '@/mocks/deliveries';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AppStackParamList } from '@/navigation/types';

type Route_ = RouteProp<AppStackParamList, 'Comprovante'>;

export function ComprovanteScreen() {
  const route = useRoute<Route_>();
  const { colors, tokens } = useTheme();
  const delivery = findDelivery(route.params.deliveryId);

  const [photoCaptured, setPhotoCaptured] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!delivery) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: tokens.space[6] }}>
        <Text style={{ color: colors.textMuted }}>Entrega não encontrada.</Text>
      </View>
    );
  }

  const canSubmit = photoCaptured && signatureName.trim().length >= 3;

  if (submitted) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          padding: tokens.space[6],
          justifyContent: 'center',
          alignItems: 'center',
          gap: tokens.space[4],
        }}
      >
        <Text style={{ fontSize: 60, color: colors.statusSuccessMarker, fontWeight: tokens.weight.bold }}>✓</Text>
        <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.statusSuccessText, textAlign: 'center' }}>
          {ptBR.proof.successTitle}
        </Text>
        <Text style={{ fontSize: tokens.text.base, color: colors.textMuted, textAlign: 'center' }}>
          {ptBR.proof.successDesc}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[5] }}>
        <View style={{ gap: tokens.space[1] }}>
          <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
            {ptBR.proof.title}
          </Text>
          <Text style={{ fontSize: tokens.text.sm, color: colors.textMuted }}>Entrega #{delivery.code}</Text>
        </View>

        <Card>
          <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, fontWeight: tokens.weight.medium, textTransform: 'uppercase' }}>
            {ptBR.proof.photoLabel}
          </Text>
          <View
            style={{
              marginTop: tokens.space[3],
              height: 180,
              backgroundColor: photoCaptured ? colors.statusSuccessSurface : colors.surfaceInset,
              borderColor: photoCaptured ? colors.statusSuccessBorder : colors.borderDefault,
              borderWidth: 2,
              borderRadius: tokens.radius.md,
              borderStyle: photoCaptured ? 'solid' : 'dashed',
              alignItems: 'center',
              justifyContent: 'center',
              gap: tokens.space[2],
            }}
          >
            {photoCaptured ? (
              <>
                <Text style={{ fontSize: 48, color: colors.statusSuccessMarker }}>📷</Text>
                <Text style={{ color: colors.statusSuccessText, fontWeight: tokens.weight.semibold }}>Foto capturada</Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 48, color: colors.textSubtle }}>📷</Text>
                <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm }}>Aguardando captura</Text>
              </>
            )}
          </View>
          <View style={{ marginTop: tokens.space[3] }}>
            <Button
              label={photoCaptured ? ptBR.proof.retakePhoto : ptBR.proof.capturePhoto}
              variant={photoCaptured ? 'ghost' : 'secondary'}
              onPress={() => setPhotoCaptured(true)}
              fullWidth
            />
          </View>
        </Card>

        <Card>
          <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, fontWeight: tokens.weight.medium, textTransform: 'uppercase' }}>
            {ptBR.proof.signatureLabel}
          </Text>
          <View style={{ marginTop: tokens.space[3], gap: tokens.space[2] }}>
            <View
              style={{
                height: 80,
                backgroundColor: colors.surfaceInset,
                borderColor: colors.borderDefault,
                borderWidth: 1,
                borderRadius: tokens.radius.md,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: tokens.font.mono, fontStyle: 'italic', fontSize: tokens.text['2xl'], color: signatureName ? colors.textPrimary : colors.textSubtle }}>
                {signatureName || '— área de assinatura —'}
              </Text>
            </View>
            <TextInput
              accessibilityLabel={ptBR.proof.signatureLabel}
              placeholder="Nome do destinatário"
              placeholderTextColor={colors.textSubtle}
              value={signatureName}
              onChangeText={setSignatureName}
              style={{
                backgroundColor: colors.surfacePanel,
                color: colors.textPrimary,
                borderColor: colors.borderDefault,
                borderWidth: 1,
                borderRadius: tokens.radius.md,
                paddingHorizontal: tokens.space[3],
                paddingVertical: tokens.space[2],
                fontSize: tokens.text.base,
              }}
            />
          </View>
        </Card>

        <Button label={ptBR.proof.submit} onPress={() => setSubmitted(true)} disabled={!canSubmit} fullWidth />

        <Card>
          <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs, lineHeight: 18 }}>{ptBR.proof.placeholder}</Text>
        </Card>
      </ScrollView>
    </ScrollView>
  );
}
