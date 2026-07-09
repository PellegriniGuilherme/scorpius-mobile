import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
  useKeyboardState,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';

export interface KeyboardFormScreenProps {
  children: ReactNode;
  footer?: ReactNode;
  centered?: boolean;
  contentContainerStyle?: ViewStyle;
}

export function KeyboardFormScreen({
  children,
  footer,
  centered = false,
  contentContainerStyle,
}: KeyboardFormScreenProps) {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { isVisible: keyboardVisible } = useKeyboardState();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAwareScrollView
        testID="keyboard-form-scroll"
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: centered && !keyboardVisible ? 'center' : 'flex-start',
          paddingHorizontal: tokens.space[6],
          paddingTop: tokens.space[6] + insets.top,
          paddingBottom: footer ? tokens.space[4] : tokens.space[6] + insets.bottom,
          gap: tokens.space[6],
          ...contentContainerStyle,
        }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={footer ? tokens.space[4] : insets.bottom}
      >
        {/* react-native-keyboard-controller types target @types/react@18; cast for React 19 */}
        {children as never}
      </KeyboardAwareScrollView>
      {footer ? (
        <KeyboardStickyView
          testID="keyboard-form-footer"
          offset={{ closed: 0, opened: insets.bottom }}
          pointerEvents="box-none"
          style={{
            paddingHorizontal: tokens.space[6],
            paddingTop: tokens.space[3],
            paddingBottom: tokens.space[4] + insets.bottom,
            backgroundColor: colors.background,
            gap: tokens.space[3],
            zIndex: 10,
            elevation: 8,
          }}
        >
          <View pointerEvents="auto" collapsable={false}>
            {footer as never}
          </View>
        </KeyboardStickyView>
      ) : null}
    </View>
  );
}
