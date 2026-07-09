/**
 * Scorpius Move — OTP input (6 caixas).
 *
 * Input oculto captura digitação, cola e autofill SMS; caixas exibem cada dígito.
 * Comprimento fixo em `OTP_CODE_LENGTH` (paridade com backend).
 */
import { useRef } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { OTP_CODE_LENGTH } from '@/screens/OtpScreen.validation';

interface OtpInputProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onComplete?: (code: string) => void;
  error?: string;
  disabled?: boolean;
  testID?: string;
}

function sanitizeOtpInput(text: string): string {
  return text.replace(/\D/g, '').slice(0, OTP_CODE_LENGTH);
}

export function OtpInput({
  label,
  value,
  onChangeText,
  onComplete,
  error,
  disabled = false,
  testID = 'otp-input',
}: OtpInputProps) {
  const { colors, tokens } = useTheme();
  const inputRef = useRef<TextInput>(null);

  const activeIndex = Math.min(value.length, OTP_CODE_LENGTH - 1);

  function handleChange(text: string) {
    const next = sanitizeOtpInput(text);
    onChangeText(next);
    if (next.length === OTP_CODE_LENGTH) {
      onComplete?.(next);
    }
  }

  function handleFocus() {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }

  return (
    <View style={{ gap: tokens.space[1] }} testID={testID}>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: tokens.text.sm,
          fontWeight: tokens.weight.medium,
        }}
      >
        {label}
      </Text>

      <Pressable
        onPress={handleFocus}
        accessibilityRole="none"
        style={{ gap: tokens.space[2] }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: tokens.space[2],
          }}
        >
          {Array.from({ length: OTP_CODE_LENGTH }, (_, index) => {
            const digit = value[index] ?? '';
            const isActive = !disabled && index === activeIndex;
            const hasError = Boolean(error);

            return (
              <View
                key={index}
                testID={`${testID}-cell-${index}`}
                style={{
                  flex: 1,
                  minHeight: 52,
                  maxWidth: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: disabled ? colors.surfaceInset : colors.surfacePanel,
                  borderWidth: isActive ? 2 : 1,
                  borderColor: hasError
                    ? colors.statusDangerBorder
                    : isActive
                      ? colors.focusRing
                      : colors.borderDefault,
                  borderRadius: tokens.radius.md,
                }}
              >
                <Text
                  style={{
                    color: disabled ? colors.textSubtle : colors.textPrimary,
                    fontSize: tokens.text['2xl'],
                    fontWeight: tokens.weight.semibold,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {digit}
                </Text>
              </View>
            );
          })}
        </View>

        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={OTP_CODE_LENGTH}
          editable={!disabled}
          caretHidden
          accessibilityLabel={label}
          testID={`${testID}-field`}
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            opacity: 0,
          }}
        />
      </Pressable>

      {error && (
        <Text
          testID={`${testID}-error`}
          style={{
            color: colors.statusDangerText,
            fontSize: tokens.text.xs,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
