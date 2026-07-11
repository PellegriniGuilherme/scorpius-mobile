import { View, Text } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { DeliveryUiStatus } from '@/types/delivery';

export function StatusBadge({ status, label }: { status: DeliveryUiStatus; label: string }) {
  const { colors, tokens } = useTheme();
  const map: Record<DeliveryUiStatus, { bg: string; fg: string; border: string }> = {
    pending: { bg: colors.statusNeutralSurface, fg: colors.statusNeutralText, border: colors.statusNeutralBorder },
    picked_up: { bg: colors.statusWarningSurface, fg: colors.statusWarningText, border: colors.statusWarningBorder },
    in_route: { bg: colors.statusInfoSurface, fg: colors.statusInfoText, border: colors.statusInfoBorder },
    delivered: { bg: colors.statusSuccessSurface, fg: colors.statusSuccessText, border: colors.statusSuccessBorder },
    failed: { bg: colors.statusDangerSurface, fg: colors.statusDangerText, border: colors.statusDangerBorder },
  };
  const c = map[status];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: c.bg,
        borderColor: c.border,
        borderWidth: 1,
        borderRadius: tokens.radius.full,
        paddingHorizontal: tokens.space[3],
        paddingVertical: tokens.space[1],
      }}
    >
      <Text style={{ color: c.fg, fontSize: tokens.text.xs, fontWeight: tokens.weight.semibold }}>{label}</Text>
    </View>
  );
}
