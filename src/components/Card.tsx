import { View, type ViewProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export function Card({ padded = true, style, children, ...rest }: ViewProps & { padded?: boolean }) {
  const { colors, tokens } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.surfacePanel,
          borderColor: colors.borderDefault,
          borderWidth: 1,
          borderRadius: tokens.radius.lg,
          padding: padded ? tokens.space[5] : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
