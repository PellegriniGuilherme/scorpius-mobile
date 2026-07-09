import { Modal, Pressable, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { AlertBanner } from '@/components/AlertBanner';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';

export type ConfirmDialogVariant = 'default' | 'danger';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  description?: string;
  warning?: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

export function ConfirmDialog({
  visible,
  title,
  description,
  warning,
  confirmLabel,
  cancelLabel = ptBR.common.cancel,
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
  testID = 'confirm-dialog',
}: ConfirmDialogProps) {
  const { colors, tokens } = useTheme();

  return (
    <Modal
      testID={testID}
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => !loading && onCancel()}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          padding: tokens.space[6],
        }}
        onPress={() => !loading && onCancel()}
        accessibilityRole="button"
        accessibilityLabel="Fechar diálogo"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.background,
            borderRadius: tokens.radius.lg,
            padding: tokens.space[6],
            gap: tokens.space[4],
            borderWidth: 1,
            borderColor: colors.borderDefault,
          }}
        >
          <Text
            style={{
              fontSize: tokens.text.xl,
              fontWeight: tokens.weight.bold,
              color: colors.textPrimary,
            }}
          >
            {title}
          </Text>

          {description ? (
            <Text style={{ fontSize: tokens.text.sm, color: colors.textSecondary, lineHeight: 20 }}>
              {description}
            </Text>
          ) : null}

          {warning ? <AlertBanner tone="warning" message={warning} testID={`${testID}-warning`} /> : null}

          <View style={{ gap: tokens.space[3], marginTop: tokens.space[2] }}>
            <Button
              testID={`${testID}-confirm`}
              label={confirmLabel}
              variant={variant === 'danger' ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={loading}
              disabled={loading}
              fullWidth
            />
            <Button
              testID={`${testID}-cancel`}
              label={cancelLabel}
              variant="ghost"
              onPress={onCancel}
              disabled={loading}
              fullWidth
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
