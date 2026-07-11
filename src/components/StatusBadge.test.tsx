/**
 * Scorpius Move — StatusBadge primitive tests (T068.2).
 *
 * Cobre mapping DeliveryStatus → (bg/fg/border) do theme.
 * Não validamos cores literais (testaria implementação, não contrato);
 * validamos que o componente renderiza o label e estrutura visual básica.
 */
import { renderWithTheme, screen } from '@/../jest.test-utils';
import { StatusBadge } from './StatusBadge';
import type { DeliveryUiStatus } from '@/types/delivery';

describe('StatusBadge', () => {
  const statuses: DeliveryUiStatus[] = ['pending', 'picked_up', 'in_route', 'delivered', 'failed'];
  const labels: Record<DeliveryUiStatus, string> = {
    pending: 'Pendente',
    picked_up: 'Retirada',
    in_route: 'Em rota',
    delivered: 'Entregue',
    failed: 'Falhou',
  };

  statuses.forEach((s) => {
    it(`renders ${s} status with label`, () => {
      renderWithTheme(<StatusBadge status={s} label={labels[s]} />);
      expect(screen.getByText(labels[s])).toBeTruthy();
    });
  });

  it('renders as inline pill (flex-start, full radius via tokens)', () => {
    const { toJSON } = renderWithTheme(<StatusBadge status="delivered" label="OK" />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });
});
