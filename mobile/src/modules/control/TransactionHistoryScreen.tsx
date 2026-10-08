/**
 * Transaction history screen: paged list of sales with a status filter.
 * Tapping a row opens the transaction detail (void / return actions).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../app/navigation';
import {
  listSales,
  SaleResponse,
} from '../../services/saleApi';
import { PageInfo } from '../../types/api';
import { formatRupiah } from '../../stores/cartStore';

type Props = NativeStackScreenProps<AppStackParamList, 'TransactionHistory'>;

const FILTERS: (string | null)[] = [null, 'COMPLETED', 'VOIDED'];

const PAGE_SIZE = 20;

function filterLabel(f: string | null): string {
  switch (f) {
    case null:
      return 'Semua';
    case 'COMPLETED':
      return 'Selesai';
    case 'VOIDED':
      return 'Void';
    default:
      return f;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'VOIDED':
      return '#c62828';
    case 'COMPLETED':
      return '#2e7d32';
    default:
      return '#555';
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function TransactionHistoryScreen({ navigation }: Props) {
  const [sales, setSales] = useState<SaleResponse[]>([]);
  const [pagination, setPagination] = useState<PageInfo | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await listSales(filter ?? undefined, page, PAGE_SIZE);
      setSales(res.items);
      setPagination(res.pagination);
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal memuat transaksi.',
      );
    }
  }, [filter, page]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      void load();
    });
    return unsub;
  }, [navigation, load]);

  const changeFilter = (f: string | null) => {
    setFilter(f);
    setPage(0);
  };

  const totalPages = pagination?.totalPages ?? 1;
  const currentPage = pagination?.page ?? page;

  const renderItem = ({ item }: { item: SaleResponse }) => (
    <Pressable
      style={styles.card}
      onPress={() =>
        navigation.navigate('TransactionDetail', { saleId: item.id })
      }>
      <View style={styles.cardHeader}>
        <Text style={styles.invoice}>{item.invoiceNo}</Text>
        <Text style={[styles.status, { color: statusColor(item.status) }]}>
          {filterLabel(item.status)}
        </Text>
      </View>
      <Text style={styles.meta}>
        {item.cashierName ?? '-'} · {formatDate(item.completedAt)}
      </Text>
      <Text style={styles.total}>{formatRupiah(item.grandTotal)}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}>
        {FILTERS.map(f => (
          <Pressable
            key={f ?? 'ALL'}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => changeFilter(f)}>
            <Text
              style={[
                styles.filterText,
                filter === f && styles.filterTextActive,
              ]}>
              {filterLabel(f)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <>
          <FlatList
            data={sales}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={styles.list}
            renderItem={renderItem}
            ListEmptyComponent={
              <Text style={styles.empty}>Tidak ada transaksi.</Text>
            }
          />
          <View style={styles.pager}>
            <Pressable
              style={[styles.pageBtn, page === 0 && styles.btnDisabled]}
              onPress={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}>
              <Text style={styles.pageBtnText}>‹ Sebelumnya</Text>
            </Pressable>
            <Text style={styles.pageInfo}>
              Hal {currentPage + 1} / {Math.max(1, totalPages)}
            </Text>
            <Pressable
              style={[
                styles.pageBtn,
                currentPage >= totalPages - 1 && styles.btnDisabled,
              ]}
              onPress={() => setPage(p => p + 1)}
              disabled={currentPage >= totalPages - 1}>
              <Text style={styles.pageBtnText}>Berikutnya ›</Text>
            </Pressable>
          </View>
        </>
      )}
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
  },
  filterRow: {
    flexGrow: 0,
    paddingVertical: 8,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterChipActive: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
  },
  filterText: {
    fontSize: 13,
    color: '#555',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 8,
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
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
  invoice: {
    fontSize: 15,
    fontWeight: '700',
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
  },
  meta: {
    fontSize: 12,
    color: '#888',
  },
  total: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  empty: {
    textAlign: 'center',
    color: '#888',
    marginTop: 32,
  },
  pager: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  pageBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pageBtnText: {
    color: '#2e7d32',
    fontWeight: '600',
    fontSize: 14,
  },
  pageInfo: {
    fontSize: 13,
    color: '#666',
  },
  btnDisabled: {
    opacity: 0.4,
  },
});
