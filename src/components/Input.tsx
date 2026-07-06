/**
 * Scorpius Move — Input (primitive).
 *
 * Acessível: label conectado via accessibilityLabel, hint via
 * accessibilityHint, estados de erro reportados.
 */
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  hint?: string;
  error?: string;
  multiline?: boolean;
}

export function Input({ label, hint, error, multiline, ...rest }: InputProps) {
  const { colors, tokens } = useTheme();
  return (
    <View style={{ gap: tokens.space[1] }}>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: tokens.text.sm,
          fontWeight: tokens.weight.medium,
        }}
      >
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.textSubtle}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'auto'}
        {...rest}
        style={{
          backgroundColor: colors.surfacePanel,
          color: colors.textPrimary,
          borderWidth: 1,
          borderColor: error ? colors.statusDangerBorder : colors.borderDefault,
          borderRadius: tokens.radius.md,
          paddingHorizontal: tokens.space[3],
          paddingVertical: tokens.space[3],
          minHeight: multiline ? 100 : 48,
          fontSize: tokens.text.base,
        }}
      />
      {(error || hint) && (
        <Text
          style={{
            color: error ? colors.statusDangerText : colors.textSubtle,
            fontSize: tokens.text.xs,
          }}
        >
          {error ?? hint}
        </Text>
      )}
    </View>
  );
}
