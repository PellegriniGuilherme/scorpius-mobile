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
export type DeliveryUiStatus = 'pending' | 'picked_up' | 'in_route' | 'delivered' | 'failed';

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

export interface ProofRequirements {
  requires_photo: boolean;
  requires_signature: boolean;
}

export interface DeliveryFailure {
  failed_at: string | null;
  reason: string;
}

export interface DeliveryApi {
  id: number;
  company_id: number;
  driver_id: number | null;
  reference_code: string;
  status: DeliveryApiStatus;
  pickup_address: DeliveryAddress | null;
  delivery_address: DeliveryAddress | null;
  delivery_scheduled_at: string | null;
  delivery_window_start: string | null;
  delivery_window_end: string | null;
  delivered_at: string | null;
  recipient: { name: string | null; phone: string | null };
  package_count: number;
  weight_kg: number | null;
  notes: string | null;
  failure?: DeliveryFailure | null;
  proof_requirements?: ProofRequirements;
  created_at: string;
  updated_at: string;
}

export interface DeliveryViewModel {
  id: number;
  code: string;
  status: DeliveryApiStatus;
  uiStatus: DeliveryUiStatus;
  customer: { name: string; phone: string };
  pickupAddress: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
    lat: number;
    lng: number;
  };
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
  windowStart: string | null;
  windowEnd: string | null;
  notes: string | null;
  failureReason: string | null;
  proofRequirements: ProofRequirements;
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
