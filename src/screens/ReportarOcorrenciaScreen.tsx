import { useEffect, useMemo, useState } from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { AlertBanner } from '@/components/AlertBanner';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { KeyboardFormScreen } from '@/components/KeyboardFormScreen';
import type { DriverOccurrenceType } from '@/api/occurrenceTypes';
import { fetchOccurrenceTypesWithCache } from '@/services/occurrenceTypeService';
import { outbox } from '@/services/OutboxService';
import { syncWorker } from '@/services/SyncWorker';
import { generateUuid } from '@/lib/uuid';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AppStackParamList } from '@/navigation/types';

type Route_ = RouteProp<AppStackParamList, 'ReportarOcorrencia'>;
type OccurrencePhase = 'form' | 'confirm';

export function ReportarOcorrenciaScreen() {
  const route = useRoute<Route_>();
  const navigation = useNavigation();
  const { colors, tokens } = useTheme();
  const [types, setTypes] = useState<DriverOccurrenceType[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<OccurrencePhase>('form');
  const [fromCache, setFromCache] = useState(false);

  const selectedType = useMemo(
    () => types.find((t) => t.slug === selectedSlug) ?? null,
    [types, selectedSlug],
  );
  const requiresPhoto = selectedType?.requires_photo ?? false;
  const hasPhoto = !!photoPath;
  const canSubmit = !!selectedSlug && (!requiresPhoto || hasPhoto);
  const missingHint = !canSubmit && requiresPhoto && !hasPhoto ? ptBR.occurrence.missingPhoto : null;

  useEffect(() => {
    void (async () => {
      try {
        const { data, fromCache: cached } = await fetchOccurrenceTypesWithCache(true);
        setTypes(data);
        setFromCache(cached);
        setSelectedSlug(data[0]?.slug ?? null);
        if (data.length === 0) setLoadError(true);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!requiresPhoto) {
      setPhotoPath(null);
    }
  }, [requiresPhoto]);

  async function handleCapturePhoto() {
    if (capturing) return;
    const deliveryId = route.params.deliveryId;
    setCapturing(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const src = result.assets[0].uri;
      const photosDir = new FileSystem.Directory(FileSystem.Paths.cache, 'occurrences');
      try {
        await photosDir.create({ intermediates: true });
      } catch {
        // diretório já existe
      }
      const srcFile = new FileSystem.File(src);
      const dstFile = new FileSystem.File(photosDir, `${deliveryId}-${Date.now()}.jpg`);
      await srcFile.copy(dstFile);
      setPhotoPath(dstFile.uri);
    } finally {
      setCapturing(false);
    }
  }

  async function handleSubmit() {
    if (!canSubmit || !selectedSlug) return;
    setSubmitting(true);
    try {
      const batchId = generateUuid();
      const localId = generateUuid();
      const occurredAt = new Date().toISOString();
      await outbox.enqueue('occurrence_report', {
        batchId,
        photoPath: requiresPhoto ? photoPath ?? undefined : undefined,
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

  if (loadError || types.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: tokens.space[6], justifyContent: 'center' }}>
        <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
          {loadError ? ptBR.occurrence.loadError : ptBR.occurrence.emptyTypes}
        </Text>
      </View>
    );
  }

  if (phase === 'confirm') {
    return (
      <KeyboardFormScreen
        contentContainerStyle={{ gap: tokens.space[4] }}
        footer={
          <View style={{ gap: tokens.space[3] }}>
            <Button
              testID="occurrence-confirm-submit"
              label={ptBR.occurrence.confirmActionExplicit}
              onPress={() => void handleSubmit()}
              loading={submitting}
              fullWidth
            />
            <Button
              testID="occurrence-confirm-back"
              label={ptBR.occurrence.back}
              variant="ghost"
              onPress={() => setPhase('form')}
              disabled={submitting}
              fullWidth
            />
          </View>
        }
      >
        <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
          {ptBR.occurrence.confirmTitle}
        </Text>

        <Card
          style={{
            backgroundColor: colors.statusInfoSurface,
            borderColor: colors.statusInfoBorder,
          }}
        >
          <Text style={{ fontSize: tokens.text.base, fontWeight: tokens.weight.semibold, color: colors.statusInfoText }}>
            {ptBR.occurrence.confirmConsequencesTitle}
          </Text>
          <View style={{ marginTop: tokens.space[3], gap: tokens.space[2] }}>
            {[ptBR.occurrence.confirmConsequence1, ptBR.occurrence.confirmConsequence2, ptBR.occurrence.confirmConsequence3].map(
              (line) => (
                <Text key={line} style={{ color: colors.textSecondary, fontSize: tokens.text.sm, lineHeight: 20 }}>
                  • {line}
                </Text>
              ),
            )}
          </View>
        </Card>

        <Card>
          <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, textTransform: 'uppercase' }}>
            {ptBR.occurrence.typeLabel}
          </Text>
          <Text style={{ color: colors.textPrimary, fontSize: tokens.text.base, marginTop: tokens.space[2] }}>
            {selectedType?.name ?? '—'}
          </Text>
          {notes.trim() ? (
            <>
              <Text
                style={{
                  fontSize: tokens.text.xs,
                  color: colors.textMuted,
                  textTransform: 'uppercase',
                  marginTop: tokens.space[4],
                }}
              >
                {ptBR.occurrence.descriptionLabel}
              </Text>
              <Text style={{ color: colors.textPrimary, fontSize: tokens.text.sm, marginTop: tokens.space[2] }}>
                {notes.trim()}
              </Text>
            </>
          ) : null}
          {requiresPhoto ? (
            <Text style={{ color: colors.textSecondary, fontSize: tokens.text.sm, marginTop: tokens.space[3] }}>
              {hasPhoto ? '✓ Foto anexada' : '✗ Foto pendente'}
            </Text>
          ) : null}
        </Card>
      </KeyboardFormScreen>
    );
  }

  return (
    <KeyboardFormScreen
      contentContainerStyle={{ gap: tokens.space[4] }}
      footer={
        <View style={{ gap: tokens.space[2] }}>
          {missingHint ? (
            <Text style={{ color: colors.statusWarningText, fontSize: tokens.text.sm, textAlign: 'center' }}>
              {missingHint}
            </Text>
          ) : null}
          <Button
            testID="occurrence-review"
            label={ptBR.occurrence.review}
            onPress={() => setPhase('confirm')}
            disabled={!canSubmit}
            fullWidth
          />
        </View>
      }
    >
      <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
        {ptBR.occurrence.title}
      </Text>

      <AlertBanner
        tone="info"
        title={ptBR.occurrence.infoBannerTitle}
        message={ptBR.occurrence.infoBannerBody}
        testID="occurrence-info-banner"
      />

      {fromCache && (
        <AlertBanner tone="warning" message={ptBR.occurrence.offlineTypes} testID="occurrence-offline-banner" />
      )}

      <Card>
        <Select
          label={ptBR.occurrence.typeLabel}
          value={selectedSlug}
          options={types.map((t) => ({ value: t.slug, label: t.name }))}
          onChange={setSelectedSlug}
          placeholder={ptBR.occurrence.typePlaceholder}
          testID="occurrence-type"
        />
      </Card>

      {requiresPhoto && (
        <>
          <AlertBanner tone="warning" message={ptBR.occurrence.photoTypeWarning} testID="occurrence-photo-warning" />
          <Card>
            <Text
              style={{
                fontSize: tokens.text.xs,
                color: colors.textMuted,
                fontWeight: tokens.weight.medium,
                textTransform: 'uppercase',
              }}
            >
              {ptBR.occurrence.photoLabel}
            </Text>
            <View
              style={{
                marginTop: tokens.space[3],
                height: 180,
                backgroundColor: hasPhoto ? colors.statusSuccessSurface : colors.surfaceInset,
                borderColor: hasPhoto ? colors.statusSuccessBorder : colors.borderDefault,
                borderWidth: 2,
                borderRadius: tokens.radius.md,
                borderStyle: hasPhoto ? 'solid' : 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
                gap: tokens.space[2],
              }}
            >
              {hasPhoto ? (
                <>
                  <Text style={{ fontSize: 48, color: colors.statusSuccessMarker }}>📷</Text>
                  <Text style={{ color: colors.statusSuccessText, fontWeight: tokens.weight.semibold }}>
                    {ptBR.occurrence.photoCaptured}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 48, color: colors.textSubtle }}>📷</Text>
                  <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm }}>
                    {ptBR.occurrence.photoRequired}
                  </Text>
                </>
              )}
            </View>
            <View style={{ marginTop: tokens.space[3] }}>
              <Button
                label={
                  hasPhoto
                    ? ptBR.occurrence.retakePhoto
                    : capturing
                      ? ptBR.occurrence.openingCamera
                      : ptBR.occurrence.capturePhoto
                }
                variant={hasPhoto ? 'ghost' : 'secondary'}
                onPress={handleCapturePhoto}
                loading={capturing}
                disabled={capturing}
                fullWidth
                testID="occurrence-capture-photo"
              />
            </View>
          </Card>
        </>
      )}

      <Card>
        <Input
          label={ptBR.occurrence.descriptionLabel}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder={ptBR.occurrence.descriptionPlaceholder}
        />
      </Card>
    </KeyboardFormScreen>
  );
}
