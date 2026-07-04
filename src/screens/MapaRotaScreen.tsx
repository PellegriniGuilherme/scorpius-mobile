import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, Text, View, Image, ActivityIndicator } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { fetchDeliveryWithCache } from '@/services/deliveryService';
import { mapDelivery } from '@/lib/mapDelivery';
import type { DeliveryViewModel } from '@/types/delivery';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AppStackParamList } from '@/navigation/types';

type Route_ = RouteProp<AppStackParamList, 'MapaRota'>;

interface LatLng {
  lat: number;
  lng: number;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function getGoogleMapsApiKey(): string {
  return (Constants.expoConfig?.extra as { googleMapsApiKey?: string } | undefined)?.googleMapsApiKey ?? '';
}

function buildStaticMapUrl(dest: LatLng, apiKey: string): string {
  const { lat, lng } = dest;
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: '15',
    size: '640x480',
    scale: '2',
    markers: `color:red|${lat},${lng}`,
    key: apiKey,
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

function MapPanel({
  dest,
  origin,
  apiKey,
  colors,
  tokens,
  customerName,
}: {
  dest: LatLng;
  origin: LatLng | null;
  apiKey: string;
  colors: ReturnType<typeof useTheme>['colors'];
  tokens: ReturnType<typeof useTheme>['tokens'];
  customerName: string;
}) {
  const region = useMemo(
    () => ({
      latitude: dest.lat,
      longitude: dest.lng,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    }),
    [dest.lat, dest.lng],
  );

  const polyline = origin
    ? [
        { latitude: origin.lat, longitude: origin.lng },
        { latitude: dest.lat, longitude: dest.lng },
      ]
    : [];

  if (!apiKey) {
    return (
      <View
        testID="map-fallback"
        style={{
          height: 240,
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
          height: 240,
          borderRadius: tokens.radius.lg,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.borderDefault,
        }}
      >
        <Image
          testID="google-static-map"
          source={{ uri: buildStaticMapUrl(dest, apiKey) }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View
      style={{
        height: 240,
        borderRadius: tokens.radius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.borderDefault,
      }}
    >
      <MapView
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
        {polyline.length === 2 && (
          <Polyline testID="map-route-polyline" coordinates={polyline} strokeColor="#2563eb" strokeWidth={3} />
        )}
      </MapView>
    </View>
  );
}

export function MapaRotaScreen() {
  const route = useRoute<Route_>();
  const { colors, tokens } = useTheme();
  const [delivery, setDelivery] = useState<DeliveryViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const apiKey = getGoogleMapsApiKey();

  useEffect(() => {
    void (async () => {
      const res = await fetchDeliveryWithCache(route.params.deliveryId);
      setDelivery(res.data ? mapDelivery(res.data) : null);
      setLoading(false);
    })();
  }, [route.params.deliveryId]);

  useEffect(() => {
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
    })();
  }, []);

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
  const km = origin ? haversineKm(origin.lat, origin.lng, dest.lat, dest.lng) : null;
  const min = km != null ? Math.max(5, Math.round((km / 30) * 60)) : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[5] }}>
        <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
          {ptBR.map.title}
        </Text>

        <MapPanel
          dest={destCoords}
          origin={origin}
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
        </Card>

        <Button
          label={ptBR.map.openExternal}
          variant="secondary"
          fullWidth
          onPress={() => {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`;
            void Linking.openURL(url).catch(() => undefined);
          }}
        />
      </ScrollView>
    </ScrollView>
  );
}
