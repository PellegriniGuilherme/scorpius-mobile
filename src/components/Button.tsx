/**
 * Scorpius Move — Button (primitive).
 *
 * Variants: primary | secondary | ghost.
 * Sizes: md (default).
 * Loading state com ActivityIndicator.
 *
 * Tokens consumidos via useTheme() — zero cor direta.
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  testID,
}: ButtonProps) {
  const { colors, tokens } = useTheme();

  const variantStyles = {
    primary: {
      bg: colors.accent,
      fg: colors.textOnAccent,
      border: colors.accentBorder,
    },
    secondary: {
      bg: colors.surfacePanel,
      fg: colors.textPrimary,
      border: colors.borderDefault,
    },
    ghost: {
      bg: 'transparent',
      fg: colors.accent,
      border: 'transparent',
    },
    danger: {
      bg: colors.statusDangerSurface,
      fg: colors.statusDangerText,
      border: colors.statusDangerBorder,
    },
  }[variant];

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: variantStyles.bg,
          borderColor: variantStyles.border,
          borderRadius: tokens.radius.md,
          paddingVertical: tokens.space[3],
          paddingHorizontal: tokens.space[5],
          opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.fg} size="small" />
      ) : (
        <Text
          style={{
            color: variantStyles.fg,
            fontSize: tokens.text.base,
            fontWeight: tokens.weight.semibold,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
});
