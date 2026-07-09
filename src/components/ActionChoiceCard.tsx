import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export type ActionChoiceTone = 'info' | 'danger';

interface ActionChoiceCardProps {
  title: string;
  subtitle: string;
  tone: ActionChoiceTone;
  onPress: () => void;
  testID?: string;
}

export function ActionChoiceCard({ title, subtitle, tone, onPress, testID }: ActionChoiceCardProps) {
  const { colors, tokens } = useTheme();

  const toneStyles =
    tone === 'info'
      ? {
          bg: colors.statusInfoSurface,
          border: colors.statusInfoBorder,
          title: colors.statusInfoText,
        }
      : {
          bg: colors.statusDangerSurface,
          border: colors.statusDangerBorder,
          title: colors.statusDangerText,
        };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          backgroundColor: toneStyles.bg,
          borderColor: toneStyles.border,
          borderWidth: 1,
          borderRadius: tokens.radius.lg,
          padding: tokens.space[4],
          flexDirection: 'row',
          alignItems: 'center',
          gap: tokens.space[3],
        }}
      >
        <View style={{ flex: 1, gap: tokens.space[1] }}>
          <Text
            style={{
              fontSize: tokens.text.base,
              fontWeight: tokens.weight.semibold,
              color: toneStyles.title,
            }}
          >
            {title}
          </Text>
          <Text style={{ fontSize: tokens.text.sm, color: colors.textSecondary, lineHeight: 20 }}>
            {subtitle}
          </Text>
        </View>
        <Text style={{ fontSize: tokens.text.xl, color: colors.textMuted }}>›</Text>
      </View>
    </Pressable>
  );
}
