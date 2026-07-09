import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { DeliveryStatusFilter } from '@/components/DeliveryStatusFilter';
import { StatusBadge } from '@/components/StatusBadge';
import { fetchDeliveriesWithCache, readDeliveriesFromCache } from '@/services/deliveryService';
import { subscribeDeliveryCache } from '@/services/deliveryCacheEvents';
import { refreshOccurrenceTypesCache } from '@/services/occurrenceTypeService';
import { createAllUiStatusSet, mapDelivery, matchesUiFilters } from '@/lib/mapDelivery';
import { useAuthStore } from '@/store/auth';
import type { DeliveryViewModel } from '@/types/delivery';
import type { DeliveryUiStatus } from '@/types/delivery';
import { useTheme } from '@/theme/ThemeProvider';
import { ptBR } from '@/i18n/pt-BR';
import type { AppStackParamList } from '@/navigation/types';
import NetInfo from '@react-native-community/netinfo';

type Nav = NativeStackNavigationProp<AppStackParamList, 'HomeMotorista'>;

function statusLabel(s: DeliveryUiStatus): string {
  return {
    pending: ptBR.detail.statusPending,
    in_route: ptBR.detail.statusInRoute,
    delivered: ptBR.detail.statusDelivered,
    failed: ptBR.detail.statusFailed,
  }[s];
}

const PROFILE_BAR_HEIGHT = 56;

