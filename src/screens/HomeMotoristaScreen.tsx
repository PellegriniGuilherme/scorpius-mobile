import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { listStops, type DriverStop } from '@/api/deliveries';
import { useAuthStore } from '@/store/auth';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { MOCK_DELIVERIES } from '@/mocks/deliveries';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList, 'HomeMotorista'>;
type FilterStatus = 'all' | 'pending' | 'delivered' | 'failed';

export function HomeMotoristaScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, tokens } = useTheme();
  const driver = useAuthStore((s) => s.driver);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [stops, setStops] = useState<DriverStop[]>([]);
  const [useMock, setUseMock] = useState(false);

  const loadStops = useCallback(async () => {
    try {
      const res = await listStops(
        filter === 'all' ? {} : { delivery_status: filter },
      );
      setStops(res.data);
      setUseMock(false);
    } catch {
      setUseMock(true);
    }
  }, [filter]);

  useEffect(() => {
    void loadStops();
  }, [loadStops]);

  const visible = useMemo(() => {
    if (!useMock) return stops;
    return MOCK_DELIVERIES.filter((d) => d.driver_id === driver?.id).flatMap((d) =>
      d.items.map((item, idx) => ({
        document: {
          id: d.id * 10 + idx,
          delivery_status: d.status === 'delivered' ? 'delivered' as const : d.status === 'failed' ? 'failed' as const : 'pending' as const,
          reference_number: item.sku,
          type: { slug: 'package', name: item.description },
        },
        delivery: {
          id: d.id,
          reference_code: d.code,
          status: d.status === 'in_route' ? 'in_transit' : d.status,
          delivery_address: d.address,
          recipient: { name: d.customer.name, phone: d.customer.phone },
        },
      })),
    );
  }, [stops, useMock, driver?.id]);

  function statusLabel(s: string): string {
    if (s === 'delivered') return ptBR.detail.statusDelivered;
    if (s === 'failed') return ptBR.detail.statusFailed;
    if (s === 'pending') return ptBR.detail.statusPending;
    return s;
  }

  function renderItem({ item }: { item: DriverStop }) {
    const delivery = item.delivery;
    const addr = delivery?.delivery_address;
    const docStatus = item.document.delivery_status;

    return (
      <Pressable
        onPress={() =>
          navigation.navigate('DetalheEntrega', {
            deliveryId: delivery?.id ?? 0,
            documentId: item.document.id,
          })
        }
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginBottom: tokens.space[3] })}
      >
        <Card>
          <View style={{ gap: tokens.space[2] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: tokens.text.base, fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
                {item.document.reference_number ?? item.document.type?.name ?? `#${item.document.id}`}
              </Text>
              <StatusBadge status={docStatus === 'delivered' ? 'delivered' : docStatus === 'failed' ? 'failed' : 'pending'} label={statusLabel(docStatus)} />
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: tokens.text.sm }}>
              {delivery?.reference_code} · {item.document.type?.name}
            </Text>
            {addr && (
              <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs }}>
                {addr.street}{addr.number ? `, ${addr.number}` : ''} — {addr.neighborhood}
              </Text>
            )}
          </View>
        </Card>
      </Pressable>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: tokens.space[6], gap: tokens.space[5] }}>
        <View style={{ gap: tokens.space[2] }}>
          <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
            {ptBR.home.title}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm }}>
            {useMock ? 'Modo demo (API indisponível)' : ptBR.home.subtitle}
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: tokens.space[2] }}>
            {([
              ['all', ptBR.home.filter.all],
              ['pending', ptBR.home.filter.pending],
              ['delivered', ptBR.home.filter.delivered],
            ] as Array<[FilterStatus, string]>).map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => setFilter(key)}
                style={{
                  paddingHorizontal: tokens.space[4],
                  paddingVertical: tokens.space[2],
                  borderRadius: tokens.radius.full,
                  backgroundColor: filter === key ? colors.accent : colors.surfacePanel,
                  borderColor: filter === key ? colors.accentBorder : colors.borderDefault,
                  borderWidth: 1,
                }}
              >
                <Text
                  style={{
                    color: filter === key ? colors.textOnAccent : colors.textSecondary,
                    fontSize: tokens.text.sm,
                    fontWeight: tokens.weight.medium,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {visible.length === 0 ? (
          <Card>
            <View style={{ alignItems: 'center', gap: tokens.space[2], padding: tokens.space[6] }}>
              <Text style={{ fontSize: tokens.text.lg, fontWeight: tokens.weight.semibold, color: colors.textPrimary }}>
                {ptBR.home.emptyTitle}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm, textAlign: 'center' }}>
                {ptBR.home.emptyDesc}
              </Text>
            </View>
          </Card>
        ) : (
          <FlatList data={visible} keyExtractor={(s) => String(s.document.id)} renderItem={renderItem} scrollEnabled={false} />
        )}

        <Button label="Meu perfil" variant="secondary" fullWidth onPress={() => navigation.navigate('PerfilMotorista')} />
      </ScrollView>
    </View>
  );
}
