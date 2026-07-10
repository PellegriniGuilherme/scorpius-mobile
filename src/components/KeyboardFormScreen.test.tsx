import { Text } from 'react-native';
import { renderWithTheme, screen } from '@/../jest.test-utils';
import { KEYBOARD_FORM_ESTIMATED_FOOTER_HEIGHT, KeyboardFormScreen } from './KeyboardFormScreen';

describe('KeyboardFormScreen', () => {
  it('renders children and footer', () => {
    renderWithTheme(
      <KeyboardFormScreen footer={<Text>Footer action</Text>}>
        <Text>Form content</Text>
      </KeyboardFormScreen>
    );

    expect(screen.getByText('Form content')).toBeTruthy();
    expect(screen.getByText('Footer action')).toBeTruthy();
  });

  it('applies safe area padding to scroll content without footer', () => {
    renderWithTheme(
      <KeyboardFormScreen>
        <Text>Form content</Text>
      </KeyboardFormScreen>,
      {
        initialMetrics: {
          frame: { x: 0, y: 0, width: 375, height: 812 },
          insets: { top: 47, bottom: 34, left: 0, right: 0 },
        },
      }
    );

    const scroll = screen.getByTestId('keyboard-form-scroll');
    expect(scroll.props.contentContainerStyle.paddingTop).toBe(71);
    expect(scroll.props.contentContainerStyle.paddingBottom).toBe(58);
  });

  it('reserves footer height for keyboard avoidance when footer is present', () => {
    renderWithTheme(
      <KeyboardFormScreen footer={<Text>Footer action</Text>}>
        <Text>Form content</Text>
      </KeyboardFormScreen>
    );

    const scroll = screen.getByTestId('keyboard-form-scroll');
    expect(scroll.props.contentContainerStyle.paddingBottom).toBe(KEYBOARD_FORM_ESTIMATED_FOOTER_HEIGHT + 16);
    expect(scroll.props.bottomOffset).toBe(KEYBOARD_FORM_ESTIMATED_FOOTER_HEIGHT + 16);
    expect(scroll.props.extraKeyboardSpace).toBe(16);
  });
});
