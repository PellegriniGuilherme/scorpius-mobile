import { useState } from 'react';
import { ScrollView, Text, View, TextInput } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { deliverDocument } from '@/api/documents';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AppStackParamList } from '@/navigation/types';

type Route_ = RouteProp<AppStackParamList, 'Comprovante'>;

export function ComprovanteScreen() {
  const route = useRoute<Route_>();
  const { colors, tokens } = useTheme();
  const documentId = route.params.documentId;

  const [photoCaptured, setPhotoCaptured] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = photoCaptured && signatureName.trim().length >= 3;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await deliverDocument(documentId, {
        photo_url: photoCaptured ? `demo://photo/${documentId}` : undefined,
        recipient_name: signatureName.trim(),
        notes: 'Comprovante via app mobile',
      });
      setSubmitted(true);
    } catch {
      setError('Não foi possível confirmar a entrega. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

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
          Documento #{documentId} entregue com sucesso.
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
          <Text style={{ fontSize: tokens.text.sm, color: colors.textMuted }}>Documento #{documentId}</Text>
        </View>

        <Card>
          <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, fontWeight: tokens.weight.medium, textTransform: 'uppercase' }}>
            {ptBR.proof.photoLabel}
          </Text>
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
          <TextInput
            accessibilityLabel={ptBR.proof.signatureLabel}
            placeholder="Nome do destinatário"
            placeholderTextColor={colors.textSubtle}
            value={signatureName}
            onChangeText={setSignatureName}
            style={{
              marginTop: tokens.space[3],
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
        </Card>

        {error && <Text style={{ color: colors.statusDangerText }}>{error}</Text>}

        <Button
          label={submitting ? 'Enviando...' : ptBR.proof.submit}
          onPress={() => void handleSubmit()}
          disabled={!canSubmit || submitting}
          fullWidth
        />
      </ScrollView>
    </ScrollView>
  );
}
