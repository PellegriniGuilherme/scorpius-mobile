import { renderWithTheme, fireEvent, screen, waitFor } from '@/../jest.test-utils';
import { MarcarFalhaScreen } from './MarcarFalhaScreen';
import { useRoute } from '@react-navigation/native';
import * as deliveryService from '@/services/deliveryService';
import * as deliveryActions from '@/services/deliveryActions';
import { MOCK_DELIVERY_API } from '@/testFixtures/deliveryApi';

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React = jest.requireActual('react');
  return {
    ...actual,
    useNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack }),
    useRoute: jest.fn(),
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => callback(), [callback]);
    },
  };
});

describe('MarcarFalhaScreen', () => {
  beforeEach(() => {
    mockGoBack.mockClear();
    (useRoute as jest.Mock).mockReturnValue({
      params: { deliveryId: 1002 },
      key: 'test',
      name: 'MarcarFalha',
    });
    (deliveryService.fetchDeliveryWithCache as jest.Mock).mockResolvedValue({
      data: MOCK_DELIVERY_API[1],
      fromCache: false,
    });
    jest.spyOn(deliveryActions, 'runDeliveryAction').mockResolvedValue();
  });

  it('requires at least 3 characters before review', async () => {
    renderWithTheme(<MarcarFalhaScreen />);
    await screen.findByText('Marcar falha');

    const reviewButton = screen.getByTestId('fail-delivery-review');
    expect(reviewButton).toBeDisabled();

    fireEvent.changeText(screen.getByTestId('fail-delivery-reason'), 'ab');
    expect(reviewButton).toBeDisabled();

    fireEvent.changeText(screen.getByTestId('fail-delivery-reason'), 'Destinatário ausente');
    expect(reviewButton).not.toBeDisabled();
  });

  it('shows confirmation step and submits reason to runDeliveryAction', async () => {
    renderWithTheme(<MarcarFalhaScreen />);
    await screen.findByText('Marcar falha');

    fireEvent.changeText(screen.getByTestId('fail-delivery-reason'), 'Portaria fechada');
    fireEvent.press(screen.getByTestId('fail-delivery-review'));

    expect(screen.getByTestId('fail-delivery-reason-preview')).toHaveTextContent('Portaria fechada');
    expect(screen.getByText('Esta entrega será finalizada como falha')).toBeTruthy();
    expect(
      screen.getByText('O status mudará para Falhou e sairá da sua lista de entregas ativas.'),
    ).toBeTruthy();
    expect(
      screen.getByText('Você não poderá coletar comprovante nem marcar como entregue depois.'),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId('fail-delivery-confirm'));

    await waitFor(() => {
      expect(deliveryActions.runDeliveryAction).toHaveBeenCalledWith({
        deliveryId: 1002,
        action: 'fail',
        reason: 'Portaria fechada',
      });
    });
    expect(mockGoBack).toHaveBeenCalled();
  });
});
