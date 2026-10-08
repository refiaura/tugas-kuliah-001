/**
 * Stock movement history (read-only ledger).
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
  TextInput,
  View,
} from 'react-native';
import {
  formatQty,
  listStockMovements,
  StockMovement,
} from '../../services/stockApi';
import { listProducts, ProductResponse } from '../../services/productApi';

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
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.name} numberOfLines={1}>
            {item.productName}
          </Text>
          <Text
            style={[
              styles.qty,
              positive ? styles.qtyIn : styles.qtyOut,
            ]}>
            {positive ? '+' : ''}
            {formatQty(item.qtyChange)}
          </Text>
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
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Memuat riwayat stok…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterBox}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Filter per produk… (ketik nama / SKU)"
        />
        {searching && <ActivityIndicator style={{ marginTop: 6 }} />}
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
          <View style={styles.activeFilter}>
            <Text style={styles.activeFilterText}>
              Filter: {filter.name}
            </Text>
            <Pressable onPress={() => setFilter(null)}>
              <Text style={styles.clearFilter}>✕ Hapus</Text>
            </Pressable>
          </View>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={() => void onLoadMore()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Belum ada pergerakan stok.
          </Text>
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={{ marginVertical: 16 }} />
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  muted: {
    color: '#666',
    marginTop: 8,
  },
  filterBox: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerList: {
    maxHeight: 180,
    marginTop: 4,
  },
  pickerItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerName: {
    fontSize: 14,
    fontWeight: '600',
  },
  activeFilter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  activeFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
    flex: 1,
  },
  clearFilter: {
    color: '#c62828',
    fontWeight: '600',
    fontSize: 14,
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  qty: {
    fontSize: 15,
    fontWeight: '700',
  },
  qtyIn: {
    color: '#2e7d32',
  },
  qtyOut: {
    color: '#c62828',
  },
  meta: {
    fontSize: 12,
    color: '#555',
  },
  metaLight: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 32,
  },
});
