import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, Text, View, Image, ActivityIndicator } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { fetchDeliveryWithCache } from '@/services/deliveryService';
import { locationTrackingService } from '@/services/LocationTrackingService';
import { mapDelivery } from '@/lib/mapDelivery';
import { fetchDrivingRouteWithCache, type DrivingRoute, type LatLng } from '@/lib/googleDirections';
import type { MapCoordinate } from '@/lib/decodePolyline';
import type { DeliveryViewModel } from '@/types/delivery';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AppStackParamList } from '@/navigation/types';

type Route_ = RouteProp<AppStackParamList, 'MapaRota'>;

function getGoogleMapsApiKey(): string {
  return (Constants.expoConfig?.extra as { googleMapsApiKey?: string } | undefined)?.googleMapsApiKey ?? '';
}

function buildStaticMapUrl(dest: LatLng, apiKey: string, encodedRoute?: string): string {
  const { lat, lng } = dest;
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: '14',
    size: '640x480',
    scale: '2',
    markers: `color:red|${lat},${lng}`,
    key: apiKey,
  });
  if (encodedRoute) {
    params.set('path', `weight:4|color:0x2563eb|enc:${encodedRoute}`);
  }
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

function MapPanel({
  dest,
  origin,
  route,
  loadingRoute,
  apiKey,
  colors,
  tokens,
  customerName,
}: {
  dest: LatLng;
  origin: LatLng | null;
  route: DrivingRoute | null;
  loadingRoute: boolean;
  apiKey: string;
  colors: ReturnType<typeof useTheme>['colors'];
  tokens: ReturnType<typeof useTheme>['tokens'];
  customerName: string;
}) {
  const mapRef = useRef<MapView>(null);

  const region = useMemo(
    () => ({
      latitude: dest.lat,
      longitude: dest.lng,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    }),
    [dest.lat, dest.lng],
  );

  const routeCoordinates: MapCoordinate[] = route?.coordinates ?? [];

  useEffect(() => {
    if (!mapRef.current || routeCoordinates.length < 2) return;
    mapRef.current.fitToCoordinates(routeCoordinates, {
      edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
      animated: true,
    });
  }, [routeCoordinates]);

  if (!apiKey) {
    return (
      <View
        testID="map-fallback"
        style={{
          height: 280,
          borderRadius: tokens.radius.lg,
          borderWidth: 1,
          borderColor: colors.borderDefault,
          backgroundColor: colors.surfacePanel,
          alignItems: 'center',
          justifyContent: 'center',
          padding: tokens.space[4],
        }}
      >
        <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: tokens.text.sm }}>
          {ptBR.map.apiKeyMissing}
        </Text>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View
        style={{
          height: 280,
          borderRadius: tokens.radius.lg,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.borderDefault,
        }}
      >
        <Image
          testID="google-static-map"
          source={{ uri: buildStaticMapUrl(dest, apiKey, route?.encodedPolyline) }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View
      style={{
        height: 280,
        borderRadius: tokens.radius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.borderDefault,
      }}
    >
      <MapView
        ref={mapRef}
        testID="google-map"
        provider={PROVIDER_GOOGLE}
        style={{ width: '100%', height: '100%' }}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {origin && (
          <Marker
            testID="map-marker-origin"
            coordinate={{ latitude: origin.lat, longitude: origin.lng }}
            title={ptBR.map.origin}
          />
        )}
        <Marker
          testID="map-marker-destination"
          coordinate={{ latitude: dest.lat, longitude: dest.lng }}
          title={ptBR.map.destination}
          description={customerName}
        />
        {routeCoordinates.length > 1 && (
          <Polyline
            testID="map-route-polyline"
            coordinates={routeCoordinates}
            strokeColor="#2563eb"
            strokeWidth={4}
          />
        )}
      </MapView>
      {loadingRoute && (
        <View
          style={{
            position: 'absolute',
            top: tokens.space[2],
            right: tokens.space[2],
            backgroundColor: colors.surfacePanel,
            borderRadius: tokens.radius.md,
            padding: tokens.space[2],
          }}
        >
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      )}
    </View>
  );
}

