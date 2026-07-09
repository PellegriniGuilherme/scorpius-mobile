import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string = string> {
  label: string;
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  testID?: string;
}

export function Select<T extends string = string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Selecione…',
  testID = 'select',
}: SelectProps<T>) {
  const { colors, tokens } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

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
      <Pressable
        testID={`${testID}-trigger`}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={{
          backgroundColor: colors.surfacePanel,
          borderWidth: 1,
          borderColor: colors.borderDefault,
          borderRadius: tokens.radius.md,
          paddingHorizontal: tokens.space[3],
          paddingVertical: tokens.space[3],
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            color: selected ? colors.textPrimary : colors.textSubtle,
            fontSize: tokens.text.base,
            flex: 1,
          }}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm }}>▼</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            testID={`${testID}-modal`}
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: tokens.radius.lg,
              borderTopRightRadius: tokens.radius.lg,
              padding: tokens.space[4],
              maxHeight: '70%',
            }}
          >
            <Text
              style={{
                fontSize: tokens.text.lg,
                fontWeight: tokens.weight.bold,
                color: colors.textPrimary,
                marginBottom: tokens.space[3],
              }}
            >
              {label}
            </Text>
            <ScrollView>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    testID={`${testID}-option-${option.value}`}
                    accessibilityRole="button"
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={{
                      paddingVertical: tokens.space[3],
                      paddingHorizontal: tokens.space[2],
                      borderRadius: tokens.radius.md,
                      backgroundColor: isSelected ? colors.accentSurface : 'transparent',
                      borderWidth: 1,
                      borderColor: isSelected ? colors.accentBorder : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        color: isSelected ? colors.textPrimary : colors.textSecondary,
                        fontWeight: isSelected ? tokens.weight.semibold : tokens.weight.regular,
                        fontSize: tokens.text.base,
                      }}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
