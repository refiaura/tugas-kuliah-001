/**
 * Viewer generik untuk 6 jenis laporan.
 * Filter: rentang tanggal (7 hari terakhir default). Paged untuk sales & purchases.
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
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
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.bold}>{r.invoiceNo}</Text>
            <Text style={styles.total}>{formatRupiah(r.grandTotal)}</Text>
          </View>
          <Text style={styles.meta}>
            {formatDateTime(r.completedAt)} · {r.cashierName ?? '-'}
            {r.customerName ? ` · ${r.customerName}` : ''}
          </Text>
          <Text style={styles.meta}>
            Diskon {formatRupiah(r.discountTotal)} · Status {r.status}
          </Text>
        </View>
      );
    }
    case 'products': {
      const r = item.row;
      return (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.bold}>{r.productName}</Text>
            <Text style={styles.total}>{formatRupiah(r.netSales)}</Text>
          </View>
          <Text style={styles.meta}>{r.sku}</Text>
          <Text style={styles.meta}>
            Terjual {r.qtySold} · Retur {r.returnQty} · Diskon {formatRupiah(r.discount)}
          </Text>
        </View>
      );
    }
    case 'inventory': {
      const r = item.row;
      return (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.bold}>{r.productName}</Text>
            <Text style={styles.total}>Stok {r.currentStock}</Text>
          </View>
          <Text style={styles.meta}>{r.sku}</Text>
          <Text style={styles.meta}>
            Awal {r.openingStock} · Masuk {r.inQty} · Keluar {r.outQty} · Adj {r.adjustmentQty}
          </Text>
        </View>
      );
    }
    case 'cash': {
      const r = item.row;
      return (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.bold}>{r.shiftNo}</Text>
            <Text style={[styles.total, (r.variance ?? 0) !== 0 && styles.warn]}>
              {r.variance === null || r.variance === undefined
                ? 'Aktif'
                : `Selisih ${formatRupiah(r.variance)}`}
            </Text>
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
        </View>
      );
    }
    case 'purchases': {
      const r = item.row;
      return (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.bold}>{r.poNumber}</Text>
            <Text style={styles.total}>{formatRupiah(r.total)}</Text>
          </View>
          <Text style={styles.meta}>
            {r.supplierName ?? '-'} · {formatDate(r.orderDate)}
          </Text>
          <Text style={styles.meta}>
            Terima: {r.receivedStatus} · Bayar: {r.paymentStatus}
          </Text>
        </View>
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
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error && rows.length === 0 && !profit) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (kind === 'profit') {
    return (
      <View style={styles.container}>
        <View style={styles.profitCard}>
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
        </View>
        <Text style={styles.rangeNote}>Periode 7 hari terakhir</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(_, i) => `${kind}-${i}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Tidak ada data.</Text>}
        renderItem={({ item }) => <RowCard item={item} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={{ margin: 12 }} /> : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  error: { color: '#c62828', textAlign: 'center' },
  empty: { color: '#666', textAlign: 'center', marginTop: 40 },
  list: { padding: 16 },
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
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bold: { fontWeight: '600', fontSize: 15, flex: 1 },
  total: { fontWeight: '700', fontSize: 15 },
  warn: { color: '#c62828' },
  meta: { color: '#666', fontSize: 13, marginTop: 3 },
  profitCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, margin: 16 },
  profitRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  profitTotal: { borderTopWidth: 1, borderTopColor: '#eee', marginTop: 4, paddingTop: 12 },
  profitLabel: { fontSize: 15, color: '#444' },
  profitValue: { fontSize: 15 },
  profitLabelBold: { fontSize: 16, fontWeight: '700' },
  profitValueBold: { fontSize: 16, fontWeight: '700' },
  estimateNote: { fontSize: 12, color: '#e65100', marginTop: 8, fontStyle: 'italic' },
  rangeNote: { textAlign: 'center', color: '#999', fontSize: 12 },
});
