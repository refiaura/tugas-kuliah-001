/**
 * Dashboard — modern minimalist.
 * Hero revenue card + KPI grid + alerts.
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
import { Badge, Card, EmptyState, ScreenHeader } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

function Kpi({ label, value, sub, danger }: { label: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <Card style={styles.kpi} padding={spacing.lg}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {sub ? (
        <Text style={[styles.kpiSub, danger && styles.kpiSubDanger]}>{sub}</Text>
      ) : null}
    </Card>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

const ALERT_LABEL: Record<string, string> = {
  LOW_STOCK: 'Stok menipis',
  OUT_OF_STOCK: 'Stok habis',
  PENDING_APPROVAL: 'Approval menunggu',
  SHIFT_VARIANCE: 'Selisih kas shift',
  SHIFT_OPEN: 'Shift belum ditutup',
  PO_PENDING: 'PO perlu tindakan',
};

function todayLabel(): string {
  return new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.center}>
        <EmptyState title="Gagal memuat" message={error} icon="⚠" />
      </View>
    );
  }

  const alerts = data?.alerts ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={colors.primary}
        />
      }>
      <ScreenHeader title="Dashboard" subtitle={todayLabel()} />

      {/* Hero — revenue today */}
      <Card style={styles.hero}>
        <Text style={styles.heroLabel}>Omzet Hari Ini</Text>
        <Text style={styles.heroValue}>{formatRupiah(data?.sales.revenueToday)}</Text>
        <View style={styles.heroRow}>
          <Badge
            label={`${data?.sales.transactionCount ?? 0} transaksi`}
            tone="accent"
          />
          <Text style={styles.heroSub}>
            Laba kotor {formatRupiah(data?.sales.grossProfitToday)}
          </Text>
        </View>
      </Card>

      {/* Sales KPIs */}
      <SectionTitle>Penjualan</SectionTitle>
      <View style={styles.grid}>
        <Kpi label="Item terjual" value={String(data?.sales.itemsSold ?? 0)} />
        <Kpi
          label="Rata-rata transaksi"
          value={formatRupiah(data?.sales.averageTransactionValue)}
        />
      </View>

      {/* Inventory KPIs */}
      <SectionTitle>Inventaris</SectionTitle>
      <View style={styles.grid}>
        <Kpi label="Total SKU" value={String(data?.inventory.totalActiveSku ?? 0)} />
        <Kpi
          label="Stok menipis"
          value={String(data?.inventory.lowStockCount ?? 0)}
          danger={(data?.inventory.lowStockCount ?? 0) > 0}
        />
        <Kpi
          label="Stok habis"
          value={String(data?.inventory.outOfStockCount ?? 0)}
          danger={(data?.inventory.outOfStockCount ?? 0) > 0}
        />
        <Kpi label="Nilai stok" value={formatRupiah(data?.inventory.stockValue)} />
      </View>

      {/* Cash KPIs */}
      <SectionTitle>Kas</SectionTitle>
      <View style={styles.grid}>
        <Kpi label="Kas shift aktif" value={formatRupiah(data?.cash.totalCashActiveShifts)} />
        <Kpi label="Cash in hari ini" value={formatRupiah(data?.cash.cashInToday)} />
        <Kpi label="Cash out hari ini" value={formatRupiah(data?.cash.cashOutToday)} />
        <Kpi
          label="Shift aktif"
          value={String(data?.cash.activeShiftCount ?? 0)}
          sub={
            (data?.cash.shiftsWithVarianceToday ?? 0) > 0
              ? `${data?.cash.shiftsWithVarianceToday} berselisih`
              : undefined
          }
          danger={(data?.cash.shiftsWithVarianceToday ?? 0) > 0}
        />
      </View>

      {/* Alerts */}
      <SectionTitle>Perhatian</SectionTitle>
      {alerts.length === 0 ? (
        <Card>
          <Text style={styles.noAlert}>Tidak ada alert. Semua aman.</Text>
        </Card>
      ) : (
        <Card padding={0}>
          {alerts.map((a, i) => (
            <View
              key={`${a.type}-${i}`}
              style={[styles.alertRow, i > 0 && styles.alertDivider]}>
              <View style={styles.alertDot} />
              <View style={styles.alertBody}>
                <Text style={styles.alertTitle}>{ALERT_LABEL[a.type] ?? a.type}</Text>
                <Text style={styles.alertMsg}>{a.message}</Text>
              </View>
              <Text style={styles.alertCount}>{a.count}</Text>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.huge,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xxl,
  },
  hero: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    padding: spacing.xl,
  },
  heroLabel: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.85,
  },
  heroValue: {
    ...typography.display,
    color: colors.white,
    fontSize: 34,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroSub: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.85,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  kpi: {
    width: '48%',
    flexGrow: 1,
  },
  kpiLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  kpiValue: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.xs,
  },
  kpiSub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  kpiSubDanger: {
    color: colors.danger[600],
    fontWeight: '600',
  },
  noAlert: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.md,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  alertDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.warning[600],
    marginRight: spacing.md,
  },
  alertBody: {
    flex: 1,
  },
  alertTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  alertMsg: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  alertCount: {
    ...typography.title,
    color: colors.warning[600],
  },
});
