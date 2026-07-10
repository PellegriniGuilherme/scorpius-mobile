import { useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
  useKeyboardState,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';

/** Reserva mínima do footer antes do `onLayout` medir a altura real (botão + paddings). */
export const KEYBOARD_FORM_ESTIMATED_FOOTER_HEIGHT = 96;

export interface KeyboardFormScreenProps {
  children: ReactNode;
  footer?: ReactNode;
  centered?: boolean;
  contentContainerStyle?: ViewStyle;
  /** Espaço extra entre o input focado e o teclado/footer. */
  extraKeyboardSpace?: number;
}

export function KeyboardFormScreen({
  children,
  footer,
  centered = false,
  contentContainerStyle,
  extraKeyboardSpace,
}: KeyboardFormScreenProps) {
  const { colors, tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { isVisible: keyboardVisible } = useKeyboardState();
  const [footerHeight, setFooterHeight] = useState(0);

  const handleFooterLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setFooterHeight((current) => (current === nextHeight ? current : nextHeight));
  };

  const footerReserve = footer
    ? Math.max(footerHeight, KEYBOARD_FORM_ESTIMATED_FOOTER_HEIGHT)
    : 0;
  const keyboardGap = extraKeyboardSpace ?? tokens.space[4];
  const scrollBottomPadding = footer
    ? footerReserve + tokens.space[4]
    : tokens.space[6] + insets.bottom;

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
          paddingBottom: scrollBottomPadding,
          gap: tokens.space[6],
          ...contentContainerStyle,
        }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={footer ? footerReserve + keyboardGap : insets.bottom}
        extraKeyboardSpace={keyboardGap}
      >
        {/* react-native-keyboard-controller types target @types/react@18; cast for React 19 */}
        {children as never}
      </KeyboardAwareScrollView>
      {footer ? (
        <KeyboardStickyView
          testID="keyboard-form-footer"
          offset={{ closed: 0, opened: insets.bottom }}
          pointerEvents="box-none"
          onLayout={handleFooterLayout}
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
