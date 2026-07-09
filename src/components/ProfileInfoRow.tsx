import { Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

interface ProfileInfoRowProps {
  label: string;
  value: string;
  mono?: boolean;
  testID?: string;
}

export function ProfileInfoRow({ label, value, mono = false, testID }: ProfileInfoRowProps) {
  const { colors, tokens } = useTheme();

  return (
    <View testID={testID} style={{ gap: tokens.space[1] }}>
      <Text
        style={{
          fontSize: tokens.text.xs,
          color: colors.textMuted,
          fontWeight: tokens.weight.medium,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: tokens.text.base,
          color: colors.textPrimary,
          fontFamily: mono ? tokens.font.mono : undefined,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
