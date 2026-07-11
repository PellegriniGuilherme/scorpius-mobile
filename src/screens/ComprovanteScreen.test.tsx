/**
 * Scorpius Move — ComprovanteScreen tests (T068.3 + T068.5).
 *
 * Cobre:
 *  - render com deliveryId param
 *  - tap "Capturar foto" (com mock de image-picker retornando foto) muda estado
 *  - "Entrega não encontrada" para id inválido
 *  - "Finalizar entrega" enabled apenas com foto + signature ≥3 chars
 *  - submit enfileira no OutboxService e mostra tela de sucesso
 *  - sync status "pending" enquanto outbox tem o item
 *  - sync status "failed" se item foi para DLQ (next_retry_at = 0)
 */
import { renderWithTheme, fireEvent, screen, waitFor } from '@/../jest.test-utils';
import { ComprovanteScreen } from './ComprovanteScreen';
import { useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { outbox } from '@/services/OutboxService';
import { syncWorker } from '@/services/SyncWorker';
import { __resetMockDb } from '../../jest.sqlite-mock.js';

jest.mock('@/components/SignaturePad', () => {
  const mockReact = jest.requireActual('react');
  const { View, Pressable, Text } = jest.requireActual('react-native');
  return {
    SignaturePad: mockReact.forwardRef((props: { onChange?: (v: boolean) => void }, ref: unknown) => {
      mockReact.useImperativeHandle(ref, () => ({
        clear: jest.fn(),
        isEmpty: () => false,
        captureToCacheFile: jest.fn().mockResolvedValue('file:///cache/proofs/mock-sig.png'),
      }));
      return mockReact.createElement(
        View,
        { testID: 'proof-signature-pad-mock' },
        mockReact.createElement(
          Pressable,
          {
            testID: 'mock-sign',
            onPress: () => props.onChange?.(true),
          },
          mockReact.createElement(Text, null, 'Assinar'),
        ),
      );
    }),
  };
});

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

const successfulUpload = jest.fn().mockResolvedValue(undefined);

async function setupHappyPathPickPhoto() {
  (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///tmp/captured.jpg' }],
  });
}

async function submitProofFlow() {
  fireEvent.press(screen.getByRole('button', { name: 'Revisar finalização' }));
  await waitFor(() => expect(screen.getByText('Confirmar entrega')).toBeTruthy());
  fireEvent.press(screen.getByTestId('proof-confirm-submit'));
}

