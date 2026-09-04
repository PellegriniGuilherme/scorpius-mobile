import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Constants from 'expo-constants';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { getDeliveryRoute, type RouteEstimate } from '@/api/routes';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AppStackParamList } from '@/navigation/types';
import { formatFuelPrices, polylineToLatLng, type LatLng } from '@/screens/mapRouteUtils';

type Route_ = RouteProp<AppStackParamList, 'MapaRota'>;

function resolveGoogleMapsKey(): string {
  const extra = Constants.expoConfig?.extra as { googleMapsApiKey?: string } | undefined;
  return (extra?.googleMapsApiKey ?? '').trim();
}

function openDirections(lat: number, lng: number): void {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  void Linking.openURL(url).catch(() => undefined);
}

function formatPrices(prices: Record<string, number>): string {
  return formatFuelPrices(prices, {
    gasolina: ptBR.map.gasolina,
    etanol: ptBR.map.etanol,
    diesel: ptBR.map.diesel,
  });
}

export function MapaRotaScreen() {
  const route = useRoute<Route_>();
  const { colors, tokens } = useTheme();
  const [routeData, setRouteData] = useState<RouteEstimate | null>(null);
  const mapsKey = resolveGoogleMapsKey();
  const hasMapsKey = mapsKey.length > 0 && Platform.OS !== 'web';

  useEffect(() => {
    void getDeliveryRoute(route.params.deliveryId)
      .then(setRouteData)
      .catch(() => {
        setRouteData({
          distance_km: 12,
          duration_min: 25,
          toll_estimate: { estimated_total_brl: 0, plazas: [], disclaimer: 'Estimativa indisponível' },
          gas_stations: [],
          disclaimer: 'Modo offline',
        });
      });
  }, [route.params.deliveryId]);

  const coords = useMemo(() => polylineToLatLng(routeData?.polyline), [routeData?.polyline]);

  const origin: LatLng | null = routeData?.origin
    ? { latitude: routeData.origin.lat, longitude: routeData.origin.lng }
    : coords[0] ?? null;

  const destination: LatLng | null = routeData?.destination
    ? { latitude: routeData.destination.lat, longitude: routeData.destination.lng }
    : coords.length
      ? coords[coords.length - 1]
      : null;

  const initialRegion = useMemo(() => {
    const focus = destination ?? origin;
    if (!focus) {
      return { latitude: -23.5505, longitude: -46.6333, latitudeDelta: 0.2, longitudeDelta: 0.2 };
    }
    return {
      latitude: focus.latitude,
      longitude: focus.longitude,
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    };
  }, [destination, origin]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: tokens.space[6], gap: tokens.space[5] }}>
        <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
          {ptBR.map.title}
        </Text>

        {hasMapsKey ? (
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
              style={{ flex: 1 }}
              provider={PROVIDER_GOOGLE}
              initialRegion={initialRegion}
              showsUserLocation
            >
              {coords.length > 1 && (
                <Polyline coordinates={coords} strokeColor={colors.accent} strokeWidth={4} />
              )}
              {origin && (
                <Marker coordinate={origin} title={ptBR.map.origin} pinColor={colors.accent} />
              )}
              {destination && (
                <Marker coordinate={destination} title={ptBR.map.destination} pinColor="#2563eb" />
              )}
              {routeData?.gas_stations.map((s, i) => (
                <Marker
                  key={`gas-${i}`}
                  coordinate={{ latitude: s.lat, longitude: s.lng }}
                  title={s.brand ? `${s.brand} — ${s.name}` : s.name}
                  description={formatPrices(s.prices)}
                  pinColor="#ca8a04"
                  onCalloutPress={() => openDirections(s.lat, s.lng)}
                />
              ))}
              {routeData?.toll_estimate.plazas
                .filter((p) => p.lat != null && p.lng != null)
                .map((p, i) => (
                  <Marker
                    key={`toll-${i}`}
                    coordinate={{ latitude: p.lat!, longitude: p.lng! }}
                    title={p.name}
                    description={p.highway ? `${p.highway} · R$ ${p.tariff_brl.toFixed(2)}` : `R$ ${p.tariff_brl.toFixed(2)}`}
                    pinColor="#dc2626"
                  />
                ))}
            </MapView>
          </View>
        ) : (
          <Card>
            <Text style={{ fontWeight: tokens.weight.semibold, color: colors.textPrimary, marginBottom: tokens.space[2] }}>
              {ptBR.map.noKeyTitle}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm, lineHeight: 20 }}>
              {ptBR.map.placeholder}
            </Text>
          </Card>
        )}

        {routeData && (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.accent }}>
                  {ptBR.map.distance.replace('{km}', routeData.distance_km.toFixed(1))}
                </Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.accent }}>
                  {ptBR.map.duration.replace('{min}', String(routeData.duration_min))}
                </Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: tokens.text.lg, fontWeight: tokens.weight.bold, color: colors.accent }}>
                  R$ {routeData.toll_estimate.estimated_total_brl.toFixed(2)}
                </Text>
                <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted }}>pedágio est.</Text>
              </View>
            </View>
            <Text style={{ marginTop: tokens.space[2], color: colors.textMuted, fontSize: tokens.text.xs }}>
              {routeData.toll_estimate.disclaimer}
            </Text>
          </Card>
        )}

        {destination && (
          <Button
            label={ptBR.map.openExternal}
            variant="secondary"
            fullWidth
            onPress={() => openDirections(destination.latitude, destination.longitude)}
          />
        )}

        {routeData && (
          <Card>
            <Text style={{ fontWeight: tokens.weight.semibold, color: colors.textPrimary, marginBottom: tokens.space[2] }}>
              {ptBR.map.tollsTitle}
            </Text>
            {routeData.toll_estimate.plazas.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm }}>{ptBR.map.tollsEmpty}</Text>
            ) : (
              routeData.toll_estimate.plazas.map((p, i) => (
                <Pressable
                  key={`plaza-list-${i}`}
                  onPress={() => {
                    if (p.lat != null && p.lng != null) openDirections(p.lat, p.lng);
                  }}
                  style={{ marginBottom: tokens.space[2] }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: tokens.text.sm }}>
                    {p.name}
                    {p.highway ? ` · ${p.highway}` : ''} — R$ {p.tariff_brl.toFixed(2)}
                  </Text>
                </Pressable>
              ))
            )}
          </Card>
        )}

        {routeData && (
          <Card>
            <Text style={{ fontWeight: tokens.weight.semibold, color: colors.textPrimary, marginBottom: tokens.space[2] }}>
              {ptBR.map.stationsTitle}
            </Text>
            {routeData.gas_stations.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm }}>{ptBR.map.stationsEmpty}</Text>
            ) : (
              routeData.gas_stations.map((s, i) => (
                <Pressable
                  key={`station-list-${i}`}
                  onPress={() => openDirections(s.lat, s.lng)}
                  style={{ marginBottom: tokens.space[3] }}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: tokens.text.sm, fontWeight: tokens.weight.semibold }}>
                    {s.brand ? `${s.brand} — ${s.name}` : s.name}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: tokens.text.sm }}>
                    {s.distance_km} km
                    {formatPrices(s.prices) ? ` — ${formatPrices(s.prices)}` : ''}
                    {s.price_age_days != null
                      ? ` (${ptBR.map.ageDays.replace('{days}', String(s.price_age_days))})`
                      : ''}
                  </Text>
                  <Text style={{ color: colors.accent, fontSize: tokens.text.xs, marginTop: 2 }}>
                    {ptBR.map.openStation}
                  </Text>
                </Pressable>
              ))
            )}
          </Card>
        )}

        <Card>
          <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs, lineHeight: 18 }}>
            {routeData?.disclaimer ?? ptBR.map.placeholder}
          </Text>
        </Card>
      </View>
    </ScrollView>
  );
}
