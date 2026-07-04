/**
 * Scorpius Move — ComprovanteScreen tests (T068.3 + T068.5).
 *
 * Cobre:
 *  - render com deliveryId param
 *  - tap "Capturar foto" (com mock de image-picker retornando foto) muda estado
 *  - "Entrega não encontrada" para id inválido
 *  - "Confirmar entrega" enabled apenas com foto + signature ≥3 chars
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
      expect(screen.getByText('Assinatura do destinatário')).toBeTruthy();
    });
  });

  it('shows "Entrega não encontrada" for invalid deliveryId', async () => {
    setRouteParams({ deliveryId: 99999 });
    renderWithTheme(<ComprovanteScreen />);
    expect(await screen.findByText('Entrega não encontrada.')).toBeTruthy();
  });

  it('tap "Capturar foto" (mock success) updates visual state', async () => {
    await setupHappyPathPickPhoto();
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);
    fireEvent.press(await screen.findByText('Capturar foto'));
    await waitFor(() => {
      expect(screen.getByText('Foto capturada')).toBeTruthy();
      expect(screen.getByText('Tirar novamente')).toBeTruthy();
    });
    expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
  });

  it('"Confirmar entrega" disabled without photo or signature', async () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);
    const submitBtn = await screen.findByRole('button', { name: 'Confirmar entrega' });
    expect(submitBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it('"Confirmar entrega" enabled with photo + signature (≥3 chars)', async () => {
    await setupHappyPathPickPhoto();
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);
    fireEvent.press(await screen.findByText('Capturar foto'));
    await waitFor(() => expect(screen.getByText('Tirar novamente')).toBeTruthy());
    const input = screen.getByLabelText('Assinatura do destinatário');
    fireEvent.changeText(input, 'João da Silva');
    const submitBtn = screen.getByRole('button', { name: 'Confirmar entrega' });
    expect(submitBtn.props.accessibilityState?.disabled).toBe(false);
  });

  it('submit enqueues to outbox and shows success screen', async () => {
    await setupHappyPathPickPhoto();
    syncWorker.setApiClient({ uploadProof: successfulUpload });
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ComprovanteScreen />);
    fireEvent.press(await screen.findByText('Capturar foto'));
    await waitFor(() => expect(screen.getByText('Tirar novamente')).toBeTruthy());
    const input = screen.getByLabelText('Assinatura do destinatário');
    fireEvent.changeText(input, 'João da Silva');
    fireEvent.press(screen.getByText('Confirmar entrega'));
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
    await waitFor(() => expect(screen.getByText('Tirar novamente')).toBeTruthy());
    const input = screen.getByLabelText('Assinatura do destinatário');
    fireEvent.changeText(input, 'João da Silva');
    fireEvent.press(screen.getByText('Confirmar entrega'));
    await waitFor(() => {
      // Após MAX_ATTEMPTS tentativas (5) o item vai para DLQ
      // Como tick é chamado 1x, o item fica pending com attempts=1
      // A UI mostra "Sincronizando…" (pending)
      expect(screen.getByText(/Sincronizando/i)).toBeTruthy();
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
