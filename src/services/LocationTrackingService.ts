/**
 * Scorpius Move — GPS tracking durante entrega ativa (retirada / em rota).
 *
 * Inicia ao abrir entrega em `picked_up`/`in_transit`, ao confirmar ações FSM,
 * ou ao retomar do cache após login. Envia pontos via TelemetryService.
 * Com permissão background, usa TaskManager + startLocationUpdatesAsync.
 */
import * as Location from 'expo-location';
import { deliveryCache } from '@/services/DeliveryCacheService';
import { telemetryService } from '@/services/TelemetryService';
import {
  setActiveTrackingDeliveryId,
} from '@/lib/activeTrackingStore';
import { LOCATION_TASK_NAME } from '@/tasks/locationTrackingTask';
import type { DeliveryApi } from '@/types/delivery';

export interface TrackedLocation {
  lat: number;
  lng: number;
  recordedAt: string;
}

export interface LocationPermissionState {
  foreground: Location.PermissionStatus;
  background: Location.PermissionStatus;
}

type LocationListener = (location: TrackedLocation) => void;

const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.Balanced,
  distanceInterval: 50,
  timeInterval: 15_000,
};

const BACKGROUND_TASK_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.Balanced,
  distanceInterval: 50,
  timeInterval: 15_000,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: 'Scorpius Move',
    notificationBody: 'Rastreando sua rota de entrega',
    notificationColor: '#f97316',
  },
};

const TRACKABLE_STATUSES = new Set(['picked_up', 'in_transit']);

export function isTrackableDeliveryStatus(status: string): boolean {
  return TRACKABLE_STATUSES.has(status);
}

export async function requestLocationPermissions(): Promise<LocationPermissionState> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    return { foreground: foreground.status, background: 'denied' as Location.PermissionStatus };
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  return { foreground: foreground.status, background: background.status };
}

class LocationTrackingService {
  private subscription: Location.LocationSubscription | null = null;
  private deliveryId: number | null = null;
  private lastLocation: TrackedLocation | null = null;
  private listeners = new Set<LocationListener>();
  private usingBackgroundTask = false;

  getActiveDeliveryId(): number | null {
    return this.deliveryId;
  }

  isTrackingDelivery(deliveryId: number): boolean {
    return this.deliveryId === deliveryId && (this.subscription != null || this.usingBackgroundTask);
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

    const permissions = await requestLocationPermissions();
    if (permissions.foreground !== 'granted') {
      return false;
    }

    this.deliveryId = deliveryId;
    await setActiveTrackingDeliveryId(deliveryId);

    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    this.handlePosition(position.coords.latitude, position.coords.longitude);

    if (permissions.background === 'granted') {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!hasStarted) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, BACKGROUND_TASK_OPTIONS);
      }
      this.usingBackgroundTask = true;
    } else {
      this.subscription = await Location.watchPositionAsync(WATCH_OPTIONS, (next) => {
        this.handlePosition(next.coords.latitude, next.coords.longitude);
      });
    }

    return true;
  }

  async stopTracking(): Promise<void> {
    this.subscription?.remove();
    this.subscription = null;

    if (this.usingBackgroundTask) {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
      this.usingBackgroundTask = false;
    }

    this.deliveryId = null;
    await setActiveTrackingDeliveryId(null);
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
): Promise<boolean> {
  if (isTrackableDeliveryStatus(status)) {
    return locationTrackingService.startTracking(deliveryId);
  }

  if (locationTrackingService.getActiveDeliveryId() === deliveryId) {
    await locationTrackingService.stopTracking();
  }
  return true;
}

function pickActiveDelivery(deliveries: DeliveryApi[]): DeliveryApi | null {
  const inTransit = deliveries.find((delivery) => delivery.status === 'in_transit');
  if (inTransit) {
    return inTransit;
  }
  return deliveries.find((delivery) => delivery.status === 'picked_up') ?? null;
}

export async function syncTrackingForCachedDeliveries(deliveries: DeliveryApi[]): Promise<void> {
  const active = pickActiveDelivery(deliveries);
  if (!active) {
    if (locationTrackingService.getActiveDeliveryId() != null) {
      await locationTrackingService.stopTracking();
    }
    return;
  }

  const currentId = locationTrackingService.getActiveDeliveryId();
  if (currentId === active.id) {
    return;
  }

  await locationTrackingService.startTracking(active.id);
}

export async function resumeLocationTrackingFromCache(): Promise<void> {
  const deliveries = await deliveryCache.listAll();
  await syncTrackingForCachedDeliveries(deliveries);
}

export function _resetLocationTrackingForTests(): void {
  locationTrackingService['subscription']?.remove();
  locationTrackingService['subscription'] = null;
  locationTrackingService['deliveryId'] = null;
  locationTrackingService['lastLocation'] = null;
  locationTrackingService['usingBackgroundTask'] = false;
  locationTrackingService['listeners'].clear();
}
