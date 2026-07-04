import { useEffect, useState } from 'react';
import { Linking, ScrollView, Text, View, Image, ActivityIndicator } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { fetchDeliveryWithCache } from '@/services/deliveryService';
import { mapDelivery } from '@/lib/mapDelivery';
import type { DeliveryViewModel } from '@/types/delivery';
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
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function MapaRotaScreen() {
  const route = useRoute<Route_>();
  const { colors, tokens } = useTheme();
  const [delivery, setDelivery] = useState<DeliveryViewModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await fetchDeliveryWithCache(route.params.deliveryId);
      setDelivery(res.data ? mapDelivery(res.data) : null);
      setLoading(false);
    })();
  }, [route.params.deliveryId]);

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
  const origin = { lat: dest.lat || -23.5613, lng: dest.lng || -46.6565, label: 'Origem' };
  const km = haversineKm(origin.lat, origin.lng, dest.lat, dest.lng);
  const min = Math.max(5, Math.round((km / 30) * 60));
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${dest.lng - 0.01},${dest.lat - 0.005},${dest.lng + 0.01},${dest.lat + 0.005}&layer=mapnik&marker=${dest.lat},${dest.lng}`;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[5] }}>
        <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
          {ptBR.map.title}
        </Text>

        <View style={{ height: 240, borderRadius: tokens.radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderDefault }}>
          <Image source={{ uri: mapUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </View>

        <Card>
          <Text style={{ color: colors.textPrimary, fontSize: tokens.text.sm }}>
            {dest.street}, {dest.number} — {dest.neighborhood}, {dest.city}
          </Text>
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <Text style={{ color: colors.accent, fontWeight: tokens.weight.bold }}>
              {ptBR.map.distance.replace('{km}', km.toFixed(1))}
            </Text>
            <Text style={{ color: colors.accent, fontWeight: tokens.weight.bold }}>
              {ptBR.map.duration.replace('{min}', String(min))}
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
