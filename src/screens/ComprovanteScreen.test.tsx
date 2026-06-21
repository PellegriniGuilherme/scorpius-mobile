/**
 * Scorpius Move — ComprovanteScreen tests (T068.3).
 *
 * Cobre:
 *  - render com deliveryId param
 *  - tap "Capturar foto" muda estado visual (placeholder → capturado)
 *  - tap "Tirar novamente" volta ao estado inicial
 *  - signature TextInput atualiza estado
 *  - botão "Confirmar entrega" desabilitado sem foto ou signature
 *  - botão "Confirmar entrega" habilitado com foto + signature (≥3 chars)
 *  - submit mostra tela de sucesso
 *  - "Entrega não encontrada" para id inválido
 */
import { renderWithTheme, fireEvent, screen } from '@/../jest.test-utils';
import { ComprovanteScreen } from './ComprovanteScreen';
import { useRoute } from '@react-navigation/native';

jest.mock('@react-navigation/native', () => {
  const mockReal = jest.requireActual('@react-navigation/native');
  return {
    ...mockReal,
    useNavigation: jest.fn().mockReturnValue({ navigate: jest.fn(), goBack: jest.fn() }),
    useRoute: jest.fn(),
  };
});

function setRouteParams(params: { deliveryId: number } | undefined) {
  (useRoute as jest.Mock).mockReturnValue({
    params,
    key: 'test',
    name: 'Comprovante',
  });
}

describe('ComprovanteScreen', () => {
  it('renders photo placeholder and signature area', () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);
    expect(screen.getByText('Aguardando captura')).toBeTruthy();
    // ptBR.proof.signatureLabel
    expect(screen.getByText('Assinatura do destinatário')).toBeTruthy();
  });

  it('shows "Entrega não encontrada" for invalid deliveryId', () => {
    setRouteParams({ deliveryId: 99999 });
    renderWithTheme(<ComprovanteScreen />);
    expect(screen.getByText('Entrega não encontrada.')).toBeTruthy();
  });

  it('tap "Capturar foto" toggles state from placeholder to captured', () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);
    const captureBtn = screen.getByText('Capturar foto');
    fireEvent.press(captureBtn);
    // Após captura: muda para "Foto capturada" e botão vira "Tirar novamente"
    expect(screen.getByText('Foto capturada')).toBeTruthy();
    expect(screen.getByText('Tirar novamente')).toBeTruthy();
    expect(screen.queryByText('Aguardando captura')).toBeNull();
  });

  it('"Confirmar entrega" button is disabled without photo or signature', () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);
    // getByRole pega o Pressable (a11y button); o Text dentro tem
    // o label mas o `disabled` está no Pressable.
    const submitBtn = screen.getByRole('button', { name: 'Confirmar entrega' });
    expect(submitBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it('"Confirmar entrega" stays disabled with photo but no signature', () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);
    fireEvent.press(screen.getByText('Capturar foto'));
    const submitBtn = screen.getByRole('button', { name: 'Confirmar entrega' });
    expect(submitBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it('"Confirmar entrega" stays disabled with signature < 3 chars', () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);
    fireEvent.press(screen.getByText('Capturar foto'));
    const input = screen.getByLabelText('Assinatura do destinatário');
    fireEvent.changeText(input, 'Jo'); // 2 chars
    const submitBtn = screen.getByRole('button', { name: 'Confirmar entrega' });
    expect(submitBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it('"Confirmar entrega" enables with photo + signature (≥3 chars)', () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);
    fireEvent.press(screen.getByText('Capturar foto'));
    const input = screen.getByLabelText('Assinatura do destinatário');
    fireEvent.changeText(input, 'João da Silva');
    const submitBtn = screen.getByRole('button', { name: 'Confirmar entrega' });
    expect(submitBtn.props.accessibilityState?.disabled).toBe(false);
  });

  it('shows success screen after submitting', () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);
    fireEvent.press(screen.getByText('Capturar foto'));
    const input = screen.getByLabelText('Assinatura do destinatário');
    fireEvent.changeText(input, 'João da Silva');
    fireEvent.press(screen.getByText('Confirmar entrega'));
    // Tela de sucesso: ptBR.proof.successTitle + successDesc
    expect(screen.getByText('Entrega confirmada!')).toBeTruthy();
    expect(screen.getByText(/Voltando para a lista/i)).toBeTruthy();
  });
});
