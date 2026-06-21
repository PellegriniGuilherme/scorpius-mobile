/**
 * Scorpius Move — Button primitive tests (T068.2).
 *
 * Cobre: variants (primary | secondary | ghost | danger),
 * onPress, disabled, loading, fullWidth, accessibility.
 */
import { renderWithTheme, fireEvent, screen } from '@/../jest.test-utils';
import { Button } from './Button';

describe('Button', () => {
  it('renders label and calls onPress when pressed', () => {
    const onPress = jest.fn();
    renderWithTheme(<Button label="Entrar" onPress={onPress} />);
    const btn = screen.getByRole('button', { name: 'Entrar' });
    expect(btn).toBeTruthy();
    fireEvent.press(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    renderWithTheme(<Button label="Enviar" onPress={onPress} disabled />);
    const btn = screen.getByRole('button', { name: 'Enviar' });
    expect(btn.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(btn);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows loading state and marks busy', () => {
    const onPress = jest.fn();
    renderWithTheme(<Button label="Salvar" onPress={onPress} loading />);
    const btn = screen.getByRole('button', { name: 'Salvar' });
    expect(btn.props.accessibilityState.busy).toBe(true);
    fireEvent.press(btn);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders all 4 variants without crashing', () => {
    const variants: Array<'primary' | 'secondary' | 'ghost' | 'danger'> = [
      'primary',
      'secondary',
      'ghost',
      'danger',
    ];
    variants.forEach((v) => {
      const { unmount } = renderWithTheme(<Button label={`${v}-btn`} onPress={() => {}} variant={v} />);
      expect(screen.getByRole('button', { name: `${v}-btn` })).toBeTruthy();
      unmount();
    });
  });
});
