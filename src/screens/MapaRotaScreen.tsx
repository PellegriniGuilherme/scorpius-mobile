/**
 * Scorpius Move — MapaRotaScreen (T080: Google Maps).
 *
 * Decisão Guilherme 12:06: Mapa = Google Maps (NÃO OpenStreetMap).
 * Usa `react-native-maps` com `provider={PROVIDER_GOOGLE}`.
 *
 * API key: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` em runtime via
 * `Constants.expoConfig.extra.googleMapsApiKey`. Sem key, cai
 * para placeholder visual com aviso (UX não quebra).
 *
 * expo-location é chamado para ACCESS_FINE_LOCATION no mount,
 * exibindo a posição atual do motorista no mapa.
 */
import { useEffect, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { findDelivery } from '@/mocks/deliveries';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AppStackParamList } from '@/navigation/types';

type Route_ = RouteProp<AppStackParamList, 'MapaRota'>;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const ORIGIN = { lat: -23.5613, lng: -46.6565, label: 'Hub Scorpius — Av. Paulista' };

function getApiKey(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as { googleMapsApiKey?: string };
  return extra.googleMapsApiKey ?? '';
}

/**
 * T091 R3: silent failure guard. Em production, se a Google Maps API key
 * estiver ausente, emite console.warn para visibilidade em produção
 * (sentry/logs) — antes disso a tela mostrava fallback visual sem
 * ninguém saber que o mapa real não estava renderizando.
 */
function warnIfMissingMapsKeyInProd(apiKey: string): void {
  if (apiKey.length === 0 && !__DEV__) {
    console.warn(
      '[MapaRotaScreen] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ausente em production. ' +
      'Mapa vai mostrar fallback visual. Definir key em .env e rebuild.',
    );
  }
}

export function MapaRotaScreen() {
  const route = useRoute<Route_>();
  const { colors, tokens } = useTheme();
  const delivery = findDelivery(route.params.deliveryId);
  const apiKey = getApiKey();
  const hasGoogleMaps = apiKey.length > 0;
  warnIfMissingMapsKeyInProd(apiKey);

  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasGoogleMaps) return; // Não pedir permission se não vai usar o mapa real
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Permissão de localização negada');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        setCurrentLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch (err) {
        setLocationError(err instanceof Error ? err.message : 'Erro ao obter localização');
      }
    })();
  }, [hasGoogleMaps]);

  if (!delivery) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: tokens.space[6] }}>
        <Text style={{ color: colors.textMuted }}>Entrega não encontrada.</Text>
      </View>
    );
  }

  const dest = delivery.address;
  const km = haversineKm(ORIGIN.lat, ORIGIN.lng, dest.lat, dest.lng);
  const min = Math.max(5, Math.round((km / 30) * 60));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[5] }}>
        <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
          {ptBR.map.title}
        </Text>

        {/* Mapa: Google Maps real se API key presente, OSM fallback caso contrário */}
        <View
          style={{
            height: 240,
            backgroundColor: colors.surfaceInset,
            borderColor: colors.borderDefault,
            borderWidth: 1,
            borderRadius: tokens.radius.lg,
            overflow: 'hidden',
          }}
        >
          {hasGoogleMaps ? (
            <MapView
              provider={PROVIDER_GOOGLE}
              testID="map"
              style={{ width: '100%', height: '100%' }}
              initialRegion={{
                latitude: dest.lat,
                longitude: dest.lng,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              <Marker
                testID="marker-origin"
                coordinate={{ latitude: ORIGIN.lat, longitude: ORIGIN.lng }}
                title={ORIGIN.label}
                pinColor="blue"
              />
              <Marker
                testID="marker-dest"
                coordinate={{ latitude: dest.lat, longitude: dest.lng }}
                title={`${dest.street}, ${dest.number}`}
                pinColor="red"
              />
              {currentLocation && (
                <Marker
                  testID="marker-current"
                  coordinate={currentLocation}
                  title="Você está aqui"
                  pinColor="green"
                />
              )}
              <Polyline
                testID="polyline"
                coordinates={[
                  { latitude: ORIGIN.lat, longitude: ORIGIN.lng },
                  { latitude: dest.lat, longitude: dest.lng },
                ]}
                strokeColor={colors.accent}
                strokeWidth={3}
              />
            </MapView>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: tokens.space[4] }}>
              <Text style={{ color: colors.statusDangerText, fontWeight: tokens.weight.semibold, textAlign: 'center' }}>
                ⚠️ Google Maps API key não configurada
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm, textAlign: 'center', marginTop: tokens.space[2] }}>
                Defina EXPO_PUBLIC_GOOGLE_MAPS_API_KEY em .env
              </Text>
            </View>
          )}
        </View>

        {/* Info card: origem → destino */}
        <Card>
          <View style={{ gap: tokens.space[3] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, textTransform: 'uppercase' }}>
                  {ptBR.map.origin}
                </Text>
                <Text style={{ color: colors.textPrimary, fontSize: tokens.text.sm }}>{ORIGIN.label}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.statusInfoMarker }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, textTransform: 'uppercase' }}>
                  {ptBR.map.destination}
                </Text>
                <Text style={{ color: colors.textPrimary, fontSize: tokens.text.sm }}>
                  {dest.street}, {dest.number}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: tokens.text.xs }}>
                  {dest.neighborhood}, {dest.city}
                </Text>
              </View>
            </View>
            {locationError && (
              <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs, fontStyle: 'italic' }}>
                📍 {locationError}
              </Text>
            )}
          </View>
        </Card>

        {/* Distance + Duration */}
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center', gap: tokens.space[1] }}>
              <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.accent }}>
                {ptBR.map.distance.replace('{km}', km.toFixed(1))}
              </Text>
              <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted }}>distância</Text>
            </View>
            <View style={{ alignItems: 'center', gap: tokens.space[1] }}>
              <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.accent }}>
                {ptBR.map.duration.replace('{min}', String(min))}
              </Text>
              <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted }}>estimativa</Text>
            </View>
          </View>
        </Card>

        {/* Open external (Google Maps directions) */}
        <Button
          label="Abrir no Google Maps"
          variant="secondary"
          fullWidth
          onPress={() => {
            const url = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`;
            void Linking.openURL(url).catch(() => undefined);
          }}
        />

        <Card>
          <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs, lineHeight: 18 }}>
            {ptBR.map.placeholder}
          </Text>
        </Card>
      </ScrollView>
    </ScrollView>
  );
}
