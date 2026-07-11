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
import {
  fetchDeliveriesPage,
  mergeDeliveryPages,
  readDeliveriesFromCache,
} from '@/services/deliveryService';
import { subscribeDeliveryCache } from '@/services/deliveryCacheEvents';
import { refreshOccurrenceTypesCache } from '@/services/occurrenceTypeService';
import { formatDeliveryWindowLabel, deliveryWindowEmptyLabel } from '@/lib/formatDeliveryWindow';
import { createDefaultActiveUiStatusSet, mapDelivery, matchesUiFilters } from '@/lib/mapDelivery';
import { useAuthStore } from '@/store/auth';
import type { DeliveryApi } from '@/types/delivery';
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
    picked_up: ptBR.detail.statusPickedUp,
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
  const [statusFilters, setStatusFilters] = useState<Set<DeliveryUiStatus>>(() => createDefaultActiveUiStatusSet());
  const [rawItems, setRawItems] = useState<DeliveryApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const hasLoadedOnce = useRef(false);
  const loadingMoreRef = useRef(false);

  const items = useMemo(() => rawItems.map(mapDelivery), [rawItems]);

  const applyCachedItems = useCallback(async () => {
    const cached = await readDeliveriesFromCache();
    if (cached.length > 0) {
      setRawItems(cached);
      setPage(1);
      setHasMore(false);
    }
  }, []);

  const loadPage = useCallback(async (targetPage: number, options?: { refresh?: boolean; append?: boolean }) => {
    if (options?.refresh) {
      setRefreshing(true);
    } else if (options?.append) {
      setLoadingMore(true);
      loadingMoreRef.current = true;
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await fetchDeliveriesPage(targetPage, {
        forceNetwork: options?.refresh ? true : undefined,
      });
      setRawItems((current) =>
        options?.append ? mergeDeliveryPages(current, res.data) : res.data,
      );
      setPage(res.meta.current_page);
      setHasMore(res.meta.current_page < res.meta.last_page);
      setFromCache(res.fromCache);
      void refreshOccurrenceTypesCache();
    } catch {
      setError(ptBR.home.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, []);

  const load = useCallback(
    async (options?: { refresh?: boolean; silent?: boolean }) => {
      if (options?.silent) {
        await loadPage(1);
        return;
      }
      await loadPage(1, { refresh: options?.refresh });
    },
    [loadPage],
  );

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || loading || refreshing || !hasMore) {
      return;
    }
    await loadPage(page + 1, { append: true });
  }, [hasMore, loadPage, loading, page, refreshing]);

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

  function renderItem({ item }: { item: DeliveryViewModel }) {
    const windowLabel = formatDeliveryWindowLabel(item.windowStart, item.windowEnd);
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
                {windowLabel ?? deliveryWindowEmptyLabel()}
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

  if (loading && rawItems.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const firstName = driver?.name?.split(' ')[0] ?? 'motorista';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingHorizontal: tokens.space[6],
          paddingTop: insets.top + tokens.space[3],
          paddingBottom: tokens.space[3],
          gap: tokens.space[3],
          borderBottomWidth: 1,
          borderBottomColor: colors.borderDefault,
          backgroundColor: colors.background,
        }}
      >
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

      <FlatList
        testID="home-delivery-list"
        style={{ flex: 1 }}
        data={visible}
        keyExtractor={(d) => String(d.id)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: tokens.space[3], paddingBottom: profileBarOffset, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load({ refresh: true })}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.35}
        ListEmptyComponent={
          !loading && !error ? (
            <Card style={{ marginHorizontal: tokens.space[6] }}>
              <Text style={{ color: colors.textPrimary, fontWeight: tokens.weight.semibold, textAlign: 'center' }}>
                {rawItems.length === 0 ? ptBR.home.emptyTitle : ptBR.home.emptyFilter}
              </Text>
              {rawItems.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: tokens.text.sm, textAlign: 'center', marginTop: tokens.space[2] }}>
                  {ptBR.home.emptyDesc}
                </Text>
              ) : null}
            </Card>
          ) : null
        }
        ListFooterComponent={
          <View style={{ paddingHorizontal: tokens.space[6], paddingTop: tokens.space[2], gap: tokens.space[4] }}>
            {loadingMore ? (
              <ActivityIndicator color={colors.accent} style={{ paddingVertical: tokens.space[3] }} />
            ) : null}
            {error ? (
              <Card>
                <Text style={{ color: colors.statusDangerText, marginBottom: tokens.space[2] }}>{error}</Text>
                <Button label={ptBR.common.retry} variant="secondary" onPress={() => void load()} fullWidth />
              </Card>
            ) : null}
          </View>
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
