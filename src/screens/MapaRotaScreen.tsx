import { Linking, ScrollView, Text, View, Image } from 'react-native';
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

export function MapaRotaScreen() {
  const route = useRoute<Route_>();
  const { colors, tokens } = useTheme();
  const delivery = findDelivery(route.params.deliveryId);

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
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${dest.lng - 0.01},${dest.lat - 0.005},${dest.lng + 0.01},${dest.lat + 0.005}&layer=mapnik&marker=${dest.lat},${dest.lng}`;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[5] }}>
        <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
          {ptBR.map.title}
        </Text>

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
          <Image source={{ uri: mapUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </View>

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
          </View>
        </Card>

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

        <Button
          label={ptBR.map.openExternal}
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
