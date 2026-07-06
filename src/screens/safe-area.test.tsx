/**
 * Safe area tests (T121) — LoginScreen + OtpScreen com insets mockados.
 *
 * Garante que:
 *  - `useSafeAreaInsets()` é consumido via KeyboardFormScreen
 *  - top inset é aplicado no padding-top do KeyboardAwareScrollView
 *    (não invade status bar / notch em devices iOS)
 *  - bottom inset é aplicado no padding-bottom (não invade home indicator)
 *  - Em devices sem notch (insets = 0), comportamento é idêntico ao baseline
 *
 * Estratégia: usa `renderWithTheme` com `initialMetrics` customizado.
 * O hook `useSafeAreaInsets` lê do contexto real (fornecido pelo
 * SafeAreaProvider que o wrapper injeta), então retorna os valores
 * que passamos. Testa o caminho de produção sem mocks frágeis.
 */

import type { EdgeInsets, Metrics } from 'react-native-safe-area-context';
import { renderWithTheme, screen } from '@/../jest.test-utils';
import { LoginScreen } from './LoginScreen';
import { OtpScreen } from './OtpScreen';

jest.mock('@/api/auth', () => ({
  requestOtp: jest.fn(),
  confirmOtp: jest.fn(),
}));

// Spread `mockReal` para preservar NavigationContainer e outros exports
// que o `renderWithTheme` wrapper usa. Sem isso, o wrapper recebe
// `undefined` para NavigationContainer e explode com "Element type invalid".
jest.mock('@react-navigation/native', () => {
  const mockReal = jest.requireActual('@react-navigation/native');
  return {
    ...mockReal,
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), reset: jest.fn() }),
    useRoute: jest.fn(),
  };
});

jest.mock('@/store/auth', () => ({
  useAuthStore: jest.fn(() => ({
    setSession: jest.fn(),
    isAuthenticated: false,
    driver: null,
  })),
}));

interface ScrollViewProps {
  contentContainerStyle?: { paddingTop?: number; paddingBottom?: number };
  testID?: string;
  style?: { paddingBottom?: number };
}
interface TreeNode {
  type?: unknown;
  props?: ScrollViewProps;
  children?: unknown;
}

const IPHONE_X_INSETS: EdgeInsets = { top: 47, bottom: 34, left: 0, right: 0 };
const NO_NOTCH_INSETS: EdgeInsets = { top: 0, bottom: 0, left: 0, right: 0 };
const IPAD_PRO_INSETS: EdgeInsets = { top: 24, bottom: 20, left: 0, right: 0 };

// Base padding aplicado pelo scroll (theme tokens.space[6] = 24).
const BASE_PADDING = 24;
// Com footer sticky, paddingBottom do scroll usa tokens.space[4] = 16.
const SCROLL_PADDING_BOTTOM_WITH_FOOTER = 16;
// Footer sticky aplica tokens.space[4] + insets.bottom.
const FOOTER_BASE_PADDING_BOTTOM = 16;

const BASE_FRAME = { x: 0, y: 0, width: 375, height: 812 };

function metricsFor(insets: EdgeInsets): Metrics {
  return { frame: BASE_FRAME, insets };
}

function expectedPadding(insets: EdgeInsets) {
  return {
    paddingTop: BASE_PADDING + insets.top,
    paddingBottom: SCROLL_PADDING_BOTTOM_WITH_FOOTER,
    footerPaddingBottom: FOOTER_BASE_PADDING_BOTTOM + insets.bottom,
  };
}

function findNodeByTestId(node: unknown, testId: string): TreeNode | null {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findNodeByTestId(child, testId);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  const n = node as TreeNode & { props?: { testID?: string; style?: { paddingBottom?: number } } };
  if (n.props?.testID === testId) return n;
  if (n.children) return findNodeByTestId(n.children, testId);
  return null;
}

function findScrollView(node: unknown): TreeNode | null {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findScrollView(child);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  const n = node as TreeNode;
  // RN's ScrollView renderiza como RCTScrollView em test renderer.
  // Procura pelo node que tem `contentContainerStyle` no props.
  if (n.props?.contentContainerStyle !== undefined) return n;
  if (n.children) return findScrollView(n.children);
  return null;
}

