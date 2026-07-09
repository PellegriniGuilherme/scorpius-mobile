import { useRoute, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { renderWithTheme, fireEvent, screen, waitFor } from '@/../jest.test-utils';
import { ReportarOcorrenciaScreen } from './ReportarOcorrenciaScreen';
import { fetchOccurrenceTypesWithCache } from '@/services/occurrenceTypeService';
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

jest.mock('@/services/occurrenceTypeService', () => ({
  fetchOccurrenceTypesWithCache: jest.fn(),
}));

const mockTypes = [
  {
    id: 1,
    slug: 'accident',
    name: 'Acidente',
    severity: 'critical',
    requires_photo: true,
    is_active: true,
    origin: 'system' as const,
  },
  {
    id: 2,
    slug: 'delay',
    name: 'Atraso',
    severity: 'low',
    requires_photo: false,
    is_active: true,
    origin: 'system' as const,
  },
];

const goBack = jest.fn();

function setRouteParams(params: { deliveryId: number }) {
  (useRoute as jest.Mock).mockReturnValue({
    params,
    key: 'test',
    name: 'ReportarOcorrencia',
  });
}

describe('ReportarOcorrenciaScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetMockDb();
    (useNavigation as jest.Mock).mockReturnValue({ goBack });
    (fetchOccurrenceTypesWithCache as jest.Mock).mockResolvedValue({
      data: mockTypes,
      fromCache: false,
    });
    (ImagePicker.launchCameraAsync as jest.Mock).mockReset();
    syncWorker.setApiClient({
      uploadProof: jest.fn().mockResolvedValue(undefined),
      uploadOccurrence: jest.fn().mockResolvedValue(undefined),
    });
  });

  it('renders occurrence types in select', async () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ReportarOcorrenciaScreen />);
    expect(await screen.findByText('Reportar ocorrência')).toBeTruthy();
    expect(screen.getByTestId('occurrence-type-trigger')).toBeTruthy();
    expect(screen.getByText('Acidente')).toBeTruthy();
  });

  it('shows photo section when selected type requires photo', async () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ReportarOcorrenciaScreen />);
    await screen.findByText('Foto da ocorrência');
    expect(screen.getByText('Foto obrigatória para este tipo')).toBeTruthy();
  });

  it('keeps submit disabled until photo is captured for required types', async () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ReportarOcorrenciaScreen />);
    const submit = await screen.findByText('Enviar');
    expect(submit).toBeDisabled();
  });

  it('enqueues occurrence with photo when required type has photo', async () => {
    (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///tmp/occurrence.jpg' }],
    });
    const enqueueSpy = jest.spyOn(outbox, 'enqueue');

    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ReportarOcorrenciaScreen />);
    fireEvent.press(await screen.findByTestId('occurrence-capture-photo'));
    await waitFor(() => expect(screen.getByText('Foto capturada')).toBeTruthy());

    fireEvent.press(screen.getByText('Enviar'));

    await waitFor(() => {
      expect(enqueueSpy).toHaveBeenCalledWith(
        'occurrence_report',
        expect.objectContaining({
          photoPath: expect.stringContaining('occurrences'),
          occurrence: expect.objectContaining({
            delivery_id: 1001,
            type: 'accident',
          }),
        }),
      );
    });
    expect(goBack).toHaveBeenCalled();
  });

  it('allows submit without photo when type does not require it', async () => {
    setRouteParams({ deliveryId: 1001 });
    renderWithTheme(<ReportarOcorrenciaScreen />);
    await screen.findByText('Reportar ocorrência');

    fireEvent.press(screen.getByTestId('occurrence-type-trigger'));
    fireEvent.press(screen.getByTestId('occurrence-type-option-delay'));

    const enqueueSpy = jest.spyOn(outbox, 'enqueue');
    fireEvent.press(screen.getByText('Enviar'));

    await waitFor(() => {
      expect(enqueueSpy).toHaveBeenCalledWith(
        'occurrence_report',
        expect.objectContaining({
          photoPath: undefined,
          occurrence: expect.objectContaining({ type: 'delay' }),
        }),
      );
    });
    expect(screen.queryByText('Foto da ocorrência')).toBeNull();
  });
});
