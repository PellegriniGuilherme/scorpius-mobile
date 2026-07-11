import { Image, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

interface LocalMediaPreviewProps {
  uri?: string | null;
  label?: string;
  emptyLabel: string;
  capturedLabel?: string;
  height?: number;
  testID?: string;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

export function LocalMediaPreview({
  uri,
  label,
  emptyLabel,
  capturedLabel,
  height = 180,
  testID,
  accessibilityLabel,
  style,
}: LocalMediaPreviewProps) {
  const { colors, tokens } = useTheme();
  const hasMedia = !!uri;

  return (
    <View style={[{ gap: tokens.space[2] }, style]}>
      {label ? (
        <Text
          style={{
            fontSize: tokens.text.xs,
            color: colors.textMuted,
            fontWeight: tokens.weight.medium,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
      ) : null}
      <View
        style={{
          height,
          backgroundColor: hasMedia ? colors.surfaceInset : colors.surfaceInset,
          borderColor: hasMedia ? colors.statusSuccessBorder : colors.borderDefault,
          borderWidth: 2,
          borderRadius: tokens.radius.md,
          borderStyle: hasMedia ? 'solid' : 'dashed',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {hasMedia ? (
          <Image
            testID={testID}
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            accessibilityLabel={accessibilityLabel ?? 'Pré-visualização da mídia capturada'}
          />
        ) : (
          <View style={{ alignItems: 'center', gap: tokens.space[2], padding: tokens.space[4] }}>
            <Text style={{ fontSize: 48, color: colors.textSubtle }}>📷</Text>
            <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm, textAlign: 'center' }}>
              {emptyLabel}
            </Text>
          </View>
        )}
      </View>
      {hasMedia && capturedLabel ? (
        <Text style={{ color: colors.statusSuccessText, fontWeight: tokens.weight.semibold, fontSize: tokens.text.sm }}>
          {capturedLabel}
        </Text>
      ) : null}
    </View>
  );
}
