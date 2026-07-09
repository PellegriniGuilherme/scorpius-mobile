/**
 * Scorpius Move — OtpInput tests.
 */
import { renderWithTheme, fireEvent, screen } from '@/../jest.test-utils';
import { OtpInput } from './OtpInput';
import { OTP_CODE_LENGTH } from '@/screens/OtpScreen.validation';

describe('OtpInput', () => {
  it('renderiza 6 células e aceita apenas dígitos', () => {
    const onChangeText = jest.fn();
    renderWithTheme(
      <OtpInput label="Código de 6 dígitos" value="" onChangeText={onChangeText} />,
    );

    expect(screen.getByTestId('otp-input-cell-0')).toBeTruthy();
    expect(screen.getByTestId(`otp-input-cell-${OTP_CODE_LENGTH - 1}`)).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Código de 6 dígitos'), '12a34b56');
    expect(onChangeText).toHaveBeenCalledWith('123456');
  });

  it('chama onComplete ao preencher 6 dígitos', () => {
    const onChangeText = jest.fn();
    const onComplete = jest.fn();
    renderWithTheme(
      <OtpInput
        label="Código de 6 dígitos"
        value=""
        onChangeText={onChangeText}
        onComplete={onComplete}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Código de 6 dígitos'), '123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('exibe mensagem de erro', () => {
    renderWithTheme(
      <OtpInput
        label="Código de 6 dígitos"
        value="123"
        onChangeText={jest.fn()}
        error="Código inválido"
      />,
    );

    expect(screen.getByTestId('otp-input-error')).toHaveTextContent('Código inválido');
  });
});
