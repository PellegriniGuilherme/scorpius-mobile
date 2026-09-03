import { useEffect, useState } from 'react';
import { ScrollView, Text, View, TextInput, Pressable } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { createOccurrence, listOccurrenceTypes, type OccurrenceType } from '@/api/occurrences';
import { useTheme } from '@/theme/ThemeProvider';
import type { AppStackParamList } from '@/navigation/types';

type Route_ = RouteProp<AppStackParamList, 'Ocorrencia'>;

export function OcorrenciaScreen() {
  const route = useRoute<Route_>();
  const { colors, tokens } = useTheme();
  const [types, setTypes] = useState<OccurrenceType[]>([]);
  const [scope, setScope] = useState<'delivery' | 'document'>('delivery');
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [documentId, setDocumentId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listOccurrenceTypes().then(setTypes).catch(() => undefined);
  }, []);

  const filteredTypes = types.filter((t) => {
    if (scope === 'delivery') return t.scope === 'delivery' || t.scope === 'both';
    return t.scope === 'document' || t.scope === 'both';
  });

  async function handleSubmit() {
    if (!selectedType || description.trim().length < 3) return;
    setError(null);
    try {
      await createOccurrence(route.params.deliveryId, {
        occurrence_type_id: selectedType,
        document_id: scope === 'document' && documentId ? Number(documentId) : undefined,
        description: description.trim(),
      });
      setSubmitted(true);
    } catch {
      setError('Não foi possível registrar a ocorrência.');
    }
  }

  if (submitted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: tokens.space[6], justifyContent: 'center' }}>
        <Text style={{ fontSize: tokens.text.xl, fontWeight: tokens.weight.bold, color: colors.statusSuccessText, textAlign: 'center' }}>
          Ocorrência registrada
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[4] }}>
        <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
          Reportar ocorrência
        </Text>

        <Card>
          <Text style={{ color: colors.textMuted, marginBottom: tokens.space[2] }}>Escopo</Text>
          <View style={{ flexDirection: 'row', gap: tokens.space[2] }}>
            {(['delivery', 'document'] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => setScope(s)}
                style={{
                  paddingHorizontal: tokens.space[3],
                  paddingVertical: tokens.space[2],
                  borderRadius: tokens.radius.md,
                  backgroundColor: scope === s ? colors.accent : colors.surfaceInset,
                }}
              >
                <Text style={{ color: scope === s ? colors.textOnAccent : colors.textSecondary }}>
                  {s === 'delivery' ? 'Entrega total' : 'Documento'}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {scope === 'document' && (
          <TextInput
            placeholder="ID do documento"
            placeholderTextColor={colors.textSubtle}
            value={documentId}
            onChangeText={setDocumentId}
            keyboardType="number-pad"
            style={{
              backgroundColor: colors.surfacePanel,
              color: colors.textPrimary,
              borderColor: colors.borderDefault,
              borderWidth: 1,
              borderRadius: tokens.radius.md,
              padding: tokens.space[3],
            }}
          />
        )}

        <Card>
          <Text style={{ color: colors.textMuted, marginBottom: tokens.space[2] }}>Tipo</Text>
          {filteredTypes.map((t) => (
            <Pressable key={t.id} onPress={() => setSelectedType(t.id)} style={{ paddingVertical: tokens.space[2] }}>
              <Text style={{ color: selectedType === t.id ? colors.accent : colors.textPrimary, fontWeight: selectedType === t.id ? tokens.weight.bold : tokens.weight.regular }}>
                {t.name}
              </Text>
            </Pressable>
          ))}
        </Card>

        <TextInput
          placeholder="Descreva a ocorrência"
          placeholderTextColor={colors.textSubtle}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={{
            backgroundColor: colors.surfacePanel,
            color: colors.textPrimary,
            borderColor: colors.borderDefault,
            borderWidth: 1,
            borderRadius: tokens.radius.md,
            padding: tokens.space[3],
            minHeight: 100,
            textAlignVertical: 'top',
          }}
        />

        {error && <Text style={{ color: colors.statusDangerText }}>{error}</Text>}

        <Button label="Enviar ocorrência" onPress={() => void handleSubmit()} fullWidth />
      </ScrollView>
    </ScrollView>
  );
}
