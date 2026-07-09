/**
 * Scorpius Move — Comprovante de entrega (F2.10 outbox).
 *
 * Fluxo:
 *  1. Motorista tira foto do pacote (expo-image-picker) →
 *     salva em cache local (expo-file-system)
 *  2. Digita nome do destinatário (signature)
 *  3. Tap "Confirmar entrega" → enqueue no OutboxService
 *  4. SyncWorker (background) faz upload para backend via apiClient
 *  5. Sucesso → markDone + tela de sucesso
 *  6. Falha (após MAX_ATTEMPTS) → DLQ + badge "Falhou — Tentar novamente"
 *
 * Em Expo Web (sessão atual): expo-image-picker mockado para retornar
 * canceled=true (não há câmera real no web). O placeholder visual
 * "Aguardando captura" continua aparecendo.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Text, View, ActivityIndicator, Modal, Pressable, ScrollView, Image } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { AlertBanner } from '@/components/AlertBanner';
import { Input } from '@/components/Input';
import { SignaturePad, type SignaturePadRef } from '@/components/SignaturePad';
import { KeyboardFormScreen } from '@/components/KeyboardFormScreen';
import { fetchDeliveryWithCache } from '@/services/deliveryService';
import { mapDelivery } from '@/lib/mapDelivery';
import type { DeliveryViewModel } from '@/types/delivery';
import { outbox, type OutboxItem } from '@/services/OutboxService';
import { syncWorker } from '@/services/SyncWorker';
import { applyOptimisticAction } from '@/services/deliveryMutationService';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AppStackParamList } from '@/navigation/types';

type Route_ = RouteProp<AppStackParamList, 'Comprovante'>;

type OutboxSyncStatus = 'idle' | 'pending' | 'failed' | 'confirmed';
type ProofPhase = 'capture' | 'confirm';

export function ComprovanteScreen() {
  const route = useRoute<Route_>();
  const { colors, tokens } = useTheme();
  const [delivery, setDelivery] = useState<DeliveryViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void (async () => {
      const res = await fetchDeliveryWithCache(route.params.deliveryId);
      setDelivery(res.data ? mapDelivery(res.data) : null);
      setLoading(false);
    })();
  }, [route.params.deliveryId]);

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

  return <ComprovanteScreenInner delivery={delivery} />;
}

function ComprovanteScreenInner({ delivery }: { delivery: DeliveryViewModel }) {
  const { colors, tokens } = useTheme();
  const signaturePadRef = useRef<SignaturePadRef>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [outboxId, setOutboxId] = useState<number | null>(null);
  const [syncStatus, setSyncStatus] = useState<OutboxSyncStatus>('idle');
  const [submitted, setSubmitted] = useState(false);
  const [phase, setPhase] = useState<ProofPhase>('capture');
  const [capturing, setCapturing] = useState(false);

  // T098 — DLQ UI: badge + modal com items falhados + retry manual
  const [dlqCount, setDlqCount] = useState(0);
  const [dlqModalOpen, setDlqModalOpen] = useState(false);
  const [dlqItems, setDlqItems] = useState<OutboxItem[]>([]);

  const refreshDlq = useCallback(async () => {
    const count = await outbox.getDLQCount();
    setDlqCount(count);
  }, []);

  useEffect(() => {
    void refreshDlq();
  }, [refreshDlq]);

  async function openDlqModal() {
    const items = await outbox.getDLQItems();
    setDlqItems(items);
    setDlqModalOpen(true);
  }

  async function handleRetryDLQ(itemId: number) {
    await outbox.retryDLQ(itemId);
    try {
      await syncWorker.tick();
    } catch {
      // ignore
    }
    await refreshDlq();
    const items = await outbox.getDLQItems();
    setDlqItems(items);
  }

  const requiresPhoto = delivery.proofRequirements.requires_photo;
  const requiresSignature = delivery.proofRequirements.requires_signature;
  const showPhotoSection = requiresPhoto;
  const showSignatureSection = requiresSignature;

  const hasPhoto = !!photoPath;
  const canSubmit =
    (!requiresPhoto || hasPhoto) &&
    (!requiresSignature || (hasSignature && signatureName.trim().length >= 3));

  const missingHint = !canSubmit
    ? requiresPhoto && !hasPhoto
      ? ptBR.proof.missingPhoto
      : requiresSignature && (!hasSignature || signatureName.trim().length < 3)
        ? ptBR.proof.missingSignature
        : null
    : null;

  async function persistSignatureImage(): Promise<string> {
    const capturedUri = await signaturePadRef.current?.captureToCacheFile(`sig-${delivery.id}`);
    if (!capturedUri) throw new Error('signature_capture_failed');

    const proofsDir = new FileSystem.Directory(FileSystem.Paths.cache, 'proofs');
    try {
      await proofsDir.create({ intermediates: true });
    } catch {
      // diretório já existe
    }
    const srcFile = new FileSystem.File(capturedUri);
    const dstFile = new FileSystem.File(proofsDir, `${delivery.id}-sig-${Date.now()}.png`);
    await srcFile.copy(dstFile);
    return dstFile.uri;
  }

  async function handleCapturePhoto() {
    if (capturing) return;
    const deliveryId = delivery.id;
    setCapturing(true);
    try {
      // expo-image-picker.launchCameraAsync abre a câmera nativa.
      // No Expo Web (mock) retorna canceled=true. Em iOS/Android
      // retorna { canceled: false, assets: [{ uri: 'file://...' }] }.
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      // Copia para cache local persistente (sobrevive a reload do app).
      // T115 SDK 56: expo-file-system reverteu para class API (Paths/File/Directory).
      // Migration de v18 top-level functions → v17-style class API.
      const src = result.assets[0].uri;
      const proofsDirInstance = new FileSystem.Directory(FileSystem.Paths.cache, 'proofs');
      try {
        await proofsDirInstance.create({ intermediates: true });
      } catch {
        // diretório já existe — no-op
      }
      const srcFile = new FileSystem.File(src);
      const dstFile = new FileSystem.File(proofsDirInstance, `${deliveryId}-${Date.now()}.jpg`);
      await srcFile.copy(dstFile);
      setPhotoPath(dstFile.uri);
    } finally {
      setCapturing(false);
    }
  }

  async function handleReview() {
    if (!canSubmit) return;
    if (requiresSignature && hasSignature) {
      const captured = await persistSignatureImage();
      setSignaturePath(captured);
    }
    setPhase('confirm');
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    const resolvedSignaturePath =
      signaturePath ?? (requiresSignature && hasSignature ? await persistSignatureImage() : undefined);
    const id = await outbox.enqueue('proof_upload', {
      deliveryId: delivery.id,
      ...(photoPath ? { photoPath } : {}),
      ...(resolvedSignaturePath ? { signaturePath: resolvedSignaturePath } : {}),
      ...(signatureName.trim() ? { signatureName: signatureName.trim() } : {}),
      requiresPhoto,
      requiresSignature,
    });
    await applyOptimisticAction({ deliveryId: delivery.id, action: 'complete' });
    setOutboxId(id);
    setSyncStatus('pending');
    setSubmitted(true);
    // Tenta sincronizar imediatamente (SyncWorker.tick é idempotente
    // e respeita o estado online/inactive)
    try {
      await syncWorker.tick();
    } catch {
      // Falha silenciosa — outbox já registrou, próximo tick vai tentar
    }
    // Re-checa status após tick (se sucesso, item removido)
    const items = await outbox.getAll();
    const stillThere = items.find((i) => i.id === id);
    if (stillThere) {
      setSyncStatus(stillThere.next_retry_at === 0 ? 'failed' : 'pending');
    } else {
      setSyncStatus('confirmed');
    }
  }

  async function handleRetry() {
    if (!outboxId) return;
    // T098 — usa retryDLQ: zera attempts + next_retry_at + last_error.
    // Pré-condição: outboxId está na DLQ (next_retry_at = 0).
    await outbox.retryDLQ(outboxId);
    await refreshDlq();
    setSyncStatus('pending');
    try {
      await syncWorker.tick();
    } catch {
      // ignore
    }
  }

  if (submitted) {
    const successTitle =
      syncStatus === 'confirmed'
        ? ptBR.proof.successTitleConfirmed
        : syncStatus === 'failed'
          ? ptBR.proof.successTitleQueued
          : ptBR.proof.successTitleQueued;
    const successDesc =
      syncStatus === 'confirmed'
        ? ptBR.proof.successDescConfirmed
        : syncStatus === 'failed'
          ? ptBR.proof.syncFailed
          : ptBR.proof.successDescQueued;

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
          {successTitle}
        </Text>
        <Text style={{ fontSize: tokens.text.base, color: colors.textMuted, textAlign: 'center', lineHeight: 22 }}>
          {successDesc}
        </Text>
        {syncStatus === 'pending' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space[2], marginTop: tokens.space[4] }}>
            <ActivityIndicator color={colors.accent} size="small" />
            <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm }}>{ptBR.proof.syncPending}</Text>
          </View>
        )}
        {syncStatus === 'failed' && (
          <View style={{ marginTop: tokens.space[4], gap: tokens.space[2], width: '100%' }}>
            <AlertBanner tone="danger" message={ptBR.proof.syncFailed} testID="proof-sync-failed-banner" />
            <Button label={ptBR.proof.retry} variant="secondary" onPress={handleRetry} fullWidth />
          </View>
        )}
        {syncStatus === 'confirmed' && (
          <AlertBanner tone="success" message={ptBR.proof.successDescConfirmed} testID="proof-sync-confirmed-banner" />
        )}
      </View>
    );
  }

  if (phase === 'confirm') {
    return (
      <KeyboardFormScreen
        contentContainerStyle={{ gap: tokens.space[5] }}
        footer={
          <View style={{ gap: tokens.space[3] }}>
            <Button
              testID="proof-confirm-submit"
              label={ptBR.proof.confirmActionExplicit}
              onPress={() => void handleSubmit()}
              fullWidth
            />
            <Button
              testID="proof-confirm-back"
              label={ptBR.proof.back}
              variant="ghost"
              onPress={() => setPhase('capture')}
              fullWidth
            />
          </View>
        }
      >
        <View style={{ gap: tokens.space[1] }}>
          <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
            {ptBR.proof.confirmTitle}
          </Text>
          <Text style={{ fontSize: tokens.text.sm, color: colors.textMuted }}>Entrega #{delivery.code}</Text>
        </View>

        <Card
          style={{
            backgroundColor: colors.statusWarningSurface,
            borderColor: colors.statusWarningBorder,
          }}
        >
          <Text style={{ fontSize: tokens.text.base, fontWeight: tokens.weight.semibold, color: colors.statusWarningText }}>
            {ptBR.proof.confirmConsequencesTitle}
          </Text>
          <View style={{ marginTop: tokens.space[3], gap: tokens.space[2] }}>
            {[
              ptBR.proof.confirmConsequence1,
              ptBR.proof.confirmConsequence2,
              ptBR.proof.confirmConsequence3,
              ptBR.proof.confirmConsequence4,
            ].map((line) => (
              <Text key={line} style={{ color: colors.textSecondary, fontSize: tokens.text.sm, lineHeight: 20 }}>
                • {line}
              </Text>
            ))}
          </View>
        </Card>

        {(requiresPhoto || requiresSignature) && (
          <Card>
            <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, textTransform: 'uppercase' }}>
              Comprovante
            </Text>
            <View style={{ marginTop: tokens.space[2], gap: tokens.space[1] }}>
              {requiresPhoto ? (
                <Text style={{ color: colors.textPrimary, fontSize: tokens.text.sm }}>
                  {hasPhoto ? '✓ Foto capturada' : '✗ Foto pendente'}
                </Text>
              ) : null}
              {requiresSignature ? (
                <Text style={{ color: colors.textPrimary, fontSize: tokens.text.sm }}>
                  {hasSignature && signatureName.trim().length >= 3
                    ? `✓ Assinatura de ${signatureName.trim()}`
                    : '✗ Assinatura pendente'}
                </Text>
              ) : null}
            </View>
          </Card>
        )}
      </KeyboardFormScreen>
    );
  }

  return (
    <>
      <KeyboardFormScreen
        contentContainerStyle={{ gap: tokens.space[5] }}
        footer={
          <View style={{ gap: tokens.space[2] }}>
            {missingHint ? (
              <Text style={{ color: colors.statusWarningText, fontSize: tokens.text.sm, textAlign: 'center' }}>
                {missingHint}
              </Text>
            ) : null}
            <Button
              testID="proof-review"
              label={ptBR.proof.review}
              onPress={() => void handleReview()}
              disabled={!canSubmit}
              fullWidth
            />
          </View>
        }
      >
        <View style={{ gap: tokens.space[1] }}>
          <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
            {ptBR.proof.title}
          </Text>
          <Text style={{ fontSize: tokens.text.sm, color: colors.textMuted }}>Entrega #{delivery.code}</Text>
        </View>

        <AlertBanner tone="warning" title={ptBR.proof.confirmConsequencesTitle} message={ptBR.proof.formHint} testID="proof-form-warning" />

        {dlqCount > 0 && (
          <Pressable
            testID="dlq-badge"
            accessibilityRole="button"
            accessibilityLabel={`${dlqCount} ${dlqCount === 1 ? 'item na DLQ' : 'itens na DLQ'}`}
            onPress={openDlqModal}
            style={{
              backgroundColor: colors.statusDangerSurface,
              borderColor: colors.statusDangerBorder,
              borderWidth: 1,
              borderRadius: tokens.radius.md,
              padding: tokens.space[3],
              flexDirection: 'row',
              alignItems: 'center',
              gap: tokens.space[2],
            }}
          >
            <Text style={{ fontSize: 20, color: colors.statusDangerMarker }}>⚠</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.statusDangerText, fontWeight: tokens.weight.semibold, fontSize: tokens.text.sm }}>
                {dlqCount} {dlqCount === 1 ? 'item falhou' : 'itens falharam'}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs }}>
                Toque para ver e reenviar
              </Text>
            </View>
          </Pressable>
        )}

        {!showPhotoSection && !showSignatureSection && (
          <Card>
            <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm, lineHeight: 20 }}>
              {ptBR.proof.noProofRequired}
            </Text>
          </Card>
        )}

        {showPhotoSection && (
        <Card>
          <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, fontWeight: tokens.weight.medium, textTransform: 'uppercase' }}>
            {ptBR.proof.photoLabel} {ptBR.proof.requiredSuffix}
          </Text>
          <View
            style={{
              marginTop: tokens.space[3],
              height: 220,
              backgroundColor: colors.surfaceInset,
              borderColor: hasPhoto ? colors.statusSuccessBorder : colors.borderDefault,
              borderWidth: 2,
              borderRadius: tokens.radius.md,
              borderStyle: hasPhoto ? 'solid' : 'dashed',
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {hasPhoto && photoPath ? (
              <Image
                testID="proof-photo-preview"
                source={{ uri: photoPath }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
                accessibilityLabel="Pré-visualização da foto do pacote"
              />
            ) : (
              <View style={{ alignItems: 'center', gap: tokens.space[2], padding: tokens.space[4] }}>
                <Text style={{ fontSize: 48, color: colors.textSubtle }}>📷</Text>
                <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm, textAlign: 'center' }}>
                  {ptBR.proof.waitingPhoto}
                </Text>
              </View>
            )}
          </View>
          <View style={{ marginTop: tokens.space[3] }}>
            <Button
              label={hasPhoto ? ptBR.proof.retakePhoto : capturing ? 'Abrindo câmera…' : ptBR.proof.capturePhoto}
              variant={hasPhoto ? 'ghost' : 'secondary'}
              onPress={handleCapturePhoto}
              loading={capturing}
              disabled={capturing}
              fullWidth
            />
          </View>
        </Card>
        )}

        {showSignatureSection && (
        <Card>
          <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, fontWeight: tokens.weight.medium, textTransform: 'uppercase' }}>
            {ptBR.proof.signatureAreaLabel} {ptBR.proof.requiredSuffix}
          </Text>
          <View style={{ gap: tokens.space[2], marginTop: tokens.space[3] }}>
            <SignaturePad
              ref={signaturePadRef}
              testID="proof-signature-pad"
              onChange={setHasSignature}
            />
            <Button
              label={ptBR.proof.clearSignature}
              variant="ghost"
              onPress={() => signaturePadRef.current?.clear()}
              disabled={!hasSignature}
              fullWidth
            />
            <Input
              label={ptBR.proof.signatureLabel}
              hint={ptBR.proof.signatureAreaHint}
              placeholder="Ex.: Maria Santos"
              value={signatureName}
              onChangeText={setSignatureName}
            />
          </View>
        </Card>
        )}

        {(showPhotoSection || showSignatureSection) && (
        <Card>
          <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs, lineHeight: 18 }}>{ptBR.proof.placeholder}</Text>
        </Card>
        )}
      </KeyboardFormScreen>

      <Modal
        testID="dlq-modal"
        visible={dlqModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDlqModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: tokens.radius.lg,
              borderTopRightRadius: tokens.radius.lg,
              padding: tokens.space[6],
              gap: tokens.space[4],
              maxHeight: '80%',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: tokens.text.xl, fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
                Itens que falharam
              </Text>
              <Pressable
                testID="dlq-close"
                accessibilityRole="button"
                accessibilityLabel="Fechar"
                onPress={() => setDlqModalOpen(false)}
              >
                <Text style={{ fontSize: tokens.text.xl, color: colors.textMuted }}>✕</Text>
              </Pressable>
            </View>

            {dlqItems.length === 0 ? (
              <Text style={{ color: colors.textMuted, textAlign: 'center', paddingVertical: tokens.space[6] }}>
                Nenhum item na DLQ.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ gap: tokens.space[3] }}>
                {dlqItems.map((item) => {
                  const payload = item.payload as { deliveryId?: number; signatureName?: string };
                  return (
                    <View
                      key={item.id}
                      testID={`dlq-item-${item.id}`}
                      style={{
                        backgroundColor: colors.surfacePanel,
                        borderColor: colors.statusDangerBorder,
                        borderWidth: 1,
                        borderRadius: tokens.radius.md,
                        padding: tokens.space[3],
                        gap: tokens.space[2],
                      }}
                    >
                      <Text style={{ color: colors.textPrimary, fontWeight: tokens.weight.semibold }}>
                        Entrega #{payload.deliveryId ?? '?'}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs }}>
                        Tentativas: {item.attempts} • {payload.signatureName ?? 'sem assinatura'}
                      </Text>
                      {item.last_error && (
                        <Text
                          style={{ color: colors.statusDangerText, fontSize: tokens.text.xs }}
                          numberOfLines={2}
                        >
                          {item.last_error}
                        </Text>
                      )}
                      <View testID={`dlq-retry-${item.id}`}>
                        <Button
                          label="Tentar novamente"
                          variant="secondary"
                          onPress={() => handleRetryDLQ(item.id)}
                          fullWidth
                        />
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}
