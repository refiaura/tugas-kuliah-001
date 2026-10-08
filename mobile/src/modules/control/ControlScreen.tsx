/**
 * Control hub — modern minimalist.
 * Permission-gated shortcuts: clean 2-col menu grid.
 */
import React from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../app/navigation';
import { useAuthStore } from '../../stores/authStore';
import { Card, EmptyState, ScreenHeader } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Control'>;

interface MenuItem {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  permission: string;
  route: 'TransactionHistory' | 'ApprovalInbox' | 'AuditLog';
}

const MENU_ITEMS: MenuItem[] = [
  {
    key: 'history',
    title: 'Riwayat Transaksi',
    subtitle: 'Lihat transaksi & ajukan void/retur',
    icon: '🧾',
    permission: 'sales.view',
    route: 'TransactionHistory',
  },
  {
    key: 'returns',
    title: 'Retur Penjualan',
    subtitle: 'Ajukan retur dari transaksi selesai',
    icon: '↩️',
    permission: 'sales.view',
    route: 'TransactionHistory',
  },
  {
    key: 'approvals',
    title: 'Approval Inbox',
    subtitle: 'Setujui / tolak void & retur',
    icon: '✅',
    permission: 'approval.view',
    route: 'ApprovalInbox',
  },
  {
    key: 'audit',
    title: 'Audit Log',
    subtitle: 'Jejak perubahan data (read-only)',
    icon: '📋',
    permission: 'approval.view',
    route: 'AuditLog',
  },
];

export default function ControlScreen({ navigation }: Props) {
  const hasPermission = useAuthStore(s => s.hasPermission);
  const visible = MENU_ITEMS.filter(item =>
    hasPermission(item.permission),
  );

  if (visible.length === 0) {
    return (
      <View style={styles.center}>
        <EmptyState
          title="Tidak ada akses"
          message="Anda tidak memiliki izin modul kontrol."
          icon="🔒"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Kontrol" subtitle="Transaksi, approval & audit" />
      <FlatList
        data={visible}
        keyExtractor={item => item.key}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
            onPress={() => navigation.navigate(item.route)}>
            <Card style={styles.tile}>
              <View style={styles.iconWrap}>
                <Text style={styles.icon}>{item.icon}</Text>
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {item.subtitle}
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
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
