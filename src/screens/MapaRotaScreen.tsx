import { useEffect, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { getDeliveryRoute, type RouteEstimate } from '@/api/routes';
import { findDelivery } from '@/mocks/deliveries';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AppStackParamList } from '@/navigation/types';

type Route_ = RouteProp<AppStackParamList, 'MapaRota'>;

export function MapaRotaScreen() {
  const route = useRoute<Route_>();
  const { colors, tokens } = useTheme();
  const [routeData, setRouteData] = useState<RouteEstimate | null>(null);
  const mockDelivery = findDelivery(route.params.deliveryId);

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

  const dest = mockDelivery?.address;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[5] }}>
        <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
          {ptBR.map.title}
        </Text>

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

        {dest && (
          <Button
            label={ptBR.map.openExternal}
            variant="secondary"
            fullWidth
            onPress={() => {
              const url = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`;
              void Linking.openURL(url).catch(() => undefined);
            }}
          />
        )}

        {routeData && routeData.gas_stations.length > 0 && (
          <Card>
            <Text style={{ fontWeight: tokens.weight.semibold, color: colors.textPrimary, marginBottom: tokens.space[2] }}>
              Postos próximos
            </Text>
            {routeData.gas_stations.map((s, i) => (
              <Text key={i} style={{ color: colors.textSecondary, fontSize: tokens.text.sm, marginBottom: tokens.space[1] }}>
                {s.name} — {s.distance_km} km
                {s.prices.gasolina != null && ` — Gasolina R$ ${s.prices.gasolina.toFixed(2)}`}
                {s.price_age_days != null && ` (${s.price_age_days}d)`}
              </Text>
            ))}
          </Card>
        )}

        <Card>
          <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs, lineHeight: 18 }}>
            {routeData?.disclaimer ?? ptBR.map.placeholder}
          </Text>
        </Card>
      </ScrollView>
    </ScrollView>
  );
}