export function HomeMotoristaScreen() {
  const navigation = useNavigation<Nav>();
  const driver = useAuthStore((s) => s.driver);
  const insets = useSafeAreaInsets();
  const { colors, tokens } = useTheme();
  const profileBarOffset = insets.bottom + tokens.space[3] + PROFILE_BAR_HEIGHT + tokens.space[4];
  const [statusFilters, setStatusFilters] = useState<Set<DeliveryUiStatus>>(() => createAllUiStatusSet());
  const [items, setItems] = useState<DeliveryViewModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasLoadedOnce = useRef(false);

  const applyCachedItems = useCallback(async () => {
    const cached = await readDeliveriesFromCache();
    if (cached.length > 0) {
      setItems(cached.map(mapDelivery));
    }
  }, []);

  const load = useCallback(async (options?: { refresh?: boolean; silent?: boolean }) => {
    if (options?.refresh) {
      setRefreshing(true);
    } else if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetchDeliveriesWithCache({ forceNetwork: options?.refresh ? true : undefined });
      setItems(res.data.map(mapDelivery));
      setFromCache(res.fromCache);
      void refreshOccurrenceTypesCache();
    } catch {
      setError(ptBR.home.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnce.current) {
        hasLoadedOnce.current = true;
        return;
      }
      void (async () => {
        await applyCachedItems();
        const net = await NetInfo.fetch();
        if (net.isConnected) {
          void load({ silent: true });
        }
      })();
    }, [applyCachedItems, load]),
  );

  useEffect(() => {
    return subscribeDeliveryCache(() => {
      void applyCachedItems();
    });
  }, [applyCachedItems]);

  const visible = useMemo(
    () => items.filter((d) => matchesUiFilters(d, statusFilters)),
    [items, statusFilters],
  );

  const counts = useMemo(() => {
    const pending = items.filter((d) => d.uiStatus === 'pending').length;
    const inRoute = items.filter((d) => d.uiStatus === 'in_route').length;
    return { total: items.length, pending, inRoute };
  }, [items]);

  function renderHeader() {
    const firstName = driver?.name?.split(' ')[0] ?? 'motorista';
    return (
      <View style={{ gap: tokens.space[5], paddingHorizontal: tokens.space[6], paddingTop: insets.top + tokens.space[4] }}>
        <View style={{ gap: tokens.space[1] }}>
          <Text style={{ fontSize: tokens.text.xs, color: colors.textMuted, fontWeight: tokens.weight.medium, textTransform: 'uppercase' }}>
            {ptBR.app.name}
          </Text>
          <Text style={{ fontSize: tokens.text['2xl'], fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
            {ptBR.home.greeting.replace('{name}', firstName)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: tokens.text.sm }}>
            {ptBR.home.deliveryCount.replace('{count}', String(counts.total))}
            {counts.inRoute > 0 ? ` · ${counts.inRoute} em rota` : ''}
          </Text>
          {fromCache && (
            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: tokens.space[1],
                paddingHorizontal: tokens.space[2],
                paddingVertical: tokens.space[1],
                borderRadius: tokens.radius.full,
                backgroundColor: colors.statusWarningSurface,
                borderWidth: 1,
                borderColor: colors.statusWarningBorder,
              }}
            >
              <Text style={{ color: colors.statusWarningText, fontSize: tokens.text.xs }}>
                {ptBR.home.offlineBanner}
              </Text>
            </View>
          )}
        </View>

        <DeliveryStatusFilter
          value={statusFilters}
          onChange={setStatusFilters}
          deliveries={items}
        />
      </View>
    );
  }

  function renderItem({ item }: { item: DeliveryViewModel }) {
    const wStart = new Date(item.windowStart).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const wEnd = new Date(item.windowEnd).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return (
      <Pressable
        onPress={() => navigation.navigate('DetalheEntrega', { deliveryId: item.id })}
        style={({ pressed }) => ({
          opacity: pressed ? 0.85 : 1,
          marginHorizontal: tokens.space[6],
          marginBottom: tokens.space[3],
        })}
      >
        <Card>
          <View style={{ gap: tokens.space[3] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: tokens.space[2] }}>
              <View style={{ flex: 1, gap: tokens.space[1] }}>
                <Text style={{ fontSize: tokens.text.lg, fontWeight: tokens.weight.bold, color: colors.textPrimary }}>
                  {item.customer.name}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs }}>#{item.code}</Text>
              </View>
              <StatusBadge status={item.uiStatus} label={statusLabel(item.uiStatus)} />
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: tokens.text.sm }} numberOfLines={2}>
              {item.address.street}, {item.address.number} — {item.address.neighborhood}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.accent, fontSize: tokens.text.sm, fontWeight: tokens.weight.semibold }}>
                {wStart}–{wEnd}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: tokens.text.xs }}>
                {item.packageCount} pkg{item.packageCount !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </Card>
      </Pressable>
    );
  }

  if (loading && items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        testID="home-delivery-list"
        data={visible}
        keyExtractor={(d) => String(d.id)}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingBottom: profileBarOffset, gap: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load({ refresh: true })}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListEmptyComponent={
          !loading && !error ? (
            <Card style={{ marginHorizontal: tokens.space[6] }}>
              <Text style={{ color: colors.textPrimary, fontWeight: tokens.weight.semibold, textAlign: 'center' }}>
                {items.length === 0 ? ptBR.home.emptyTitle : ptBR.home.emptyFilter}
              </Text>
              {items.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm, textAlign: 'center', marginTop: tokens.space[2] }}>
                  {ptBR.home.emptyDesc}
                </Text>
              ) : null}
            </Card>
          ) : null
        }
        ListFooterComponent={
          error ? (
            <View style={{ paddingHorizontal: tokens.space[6], paddingTop: tokens.space[4] }}>
              <Card>
                <Text style={{ color: colors.statusDangerText, marginBottom: tokens.space[2] }}>{error}</Text>
                <Button label={ptBR.common.retry} variant="secondary" onPress={() => void load()} fullWidth />
              </Card>
            </View>
          ) : null
        }
      />

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: insets.bottom + tokens.space[4],
          paddingHorizontal: tokens.space[6],
          paddingTop: tokens.space[3],
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.borderDefault,
        }}
      >
        <Button
          testID="home-profile-button"
          label={ptBR.profile.title}
          variant="secondary"
          fullWidth
          onPress={() => navigation.navigate('PerfilMotorista')}
        />
      </View>
    </View>
  );
}
