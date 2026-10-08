/**
 * Viewer generik untuk 6 jenis laporan — modern minimalist.
 * Filter: rentang tanggal (7 hari terakhir default). Paged untuk sales & purchases.
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { AppStackParamList } from '../../app/navigation';
import {
  CashReportRow,
  InventoryReportRow,
  ProductReportRow,
  ProfitReport,
  PurchaseReportRow,
  SalesReportRow,
  formatDate,
  formatDateTime,
  formatRupiah,
  getCashReport,
  getInventoryReport,
  getProductReport,
  getProfitReport,
  getPurchaseReport,
  getSalesReport,
  last7DaysRange,
} from '../../services/reportApi';
import { ReportKind } from './ReportsScreen';
import { PageInfo } from '../../types/api';
import { Badge, Card, EmptyState } from '../../components';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'ReportViewer'>;

type Row =
  | { kind: 'sales'; row: SalesReportRow }
  | { kind: 'products'; row: ProductReportRow }
  | { kind: 'inventory'; row: InventoryReportRow }
  | { kind: 'cash'; row: CashReportRow }
  | { kind: 'purchases'; row: PurchaseReportRow };

function RowCard({ item }: { item: Row }) {
  switch (item.kind) {
    case 'sales': {
      const r = item.row;
      return (
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.bold} numberOfLines={1}>
              {r.invoiceNo}
            </Text>
            <Text style={styles.total}>{formatRupiah(r.grandTotal)}</Text>
          </View>
          <Text style={styles.meta}>
            {formatDateTime(r.completedAt)} · {r.cashierName ?? '-'}
            {r.customerName ? ` · ${r.customerName}` : ''}
          </Text>
          <Text style={styles.meta}>
            Diskon {formatRupiah(r.discountTotal)} · Status {r.status}
          </Text>
        </Card>
      );
    }
    case 'products': {
      const r = item.row;
      return (
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.bold} numberOfLines={1}>
              {r.productName}
            </Text>
            <Text style={styles.total}>{formatRupiah(r.netSales)}</Text>
          </View>
          <Text style={styles.meta}>{r.sku}</Text>
          <Text style={styles.meta}>
            Terjual {r.qtySold} · Retur {r.returnQty} · Diskon {formatRupiah(r.discount)}
          </Text>
        </Card>
      );
    }
    case 'inventory': {
      const r = item.row;
      return (
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.bold} numberOfLines={1}>
              {r.productName}
            </Text>
            <Text style={styles.total}>Stok {r.currentStock}</Text>
          </View>
          <Text style={styles.meta}>{r.sku}</Text>
          <Text style={styles.meta}>
            Awal {r.openingStock} · Masuk {r.inQty} · Keluar {r.outQty} · Adj {r.adjustmentQty}
          </Text>
        </Card>
      );
    }
    case 'cash': {
      const r = item.row;
      const hasVariance = (r.variance ?? 0) !== 0;
      return (
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.bold} numberOfLines={1}>
              {r.shiftNo}
            </Text>
            {r.variance === null || r.variance === undefined ? (
              <Badge label="Aktif" tone="accent" />
            ) : (
              <Badge
                label={`Selisih ${formatRupiah(r.variance)}`}
                tone={hasVariance ? 'danger' : 'neutral'}
              />
            )}
          </View>
          <Text style={styles.meta}>
            {r.cashierName ?? '-'} · Buka {formatDateTime(r.openedAt)}
            {r.closedAt ? ` · Tutup ${formatDateTime(r.closedAt)}` : ''}
          </Text>
          <Text style={styles.meta}>
            Ekspektasi {formatRupiah(r.expectedCash)}
            {r.actualCash !== null && r.actualCash !== undefined
              ? ` · Aktual ${formatRupiah(r.actualCash)}`
              : ''}
          </Text>
        </Card>
      );
    }
    case 'purchases': {
      const r = item.row;
      return (
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.bold} numberOfLines={1}>
              {r.poNumber}
            </Text>
            <Text style={styles.total}>{formatRupiah(r.total)}</Text>
          </View>
          <Text style={styles.meta}>
            {r.supplierName ?? '-'} · {formatDate(r.orderDate)}
          </Text>
          <Text style={styles.meta}>
            Terima: {r.receivedStatus} · Bayar: {r.paymentStatus}
          </Text>
        </Card>
      );
    }
  }
}

export default function ReportViewerScreen({ route }: Props) {
  const { kind } = route.params as { kind: ReportKind };
  const [rows, setRows] = useState<Row[]>([]);
  const [profit, setProfit] = useState<ProfitReport | null>(null);
  const [pagination, setPagination] = useState<PageInfo | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paged = kind === 'sales' || kind === 'purchases';

  const load = useCallback(
    async (p: number, append: boolean) => {
      try {
        if (!append) setError(null);
        const filter = { ...last7DaysRange(), page: p, size: 20 };
        if (kind === 'sales') {
          const r = await getSalesReport(filter);
          setRows((prev) =>
            (append ? prev : []).concat(r.items.map((row) => ({ kind: 'sales' as const, row }))),
          );
          setPagination(r.pagination);
        } else if (kind === 'purchases') {
          const r = await getPurchaseReport(filter);
          setRows((prev) =>
            (append ? prev : []).concat(r.items.map((row) => ({ kind: 'purchases' as const, row }))),
          );
          setPagination(r.pagination);
        } else if (kind === 'products') {
          const items = await getProductReport(filter);
          setRows(items.map((row) => ({ kind: 'products' as const, row })));
        } else if (kind === 'inventory') {
          const items = await getInventoryReport(filter);
          setRows(items.map((row) => ({ kind: 'inventory' as const, row })));
        } else if (kind === 'cash') {
          const items = await getCashReport(filter);
          setRows(items.map((row) => ({ kind: 'cash' as const, row })));
        } else if (kind === 'profit') {
          setProfit(await getProfitReport(filter));
        }
        setPage(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal memuat laporan');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [kind],
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setRows([]);
      setProfit(null);
      void load(0, false);
    }, [load]),
  );

  const loadMore = () => {
    if (!paged || loadingMore || !pagination) return;
    if (page + 1 >= pagination.totalPages) return;
    setLoadingMore(true);
    void load(page + 1, true);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error && rows.length === 0 && !profit) {
    return (
      <View style={styles.center}>
        <EmptyState title="Gagal memuat" message={error} icon="⚠" />
      </View>
    );
  }

  if (kind === 'profit') {
    return (
      <View style={styles.container}>
        <View style={styles.profitWrap}>
          <Card style={styles.profitCard}>
            <View style={styles.profitRow}>
              <Text style={styles.profitLabel}>Penjualan Bersih</Text>
              <Text style={styles.profitValue}>{formatRupiah(profit?.netSales)}</Text>
            </View>
            <View style={styles.profitRow}>
              <Text style={styles.profitLabel}>HPP</Text>
              <Text style={styles.profitValue}>({formatRupiah(profit?.cogs)})</Text>
            </View>
            <View style={[styles.profitRow, styles.profitTotal]}>
              <Text style={styles.profitLabelBold}>Laba Kotor</Text>
              <Text style={styles.profitValueBold}>{formatRupiah(profit?.grossProfit)}</Text>
            </View>
            {profit?.cogsEstimated ? (
              <Text style={styles.estimateNote}>
                * HPP estimasi: ada produk tanpa harga pokok.
              </Text>
            ) : null}
          </Card>
          <Text style={styles.rangeNote}>Periode 7 hari terakhir</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(_, i) => `${kind}-${i}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            title="Tidak ada data"
            message="Belum ada data laporan pada periode ini."
            icon="📊"
          />
        }
        renderItem={({ item }) => <RowCard item={item} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={styles.loadMore} color={colors.primary} />
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
  list: {
    padding: spacing.xl,
    flexGrow: 1,
    gap: spacing.md,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  bold: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  total: {
    ...typography.bodyBold,
    color: colors.text,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  loadMore: {
    margin: spacing.md,
  },
  profitWrap: {
    padding: spacing.xl,
  },
  profitCard: {
    padding: spacing.xl,
  },
  profitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  profitTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.lg,
  },
  profitLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  profitValue: {
    ...typography.bodyBold,
    color: colors.text,
  },
  profitLabelBold: {
    ...typography.subtitle,
    color: colors.text,
  },
  profitValueBold: {
    ...typography.title,
    color: colors.primary,
  },
  estimateNote: {
    ...typography.caption,
    color: colors.warning[600],
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  rangeNote: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
