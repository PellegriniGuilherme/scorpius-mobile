import { Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export type AlertTone = 'info' | 'warning' | 'danger' | 'success';

const ICONS: Record<AlertTone, string> = {
  info: 'ℹ',
  warning: '⚠',
  danger: '⛔',
  success: '✓',
};

interface AlertBannerProps {
  tone?: AlertTone;
  title?: string;
  message: string;
  testID?: string;
}

export function AlertBanner({ tone = 'info', title, message, testID }: AlertBannerProps) {
  const { colors, tokens } = useTheme();

  const toneStyles = {
    info: {
      bg: colors.statusInfoSurface,
      border: colors.statusInfoBorder,
      title: colors.statusInfoText,
      icon: colors.statusInfoMarker,
    },
    warning: {
      bg: colors.statusWarningSurface,
      border: colors.statusWarningBorder,
      title: colors.statusWarningText,
      icon: colors.statusWarningMarker,
    },
    danger: {
      bg: colors.statusDangerSurface,
      border: colors.statusDangerBorder,
      title: colors.statusDangerText,
      icon: colors.statusDangerMarker,
    },
    success: {
      bg: colors.statusSuccessSurface,
      border: colors.statusSuccessBorder,
      title: colors.statusSuccessText,
      icon: colors.statusSuccessMarker,
    },
  }[tone];

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={{
        backgroundColor: toneStyles.bg,
        borderColor: toneStyles.border,
        borderWidth: 1,
        borderRadius: tokens.radius.md,
        padding: tokens.space[4],
        flexDirection: 'row',
        gap: tokens.space[3],
      }}
    >
      <Text style={{ fontSize: tokens.text.lg, color: toneStyles.icon, lineHeight: 22 }} accessibilityElementsHidden>
        {ICONS[tone]}
      </Text>
      <View style={{ flex: 1, gap: tokens.space[1] }}>
        {title ? (
          <Text style={{ fontSize: tokens.text.sm, fontWeight: tokens.weight.semibold, color: toneStyles.title }}>
            {title}
          </Text>
        ) : null}
        <Text style={{ fontSize: tokens.text.sm, color: colors.textSecondary, lineHeight: 20 }}>{message}</Text>
      </View>
    </View>
  );
}
