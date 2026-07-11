/**
 * Scorpius Move — GPS tracking durante entrega em trânsito.
 *
 * Inicia ao confirmar "Iniciar rota" e envia pontos via TelemetryService
 * enquanto a entrega permanece em `in_transit`.
 */
import * as Location from 'expo-location';
import { deliveryCache } from '@/services/DeliveryCacheService';
import { telemetryService } from '@/services/TelemetryService';

export interface TrackedLocation {
  lat: number;
  lng: number;
  recordedAt: string;
}

type LocationListener = (location: TrackedLocation) => void;

const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.Balanced,
  distanceInterval: 50,
  timeInterval: 15_000,
};

class LocationTrackingService {
  private subscription: Location.LocationSubscription | null = null;
  private deliveryId: number | null = null;
  private lastLocation: TrackedLocation | null = null;
  private listeners = new Set<LocationListener>();

  getActiveDeliveryId(): number | null {
    return this.deliveryId;
  }

  isTrackingDelivery(deliveryId: number): boolean {
    return this.deliveryId === deliveryId && this.subscription != null;
  }

  getLastLocation(): TrackedLocation | null {
    return this.lastLocation;
  }

  subscribe(listener: LocationListener): () => void {
    this.listeners.add(listener);
    if (this.lastLocation) {
      listener(this.lastLocation);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  async startTracking(deliveryId: number): Promise<boolean> {
    if (this.isTrackingDelivery(deliveryId)) {
      return true;
    }

    await this.stopTracking();

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return false;
    }

    this.deliveryId = deliveryId;

    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    this.handlePosition(position.coords.latitude, position.coords.longitude);

    this.subscription = await Location.watchPositionAsync(WATCH_OPTIONS, (next) => {
      this.handlePosition(next.coords.latitude, next.coords.longitude);
    });

    return true;
  }

  async stopTracking(): Promise<void> {
    this.subscription?.remove();
    this.subscription = null;
    this.deliveryId = null;
    await telemetryService.flush();
  }

  private handlePosition(lat: number, lng: number): void {
    const point: TrackedLocation = {
      lat,
      lng,
      recordedAt: new Date().toISOString(),
    };
    this.lastLocation = point;

    if (this.deliveryId != null) {
      telemetryService.record({
        lat,
        lng,
        recorded_at: point.recordedAt,
        delivery_id: this.deliveryId,
      });
    }

    for (const listener of this.listeners) {
      listener(point);
    }
  }
}

export const locationTrackingService = new LocationTrackingService();

export async function syncLocationTrackingWithStatus(
  deliveryId: number,
  status: string,
): Promise<void> {
  if (status === 'in_transit') {
    await locationTrackingService.startTracking(deliveryId);
    return;
  }

  if (locationTrackingService.getActiveDeliveryId() === deliveryId) {
    await locationTrackingService.stopTracking();
  }
}

export async function resumeLocationTrackingFromCache(): Promise<void> {
  const deliveries = await deliveryCache.listAll();
  const inTransit = deliveries.find((delivery) => delivery.status === 'in_transit');
  if (!inTransit) {
    return;
  }
  await locationTrackingService.startTracking(inTransit.id);
}

export function _resetLocationTrackingForTests(): void {
  locationTrackingService['subscription']?.remove();
  locationTrackingService['subscription'] = null;
  locationTrackingService['deliveryId'] = null;
  locationTrackingService['lastLocation'] = null;
  locationTrackingService['listeners'].clear();
}