export function MapaRotaScreen() {
  const route = useRoute<Route_>();
  const { colors, tokens } = useTheme();
  const [delivery, setDelivery] = useState<DeliveryViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [drivingRoute, setDrivingRoute] = useState<DrivingRoute | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeFromCache, setRouteFromCache] = useState(false);
  const apiKey = getGoogleMapsApiKey();

  useEffect(() => {
    void (async () => {
      const res = await fetchDeliveryWithCache(route.params.deliveryId);
      setDelivery(res.data ? mapDelivery(res.data) : null);
      setLoading(false);
    })();
  }, [route.params.deliveryId]);

  useEffect(() => {
    if (!delivery) return;

    if (locationTrackingService.isTrackingDelivery(delivery.id)) {
      return locationTrackingService.subscribe((point) => {
        setUserLocation({ lat: point.lat, lng: point.lng });
      });
    }

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (cancelled) return;
      setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 50,
          timeInterval: 15_000,
        },
        (next) => {
          setUserLocation({ lat: next.coords.latitude, lng: next.coords.longitude });
        },
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [delivery]);

  useEffect(() => {
    if (!userLocation || !delivery || !apiKey) {
      setDrivingRoute(null);
      return;
    }

    const destCoords: LatLng = { lat: delivery.address.lat, lng: delivery.address.lng };
    let cancelled = false;

    void (async () => {
      setLoadingRoute(true);
      const { route: result, fromCache } = await fetchDrivingRouteWithCache(userLocation, destCoords, apiKey);
      if (!cancelled) {
        setDrivingRoute(result);
        setRouteFromCache(fromCache);
        setLoadingRoute(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userLocation, delivery, apiKey]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!delivery) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: tokens.space[6] }}>
        <Text style={{ color: colors.textMuted }}>Entrega não encontrada.</Text>
      </View>
    );
  }

  const dest = delivery.address;
  const destCoords: LatLng = { lat: dest.lat, lng: dest.lng };
  const origin = userLocation;
  const km = drivingRoute?.distanceKm ?? null;
  const min = drivingRoute?.durationMin ?? null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[5] }}
    >
        <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
          {ptBR.map.title}
        </Text>

        <MapPanel
          dest={destCoords}
          origin={origin}
          route={drivingRoute}
          loadingRoute={loadingRoute}
          apiKey={apiKey}
          colors={colors}
          tokens={tokens}
          customerName={delivery.customer.name}
        />

        <Card>
          <Text style={{ color: colors.textPrimary, fontSize: tokens.text.sm }}>
            {dest.street}, {dest.number} — {dest.neighborhood}, {dest.city}
          </Text>
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <Text style={{ color: colors.accent, fontWeight: tokens.weight.bold }}>
              {km != null ? ptBR.map.distance.replace('{km}', km.toFixed(1)) : '— km'}
            </Text>
            <Text style={{ color: colors.accent, fontWeight: tokens.weight.bold }}>
              {min != null ? ptBR.map.duration.replace('{min}', String(min)) : '— min'}
            </Text>
          </View>
          {loadingRoute && (
            <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs, textAlign: 'center', marginTop: tokens.space[2] }}>
              {ptBR.map.calculatingRoute}
            </Text>
          )}
          {!loadingRoute && routeFromCache && drivingRoute && (
            <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs, textAlign: 'center', marginTop: tokens.space[2] }}>
              {ptBR.map.routeFromCache}
            </Text>
          )}
        </Card>

        <Button
          label={ptBR.map.openExternal}
          variant="secondary"
          fullWidth
          onPress={() => {
            const originParam = origin ? `&origin=${origin.lat},${origin.lng}` : '';
            const url = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}${originParam}&travelmode=driving`;
            void Linking.openURL(url).catch(() => undefined);
          }}
        />
    </ScrollView>
  );
}