function getScrollPadding(tree: unknown): { paddingTop?: number; paddingBottom?: number } | null {
  const sv = findScrollView(tree);
  if (!sv) return null;
  const ccs = sv.props?.contentContainerStyle;
  if (!ccs) return null;
  return ccs;
}

describe('T121 — Safe area insets', () => {
  describe('LoginScreen (PhoneInput)', () => {
    it('aplica top inset = 47 (iPhone X com notch) no contentContainerStyle do scroll', () => {
      const tree = renderWithTheme(<LoginScreen />, {
        initialMetrics: metricsFor(IPHONE_X_INSETS),
      });
      const style = getScrollPadding(tree.toJSON());

      expect(style).not.toBeNull();
      expect(style?.paddingTop).toBe(expectedPadding(IPHONE_X_INSETS).paddingTop);
      expect(style?.paddingBottom).toBe(expectedPadding(IPHONE_X_INSETS).paddingBottom);

      const footer = findNodeByTestId(tree.toJSON(), 'keyboard-form-footer');
      expect(footer?.props?.style?.paddingBottom).toBe(expectedPadding(IPHONE_X_INSETS).footerPaddingBottom);
    });

    it('em device sem notch (insets = 0), padding = BASE_PADDING (24) + 0', () => {
      const tree = renderWithTheme(<LoginScreen />, {
        initialMetrics: metricsFor(NO_NOTCH_INSETS),
      });
      const style = getScrollPadding(tree.toJSON());

      expect(style?.paddingTop).toBe(BASE_PADDING);
      expect(style?.paddingBottom).toBe(SCROLL_PADDING_BOTTOM_WITH_FOOTER);
    });

    it('renderiza sem crash em iPad Pro (insets top=24, bottom=20)', () => {
      renderWithTheme(<LoginScreen />, {
        initialMetrics: metricsFor(IPAD_PRO_INSETS),
      });

      // Botão de submit presente — sanity check de render
      expect(screen.getByRole('button')).toBeTruthy();
    });
  });

  describe('OtpScreen (TokenInput)', () => {
    function setRouteParams(params: { phone?: string; expiresIn?: number } = {}) {
      const { useRoute } = jest.requireMock('@react-navigation/native') as { useRoute: jest.Mock };
      useRoute.mockReturnValue({ params, key: 'test', name: 'Otp' });
    }

    it('aplica top inset = 47 (iPhone X com notch) no contentContainerStyle do scroll', () => {
      setRouteParams({ phone: '+5511999998888' });

      const tree = renderWithTheme(<OtpScreen />, {
        initialMetrics: metricsFor(IPHONE_X_INSETS),
      });
      const style = getScrollPadding(tree.toJSON());

      expect(style).not.toBeNull();
      expect(style?.paddingTop).toBe(expectedPadding(IPHONE_X_INSETS).paddingTop);
      expect(style?.paddingBottom).toBe(expectedPadding(IPHONE_X_INSETS).paddingBottom);

      const footer = findNodeByTestId(tree.toJSON(), 'keyboard-form-footer');
      expect(footer?.props?.style?.paddingBottom).toBe(expectedPadding(IPHONE_X_INSETS).footerPaddingBottom);
    });

    it('em device sem notch (insets = 0), padding = BASE_PADDING (24) + 0', () => {
      setRouteParams({ phone: '+5511999998888' });

      const tree = renderWithTheme(<OtpScreen />, {
        initialMetrics: metricsFor(NO_NOTCH_INSETS),
      });
      const style = getScrollPadding(tree.toJSON());

      expect(style?.paddingTop).toBe(BASE_PADDING);
      expect(style?.paddingBottom).toBe(SCROLL_PADDING_BOTTOM_WITH_FOOTER);
    });

    it('renderiza countdown com safe area aplicada (smoke test integrado)', () => {
      setRouteParams({ phone: '+5511999998888' });

      renderWithTheme(<OtpScreen />, {
        initialMetrics: metricsFor(IPHONE_X_INSETS),
      });

      // Countdown "5:00" aparece — não regrediu com a mudança de insets
      expect(screen.getByTestId('otp-countdown')).toBeTruthy();
    });
  });
});