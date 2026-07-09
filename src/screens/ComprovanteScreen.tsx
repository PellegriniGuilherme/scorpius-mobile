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

type OutboxSyncStatus = 'idle' | 'pending' | 'failed';

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
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [outboxId, setOutboxId] = useState<number | null>(null);
  const [syncStatus, setSyncStatus] = useState<OutboxSyncStatus>('idle');
  const [submitted, setSubmitted] = useState(false);
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

  async function handleSubmit() {
    if (!canSubmit) return;
    let signaturePath: string | undefined;
    if (requiresSignature && hasSignature) {
      signaturePath = await persistSignatureImage();
    }
    const id = await outbox.enqueue('proof_upload', {
      deliveryId: delivery.id,
      ...(photoPath ? { photoPath } : {}),
      ...(signaturePath ? { signaturePath } : {}),
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
      setSyncStatus('pending'); // Saiu, mas ainda mostra "Sincronizando" brevemente
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
        {syncStatus === 'pending' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space[2], marginTop: tokens.space[4] }}>
            <ActivityIndicator color={colors.accent} size="small" />
            <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm }}>Sincronizando com servidor…</Text>
          </View>
        )}
        {syncStatus === 'failed' && (
          <View style={{ marginTop: tokens.space[4], gap: tokens.space[2] }}>
            <Text style={{ color: colors.statusDangerText, fontSize: tokens.text.sm, textAlign: 'center' }}>
              Falhou ao enviar. Tente novamente.
            </Text>
            <Button label="Reenviar" variant="secondary" onPress={handleRetry} />
          </View>
        )}
      </View>
    );
  }

  return (
    <>
      <KeyboardFormScreen
        contentContainerStyle={{ gap: tokens.space[5] }}
        footer={
          <Button label={ptBR.proof.submit} onPress={handleSubmit} disabled={!canSubmit} fullWidth />
        }
      >
        <View style={{ gap: tokens.space[1] }}>
          <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
            {ptBR.proof.title}
          </Text>
          <Text style={{ fontSize: tokens.text.sm, color: colors.textMuted }}>Entrega #{delivery.code}</Text>
        </View>

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
