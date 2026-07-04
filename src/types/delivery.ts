/** Backend FSM status from DeliveryResource */
export type DeliveryApiStatus =
  | 'pending'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'failed'
  | 'cancelled';

/** UI filter/display status */
export type DeliveryUiStatus = 'pending' | 'in_route' | 'delivered' | 'failed';

export interface DeliveryAddress {
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
}

export interface DeliveryApi {
  id: number;
  company_id: number;
  driver_id: number | null;
  reference_code: string;
  status: DeliveryApiStatus;
  delivery_address: DeliveryAddress | null;
  delivery_scheduled_at: string | null;
  delivered_at: string | null;
  recipient: { name: string | null; phone: string | null };
  package_count: number;
  weight_kg: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryViewModel {
  id: number;
  code: string;
  status: DeliveryApiStatus;
  uiStatus: DeliveryUiStatus;
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
  packageCount: number;
  weightKg: number | null;
  windowStart: string;
  windowEnd: string;
  notes: string | null;
}

export interface DeliveryListResponse {
  data: DeliveryApi[];
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}
