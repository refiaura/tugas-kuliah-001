/**
 * Inventory hub screen — modern minimalist.
 * Permission-gated shortcuts to the stock documents
 * (opname, adjustment, transfer) and the read-only movement history.
 */
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../app/navigation';
import { useAuthStore } from '../../stores/authStore';
import { Card, EmptyState, ScreenHeader } from '../../components';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Stock'>;

interface MenuItem {
  key: string;
  title: string;
  subtitle: string;
  permission: string;
  route: 'StockOpname' | 'StockAdjustment' | 'StockTransfer' | 'StockHistory';
}

const MENU_ITEMS: MenuItem[] = [
  {
    key: 'opname',
    title: 'Stock Opname',
    subtitle: 'Hitung fisik & selisih otomatis',
    permission: 'stock.opname',
    route: 'StockOpname',
  },
  {
    key: 'adjustment',
    title: 'Stock Adjustment',
    subtitle: 'Koreksi manual dengan alasan',
    permission: 'stock.adjustment',
    route: 'StockAdjustment',
  },
  {
    key: 'transfer',
    title: 'Stock Transfer',
    subtitle: 'Pindah antar lokasi',
    permission: 'stock.transfer',
    route: 'StockTransfer',
  },
  {
    key: 'history',
    title: 'Riwayat Pergerakan Stok',
    subtitle: 'Ledger read-only',
    permission: 'stock.view',
    route: 'StockHistory',
  },
];

export default function StockScreen({ navigation }: Props) {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const visible = MENU_ITEMS.filter(item =>
    hasPermission(item.permission),
  );

  if (visible.length === 0) {
    return (
      <View style={styles.center}>
        <EmptyState
          title="Tidak ada akses"
          message="Anda tidak memiliki izin modul inventaris."
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenHeader
        title="Inventaris"
        subtitle="Kelola stok toko Anda."
      />
      <Card padding={0} style={styles.menu}>
        {visible.map((item, i) => (
          <Pressable
            key={item.key}
            onPress={() => navigation.navigate(item.route)}
            style={[styles.menuItem, i > 0 && styles.menuDivider]}>
            <View style={styles.menuBody}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <Text style={styles.menuChevron}>›</Text>
          </Pressable>
        ))}
      </Card>
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
  menu: {
    marginHorizontal: spacing.xl,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
  },
  menuDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  menuBody: {
    flex: 1,
  },
  menuTitle: {
    ...typography.bodyBold,
    color: colors.text,
  },
  menuSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  menuChevron: {
    fontSize: 20,
    color: colors.textMuted,
  },
});
