import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store/auth';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { MOCK_DELIVERIES, type Delivery, type DeliveryStatus } from '@/mocks/deliveries';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList, 'HomeMotorista'>;
type FilterStatus = 'all' | DeliveryStatus;

export function HomeMotoristaScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, tokens } = useTheme();
  const driver = useAuthStore((s) => s.driver);
  const [filter, setFilter] = useState<FilterStatus>('all');

  const visible = useMemo(() => {
    const all = MOCK_DELIVERIES.filter((d) => d.driver_id === driver?.id);
    if (filter === 'all') return all;
    return all.filter((d) => d.status === filter);
  }, [driver?.id, filter]);

  function statusLabel(s: DeliveryStatus): string {
    return {
      pending: ptBR.detail.statusPending,
      in_route: ptBR.detail.statusInRoute,
      delivered: ptBR.detail.statusDelivered,
      failed: ptBR.detail.statusFailed,
    }[s];
  }

  function renderItem({ item }: { item: Delivery }) {
    const wStart = new Date(item.window_start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const wEnd = new Date(item.window_end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return (
      <Pressable
        onPress={() => navigation.navigate('DetalheEntrega', { deliveryId: item.id })}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginBottom: tokens.space[3] })}
      >
        <Card>
          <View style={{ gap: tokens.space[2] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: tokens.text.base, fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
                #{item.code}
              </Text>
              <StatusBadge status={item.status} label={statusLabel(item.status)} />
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: tokens.text.sm }}>{item.customer.name}</Text>
            <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs }}>
              {item.address.street}, {item.address.number} — {item.address.neighborhood}
            </Text>
            <Text style={{ color: colors.accent, fontSize: tokens.text.xs, fontWeight: tokens.weight.medium }}>
              Janela: {wStart}–{wEnd}
            </Text>
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
          <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm }}>{ptBR.home.subtitle}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: tokens.space[2] }}>
            {([
              ['all', ptBR.home.filter.all],
              ['pending', ptBR.home.filter.pending],
              ['in_route', ptBR.home.filter.inRoute],
              ['delivered', ptBR.home.filter.delivered],
            ] as Array<[FilterStatus, string]>).map(([key, label]) => (
              <Pressable
                key={key}
                testID={`filter-${key}`}
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
          <FlatList data={visible} keyExtractor={(d) => String(d.id)} renderItem={renderItem} scrollEnabled={false} />
        )}

        <Button label="Meu perfil" variant="secondary" fullWidth onPress={() => navigation.navigate('PerfilMotorista')} />
      </ScrollView>
    </View>
  );
}
