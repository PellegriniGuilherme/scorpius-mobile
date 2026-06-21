/**
 * Scorpius Move — Mock data para entregas do motorista.
 *
 * O backend real (Vulcan) está expondo endpoints em /driver/* ainda em
 * paralelo (T068.x). Para o MVP do F2 Mobile Foundation, usamos dados
 * locais que refletem o shape esperado.
 */
export type DeliveryStatus = 'pending' | 'in_route' | 'delivered' | 'failed';

export interface DeliveryItem {
  sku: string;
  description: string;
  quantity: number;
}

export interface Delivery {
  id: number;
  code: string;
  status: DeliveryStatus;
  customer: { name: string; phone: string };
  address: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
    lat: number;
    lng: number;
  };
  items: DeliveryItem[];
  scheduled_for: string;
  window_start: string;
  window_end: string;
  driver_id: number;
  proof_url?: string | null;
}

export const MOCK_DELIVERIES: Delivery[] = [
  {
    id: 1001,
    code: 'SC-1001',
    status: 'pending',
    customer: { name: 'Mercado Central Ltda', phone: '+551133334444' },
    address: { street: 'Av. Paulista', number: '1500', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP', zip: '01310-100', lat: -23.5613, lng: -46.6565 },
    items: [
      { sku: 'SKU-001', description: 'Caixa papelão 30x30x30', quantity: 5 },
      { sku: 'SKU-002', description: 'Envelope pardo A3', quantity: 2 },
    ],
    scheduled_for: '2026-06-21T08:00:00-03:00',
    window_start: '2026-06-21T08:00:00-03:00',
    window_end: '2026-06-21T12:00:00-03:00',
    driver_id: 91,
  },
  {
    id: 1002,
    code: 'SC-1002',
    status: 'in_route',
    customer: { name: 'Farmácia Paulista', phone: '+551144445555' },
    address: { street: 'Rua Augusta', number: '2200', neighborhood: 'Consolação', city: 'São Paulo', state: 'SP', zip: '01304-001', lat: -23.5577, lng: -46.6622 },
    items: [
      { sku: 'SKU-010', description: 'Medicamento controlado A', quantity: 1 },
      { sku: 'SKU-011', description: 'Medicamento controlado B', quantity: 2 },
    ],
    scheduled_for: '2026-06-21T09:30:00-03:00',
    window_start: '2026-06-21T09:30:00-03:00',
    window_end: '2026-06-21T13:30:00-03:00',
    driver_id: 91,
  },
  {
    id: 1003,
    code: 'SC-1003',
    status: 'delivered',
    customer: { name: 'Hospital Norte', phone: '+551155556666' },
    address: { street: 'Av. Engenheiro Luís Carlos Berrini', number: '500', neighborhood: 'Cidade Monções', city: 'São Paulo', state: 'SP', zip: '04571-000', lat: -23.6108, lng: -46.6953 },
    items: [{ sku: 'SKU-020', description: 'Equipamento médico', quantity: 1 }],
    scheduled_for: '2026-06-21T11:00:00-03:00',
    window_start: '2026-06-21T11:00:00-03:00',
    window_end: '2026-06-21T15:00:00-03:00',
    driver_id: 91,
    proof_url: null,
  },
];

export function findDelivery(id: number): Delivery | undefined {
  return MOCK_DELIVERIES.find((d) => d.id === id);
}
