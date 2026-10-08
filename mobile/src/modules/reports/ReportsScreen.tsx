/**
 * Menu daftar laporan — modern minimalist.
 * Grid kartu bersih; setiap item membuka ReportViewer dengan tipe berbeda.
 */
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../app/navigation';
import { useAuthStore } from '../../stores/authStore';
import { Card, EmptyState, ScreenHeader } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

export type ReportKind =
  | 'sales'
  | 'products'
  | 'inventory'
  | 'cash'
  | 'purchases'
  | 'profit';

interface ReportItem {
  kind: ReportKind;
  title: string;
  desc: string;
  icon: string;
  permission: string;
}

const REPORTS: ReportItem[] = [
  { kind: 'sales', title: 'Laporan Penjualan', desc: 'Transaksi per invoice', icon: '🧾', permission: 'report.sales' },
  { kind: 'products', title: 'Produk Terjual', desc: 'Qty & omzet per produk', icon: '📦', permission: 'report.sales' },
  { kind: 'inventory', title: 'Laporan Stok', desc: 'Mutasi & saldo per produk', icon: '📊', permission: 'report.stock' },
  { kind: 'cash', title: 'Laporan Kas', desc: 'Rekap kas per shift', icon: '💵', permission: 'report.cash' },
  { kind: 'purchases', title: 'Laporan Pembelian', desc: 'PO per supplier', icon: '🛒', permission: 'report.purchase' },
  { kind: 'profit', title: 'Laporan Laba', desc: 'Penjualan bersih − HPP', icon: '📈', permission: 'report.profit' },
];

type Props = NativeStackScreenProps<AppStackParamList, 'Reports'>;

export default function ReportsScreen({ navigation }: Props) {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const visible = REPORTS.filter(r => hasPermission(r.permission));

  if (visible.length === 0) {
    return (
      <View style={styles.center}>
        <EmptyState
          title="Tidak ada laporan"
          message="Tidak ada laporan yang tersedia untuk akun ini."
          icon="📊"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Laporan" subtitle="Rekap & analisis usaha" />
      <FlatList
        data={visible}
        keyExtractor={item => item.kind}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
            onPress={() => navigation.navigate('ReportViewer', { kind: item.kind, title: item.title })}>
            <Card style={styles.tile}>
              <View style={styles.iconWrap}>
                <Text style={styles.icon}>{item.icon}</Text>
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.desc} numberOfLines={2}>
                {item.desc}
              </Text>
            </Card>
          </Pressable>
        )}
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
  grid: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  row: {
    gap: spacing.md,
  },
  cell: {
    flex: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  tile: {
    minHeight: 148,
    justifyContent: 'flex-start',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 22,
  },
  title: {
    ...typography.bodyBold,
    color: colors.text,
  },
  desc: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
