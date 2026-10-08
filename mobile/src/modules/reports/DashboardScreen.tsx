/**
 * Dashboard — KPI penjualan, inventaris, kas, dan alert.
 * GET /api/v1/dashboard (butuh permission report.*).
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  DashboardResponse,
  formatRupiah,
  getDashboard,
} from '../../services/reportApi';

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
      {sub ? <Text style={styles.cardSub}>{sub}</Text> : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.grid}>{children}</View>
    </View>
  );
}

const ALERT_LABEL: Record<string, string> = {
  LOW_STOCK: 'Stok menipis',
  OUT_OF_STOCK: 'Stok habis',
  PENDING_APPROVAL: 'Approval menunggu',
  SHIFT_VARIANCE: 'Selisih kas shift',
  SHIFT_OPEN: 'Shift belum ditutup',
  PO_PENDING: 'PO perlu tindakan',
};

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const d = await getDashboard();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}>
      <Section title="Penjualan Hari Ini">
        <KpiCard label="Omzet" value={formatRupiah(data?.sales.revenueToday)} />
        <KpiCard label="Transaksi" value={String(data?.sales.transactionCount ?? 0)} />
        <KpiCard label="Item Terjual" value={String(data?.sales.itemsSold ?? 0)} />
        <KpiCard label="Rata-rata/Transaksi" value={formatRupiah(data?.sales.averageTransactionValue)} />
        <KpiCard label="Laba Kotor" value={formatRupiah(data?.sales.grossProfitToday)} />
      </Section>

      <Section title="Inventaris">
        <KpiCard label="Total SKU" value={String(data?.inventory.totalActiveSku ?? 0)} />
        <KpiCard label="Stok Menipis" value={String(data?.inventory.lowStockCount ?? 0)} />
        <KpiCard label="Stok Habis" value={String(data?.inventory.outOfStockCount ?? 0)} />
        <KpiCard label="Nilai Stok" value={formatRupiah(data?.inventory.stockValue)} />
      </Section>

      <Section title="Kas">
        <KpiCard label="Kas Shift Aktif" value={formatRupiah(data?.cash.totalCashActiveShifts)} />
        <KpiCard label="Cash In Hari Ini" value={formatRupiah(data?.cash.cashInToday)} />
        <KpiCard label="Cash Out Hari Ini" value={formatRupiah(data?.cash.cashOutToday)} />
        <KpiCard
          label="Shift Aktif"
          value={String(data?.cash.activeShiftCount ?? 0)}
          sub={(data?.cash.shiftsWithVarianceToday ?? 0) > 0 ? `${data?.cash.shiftsWithVarianceToday} berselisih` : undefined}
        />
      </Section>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Perhatian</Text>
        {(data?.alerts ?? []).length === 0 ? (
          <Text style={styles.noAlert}>Tidak ada alert. Semua aman.</Text>
        ) : (
          (data?.alerts ?? []).map((a, i) => (
            <View key={`${a.type}-${i}`} style={styles.alertRow}>
              <Text style={styles.alertDot}>●</Text>
              <View style={styles.alertBody}>
                <Text style={styles.alertTitle}>{ALERT_LABEL[a.type] ?? a.type}</Text>
                <Text style={styles.alertMsg}>{a.message}</Text>
              </View>
              <Text style={styles.alertCount}>{a.count}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  error: { color: '#c62828', textAlign: 'center' },
  section: { padding: 16, paddingBottom: 0 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    width: '48%',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  cardLabel: { fontSize: 12, color: '#666' },
  cardValue: { fontSize: 17, fontWeight: '700', marginTop: 4 },
  cardSub: { fontSize: 12, color: '#c62828', marginTop: 2 },
  noAlert: { color: '#666', backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  alertRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertDot: { color: '#e65100', fontSize: 12, marginRight: 10 },
  alertBody: { flex: 1 },
  alertTitle: { fontWeight: '600', fontSize: 14 },
  alertMsg: { color: '#666', fontSize: 13, marginTop: 2 },
  alertCount: { fontSize: 16, fontWeight: '700', color: '#e65100' },
});
