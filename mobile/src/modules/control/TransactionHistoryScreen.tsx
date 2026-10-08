/**
 * Transaction history — modern minimalist.
 * Paged sales list with status filter; tap a row for detail / void / return.
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
import { Badge, Card, EmptyState } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

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

function statusTone(status: string): 'accent' | 'danger' | 'neutral' {
  switch (status) {
    case 'COMPLETED':
      return 'accent';
    case 'VOIDED':
      return 'danger';
    default:
      return 'neutral';
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
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      onPress={() =>
        navigation.navigate('TransactionDetail', { saleId: item.id })
      }>
      <Card>
        <View style={styles.cardHeader}>
          <Text style={styles.invoice} numberOfLines={1}>
            {item.invoiceNo}
          </Text>
          <Badge
            label={filterLabel(item.status)}
            tone={statusTone(item.status)}
          />
        </View>
        <Text style={styles.meta}>
          {item.cashierName ?? '-'} · {formatDate(item.completedAt)}
        </Text>
        <Text style={styles.total}>{formatRupiah(item.grandTotal)}</Text>
      </Card>
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
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <FlatList
            data={sales}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={styles.list}
            renderItem={renderItem}
            ListEmptyComponent={
              <EmptyState
                title="Tidak ada transaksi"
                message="Belum ada transaksi pada filter ini."
                icon="🧾"
              />
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
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterRow: {
    flexGrow: 0,
  },
  filterContent: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  list: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexGrow: 1,
    gap: spacing.md,
  },
  pressable: {
    // wrapper so Card keeps its own padding
  },
  pressed: {
    opacity: 0.85,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  invoice: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  total: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.xs,
  },
  pager: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pageBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pageBtnText: {
    ...typography.bodyBold,
    color: colors.primary,
    fontSize: 14,
  },
  pageInfo: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  btnDisabled: {
    opacity: 0.4,
  },
});
