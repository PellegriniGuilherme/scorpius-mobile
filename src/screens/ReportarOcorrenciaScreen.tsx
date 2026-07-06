import { useEffect, useState } from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { KeyboardFormScreen } from '@/components/KeyboardFormScreen';
import { listDriverOccurrenceTypes, type DriverOccurrenceType } from '@/api/occurrenceTypes';
import { outbox } from '@/services/OutboxService';
import { syncWorker } from '@/services/SyncWorker';
import { useTheme } from '@/theme/ThemeProvider';
import type { AppStackParamList } from '@/navigation/types';

type Route_ = RouteProp<AppStackParamList, 'ReportarOcorrencia'>;

export function ReportarOcorrenciaScreen() {
  const route = useRoute<Route_>();
  const navigation = useNavigation();
  const { colors, tokens } = useTheme();
  const [types, setTypes] = useState<DriverOccurrenceType[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const data = await listDriverOccurrenceTypes(true);
        setTypes(data);
        setSelectedSlug(data[0]?.slug ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSubmit() {
    if (!selectedSlug) return;
    setSubmitting(true);
    try {
      const batchId = crypto.randomUUID();
      const localId = crypto.randomUUID();
      const occurredAt = new Date().toISOString();
      await outbox.enqueue('occurrence_report', {
        batchId,
        occurrence: {
          local_id: localId,
          delivery_id: route.params.deliveryId,
          type: selectedSlug,
          status: 'open',
          notes: notes.trim() || undefined,
          occurred_at: occurredAt,
        },
      });
      await syncWorker.tick();
      navigation.goBack();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardFormScreen
      contentContainerStyle={{ gap: tokens.space[4] }}
      footer={
        <Button
          label="Enviar"
          onPress={() => void handleSubmit()}
          loading={submitting}
          disabled={!selectedSlug}
          fullWidth
        />
      }
    >
      <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
        Reportar ocorrência
      </Text>

      <Card>
        <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs, marginBottom: tokens.space[2] }}>TIPO</Text>
        {types.map((t) => (
          <Button
            key={t.id}
            label={t.name}
            variant={selectedSlug === t.slug ? 'primary' : 'secondary'}
            onPress={() => setSelectedSlug(t.slug)}
            fullWidth
          />
        ))}
      </Card>

      <Card>
        <Input
          label="DESCRIÇÃO"
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Descreva o que aconteceu"
        />
      </Card>
    </KeyboardFormScreen>
  );
}
