/**
 * Stock movement history — modern minimalist (read-only ledger).
 *
 * - Lists all movements newest-first (stock.view).
 * - Optional product filter via searchable product picker.
 * - No edit/delete — the ledger is append-only.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  formatQty,
  listStockMovements,
  StockMovement,
} from '../../services/stockApi';
import { listProducts, ProductResponse } from '../../services/productApi';
import { Badge, Card, EmptyState, Input, ScreenHeader } from '../../components';
import { colors, spacing, typography } from '../../theme';

const PAGE_SIZE = 50;

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function StockHistoryScreen() {
  const [items, setItems] = useState<StockMovement[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ProductResponse[]>([]);
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState<ProductResponse | null>(null);

  const load = useCallback(async (productId: number | undefined, p: number) => {
    const res = await listStockMovements(productId, p, PAGE_SIZE);
    setItems(prev => (p === 0 ? res.items : [...prev, ...res.items]));
    setPage(p);
    const total = res.pagination?.totalElements ?? res.items.length;
    setHasMore((p + 1) * PAGE_SIZE < total);
  }, []);

  const reload = useCallback(async () => {
    try {
      await load(filter?.id, 0);
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal memuat riwayat stok.',
      );
    }
  }, [load, filter]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await reload();
      setLoading(false);
    })();
  }, [reload]);

  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        if (search.trim().length < 2) {
          setResults([]);
          return;
        }
        setSearching(true);
        try {
          const r = await listProducts({
            search: search.trim(),
            activeOnly: false,
            size: 10,
          });
          setResults(r.items);
        } catch (e) {
          Alert.alert(
            'Gagal',
            e instanceof Error ? e.message : 'Gagal mencari produk.',
          );
        } finally {
          setSearching(false);
        }
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const onLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      await load(filter?.id, page + 1);
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal memuat halaman berikutnya.',
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const renderItem = ({ item }: { item: StockMovement }) => {
    const positive = item.qtyChange >= 0;
    return (
      <Card style={styles.item} padding={spacing.lg}>
        <View style={styles.itemHeader}>
          <Text style={styles.name} numberOfLines={1}>
            {item.productName}
          </Text>
          <Badge
            label={`${positive ? '+' : ''}${formatQty(item.qtyChange)}`}
            tone={positive ? 'accent' : 'danger'}
          />
        </View>
        <Text style={styles.meta}>
          {item.movementType}
          {item.location ? ` · ${item.location}` : ''} · ref {item.referenceType}
          -{item.referenceId}
        </Text>
        <Text style={styles.metaLight}>
          {formatDate(item.createdAt)}
          {item.createdBy ? ` · ${item.createdBy}` : ''}
        </Text>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.centerText}>Memuat riwayat stok…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <ScreenHeader
              title="Riwayat Stok"
              subtitle="Ledger pergerakan stok — read-only."
              style={styles.header}
            />
            <Input
              label="Filter per produk"
              value={search}
              onChangeText={setSearch}
              placeholder="Ketik nama / SKU…"
            />
            {searching && <ActivityIndicator color={colors.primary} />}
            {!searching && search.trim().length >= 2 && results.length > 0 && (
              <FlatList
                data={results}
                keyExtractor={item => String(item.id)}
                scrollEnabled={false}
                style={styles.pickerList}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.pickerItem}
                    onPress={() => {
                      setFilter(item);
                      setSearch('');
                      setResults([]);
                    }}>
                    <Text style={styles.pickerName} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </Pressable>
                )}
              />
            )}
            {filter && (
              <Card style={styles.activeFilter} padding={spacing.md}>
                <Text style={styles.activeFilterText} numberOfLines={1}>
                  {filter.name}
                </Text>
                <Pressable onPress={() => setFilter(null)}>
                  <Text style={styles.clearFilter}>Hapus ✕</Text>
                </Pressable>
              </Card>
            )}
          </>
        }
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={() => void onLoadMore()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <EmptyState
            title="Belum ada pergerakan"
            message="Belum ada pergerakan stok tercatat."
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ marginVertical: spacing.lg }}
            />
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xxl,
  },
  centerText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  header: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  pickerList: {
    maxHeight: 180,
    marginBottom: spacing.sm,
  },
  pickerItem: {
    backgroundColor: colors.surface,
    borderRadius: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  activeFilter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderColor: colors.primarySoft,
  },
  activeFilterText: {
    ...typography.bodyBold,
    color: colors.primaryDark,
    flex: 1,
    marginRight: spacing.sm,
  },
  clearFilter: {
    ...typography.small,
    color: colors.danger[600],
    fontWeight: '600',
  },
  item: {
    marginBottom: spacing.md,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  name: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  metaLight: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
});
