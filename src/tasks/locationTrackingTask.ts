import * as TaskManager from 'expo-task-manager';
import { getActiveTrackingDeliveryId } from '@/lib/activeTrackingStore';
import { telemetryService } from '@/services/TelemetryService';

export const LOCATION_TASK_NAME = 'scorpius-background-location';

interface LocationTaskPayload {
  locations?: Array<{
    coords: { latitude: number; longitude: number };
    timestamp: number;
  }>;
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    return;
  }

  const deliveryId = await getActiveTrackingDeliveryId();
  if (deliveryId == null) {
    return;
  }

  const locations = (data as LocationTaskPayload | undefined)?.locations;
  const latest = locations?.[locations.length - 1];
  if (!latest) {
    return;
  }

  telemetryService.record({
    lat: latest.coords.latitude,
    lng: latest.coords.longitude,
    recorded_at: new Date(latest.timestamp).toISOString(),
    delivery_id: deliveryId,
  });
});
