import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { fetchDeliveriesWithCache } from '@/services/deliveryService';
import { mapDelivery, matchesUiFilter } from '@/lib/mapDelivery';
import type { DeliveryViewModel } from '@/types/delivery';
import type { DeliveryUiStatus } from '@/types/delivery';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AppStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList, 'HomeMotorista'>;
type FilterStatus = 'all' | DeliveryUiStatus;

export function HomeMotoristaScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, tokens } = useTheme();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [items, setItems] = useState<DeliveryViewModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDeliveriesWithCache();
      setItems(res.data.map(mapDelivery));
      setFromCache(res.fromCache);
    } catch {
      setError('Não foi possível carregar entregas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => items.filter((d) => matchesUiFilter(d, filter)),
    [items, filter],
  );

  function statusLabel(s: DeliveryUiStatus): string {
    return {
      pending: ptBR.detail.statusPending,
      in_route: ptBR.detail.statusInRoute,
      delivered: ptBR.detail.statusDelivered,
      failed: ptBR.detail.statusFailed,
    }[s];
  }

  function renderItem({ item }: { item: DeliveryViewModel }) {
    const wStart = new Date(item.windowStart).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const wEnd = new Date(item.windowEnd).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
              <StatusBadge status={item.uiStatus} label={statusLabel(item.uiStatus)} />
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
          {fromCache && (
            <Text style={{ color: colors.statusWarningText, fontSize: tokens.text.xs }}>Dados offline</Text>
          )}
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
                <Text style={{ color: filter === key ? colors.textOnAccent : colors.textSecondary, fontSize: tokens.text.sm }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {loading && <ActivityIndicator color={colors.accent} />}
        {error && !loading && (
          <Card>
            <Text style={{ color: colors.statusDangerText }}>{error}</Text>
            <Button label="Tentar novamente" variant="secondary" onPress={() => void load()} />
          </Card>
        )}
        {!loading && !error && visible.length === 0 && (
          <Card>
            <Text style={{ color: colors.textMuted, textAlign: 'center' }}>{ptBR.home.emptyTitle}</Text>
          </Card>
        )}
        {!loading && !error && visible.length > 0 && (
          <FlatList data={visible} keyExtractor={(d) => String(d.id)} renderItem={renderItem} scrollEnabled={false} />
        )}

        <Button label="Meu perfil" variant="secondary" fullWidth onPress={() => navigation.navigate('PerfilMotorista')} />
      </ScrollView>
    </View>
  );
}