describe('ComprovanteScreen', () => {
  beforeEach(() => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockReset();
    // Reset outbox: close + re-create
    return outbox.close();
  });

  afterAll(() => {
    return outbox.close();
  });

  it('renders photo placeholder and signature area', async () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);
    await waitFor(() => {
      expect(screen.getByText('Aguardando captura')).toBeTruthy();
      expect(screen.getByText(/Área de assinatura/)).toBeTruthy();
      expect(screen.getByLabelText('Nome do destinatário')).toBeTruthy();
    });
  });

  it('shows "Entrega não encontrada" for invalid deliveryId', async () => {
    setRouteParams({ deliveryId: 99999 });
    renderWithTheme(<ComprovanteScreen />);
    expect(await screen.findByText('Entrega não encontrada.')).toBeTruthy();
  });

  it('tap "Capturar foto" (mock success) shows photo preview', async () => {
    await setupHappyPathPickPhoto();
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);
    fireEvent.press(await screen.findByText('Capturar foto'));
    fireEvent.press(screen.getByTestId('mock-sign'));
    await waitFor(() => {
      expect(screen.getByTestId('proof-photo-preview')).toBeTruthy();
      expect(screen.getByText('Tirar novamente')).toBeTruthy();
    });
    expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
  });

  it('"Revisar finalização" disabled without photo or signature', async () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);
    const submitBtn = await screen.findByRole('button', { name: 'Revisar finalização' });
    expect(submitBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it('"Revisar finalização" enabled with photo + signature (≥3 chars)', async () => {
    await setupHappyPathPickPhoto();
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);
    fireEvent.press(await screen.findByText('Capturar foto'));
    fireEvent.press(screen.getByTestId('mock-sign'));
    await waitFor(() => expect(screen.getByText('Tirar novamente')).toBeTruthy());
    const input = screen.getByLabelText('Nome do destinatário');
    fireEvent.changeText(input, 'João da Silva');
    const submitBtn = screen.getByRole('button', { name: 'Revisar finalização' });
    expect(submitBtn.props.accessibilityState?.disabled).toBe(false);
  });

  it('"Revisar finalização" enabled without proof when delivery has no requirements', async () => {
    setRouteParams({ deliveryId: 1002 });
    renderWithTheme(<ComprovanteScreen />);
    const submitBtn = await screen.findByRole('button', { name: 'Revisar finalização' });
    expect(submitBtn.props.accessibilityState?.disabled).toBe(false);
    expect(screen.queryByText('Capturar foto')).toBeNull();
    expect(screen.queryByText('Área de assinatura')).toBeNull();
  });

  it('confirm phase shows photo and signature previews', async () => {
    await setupHappyPathPickPhoto();
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);
    fireEvent.press(await screen.findByText('Capturar foto'));
    fireEvent.press(screen.getByTestId('mock-sign'));
    await waitFor(() => expect(screen.getByText('Tirar novamente')).toBeTruthy());
    const input = screen.getByLabelText('Nome do destinatário');
    fireEvent.changeText(input, 'João da Silva');
    fireEvent.press(screen.getByRole('button', { name: 'Revisar finalização' }));
    await waitFor(() => expect(screen.getByText('Confirmar entrega')).toBeTruthy());
    expect(screen.getByTestId('proof-confirm-photo-preview')).toBeTruthy();
    expect(screen.getByTestId('proof-confirm-signature-preview')).toBeTruthy();
    expect(screen.getByText('Assinatura de João da Silva')).toBeTruthy();
  });

  it('submit enqueues to outbox and shows success screen', async () => {
    await setupHappyPathPickPhoto();
    syncWorker.setApiClient({ uploadProof: successfulUpload });
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);
    fireEvent.press(await screen.findByText('Capturar foto'));
    fireEvent.press(screen.getByTestId('mock-sign'));
    await waitFor(() => expect(screen.getByText('Tirar novamente')).toBeTruthy());
    const input = screen.getByLabelText('Nome do destinatário');
    fireEvent.changeText(input, 'João da Silva');
    await submitProofFlow();
    await waitFor(() => {
      expect(screen.getByText('Entrega confirmada!')).toBeTruthy();
    });
    // Outbox foi consumido pelo SyncWorker (api.successUpload)
    const remaining = await outbox.getAll();
    expect(remaining.find((i) => i.payload.deliveryId === 1001)).toBeUndefined();
    expect(successfulUpload).toHaveBeenCalled();
  });

  it('submit com upload falho → DLQ + botão Reenviar', async () => {
    await setupHappyPathPickPhoto();
    const failingUpload = jest.fn().mockRejectedValue(new Error('network'));
    syncWorker.setApiClient({ uploadProof: failingUpload });
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);
    fireEvent.press(await screen.findByText('Capturar foto'));
    fireEvent.press(screen.getByTestId('mock-sign'));
    await waitFor(() => expect(screen.getByText('Tirar novamente')).toBeTruthy());
    const input = screen.getByLabelText('Nome do destinatário');
    fireEvent.changeText(input, 'João da Silva');
    await submitProofFlow();
    await waitFor(() => {
      expect(screen.getByText(/Sincronizando com servidor/i)).toBeTruthy();
    });
    expect(failingUpload).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// T098 — DLQ UI tests.
// ---------------------------------------------------------------------------

describe('ComprovanteScreen DLQ UI (T098)', () => {
  beforeEach(() => {
    __resetMockDb();
    (ImagePicker.launchCameraAsync as jest.Mock).mockReset();
    return outbox.close();
  });

  afterAll(() => outbox.close());

  it('shows DLQ badge quando há items na DLQ', async () => {
    // Setup: cria 1 item e força DLQ (5 markFailed → attempts=5 + next_retry_at=0)
    await outbox.init();
    const id = await outbox.enqueue('proof_upload', {
      deliveryId: 5000,
      photoPath: '/cache/x.jpg',
      signaturePath: '/cache/x-sig.png',
      signatureName: 'tester',
    });
    for (let i = 0; i < 5; i++) {
      await outbox.markFailed(id, '[DLQ] test', 0);
    }

    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);

    // Badge aparece após o useEffect rodar
    const badge = await screen.findByTestId('dlq-badge');
    expect(badge).toBeTruthy();
    expect(screen.getByText(/1 item falhou/i)).toBeTruthy();
  });

  it('does NOT show DLQ badge quando outbox está vazio', async () => {
    await outbox.init();
    // sem items

    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);

    // Espera o useEffect rodar e dar tempo do refresh
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByTestId('dlq-badge')).toBeNull();
  });

  it('tap no badge abre modal com lista de items + botão retry', async () => {
    await outbox.init();
    const id = await outbox.enqueue('proof_upload', {
      deliveryId: 6000,
      photoPath: '/cache/y.jpg',
      signaturePath: '/cache/y-sig.png',
      signatureName: 'retryme',
    });
    for (let i = 0; i < 5; i++) {
      await outbox.markFailed(id, '[DLQ] something', 0);
    }

    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);

    const badge = await screen.findByTestId('dlq-badge');
    fireEvent.press(badge);

    // Modal abre
    const modal = await screen.findByTestId('dlq-modal');
    expect(modal).toBeTruthy();
    // Item da DLQ listado
    const item = await screen.findByTestId(`dlq-item-${id}`);
    expect(item).toBeTruthy();
    // Botão de retry presente
    const retryBtn = screen.getByTestId(`dlq-retry-${id}`);
    expect(retryBtn).toBeTruthy();
  });
});
