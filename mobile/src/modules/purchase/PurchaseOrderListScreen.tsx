/**
 * PO list — modern minimalist.
 * Filter chips, Card rows with status Badge, EmptyState, accent FAB.
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
import { useAuthStore } from '../../stores/authStore';
import {
  formatMoney,
  listPurchaseOrders,
  poStatusLabel,
  PurchaseOrder,
} from '../../services/purchaseApi';
import { Badge, Card, EmptyState, ScreenHeader } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'PurchaseOrderList'>;

const FILTERS: (string | null)[] = [
  null,
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'ORDERED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
];

function poTone(status: string): 'neutral' | 'accent' | 'danger' | 'warning' | 'info' {
  switch (status) {
    case 'DRAFT':
      return 'neutral';
    case 'SUBMITTED':
      return 'warning';
    case 'APPROVED':
      return 'info';
    case 'ORDERED':
    case 'PARTIALLY_RECEIVED':
    case 'RECEIVED':
      return 'accent';
    case 'CANCELLED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export default function PurchaseOrderListScreen({ navigation }: Props) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const canCreate = useAuthStore(s => s.hasPermission('purchase.create'));

  const load = useCallback(async () => {
    try {
      const res = await listPurchaseOrders(filter ?? undefined, 0, 50);
      setOrders(res.items);
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal memuat purchase order.',
      );
    }
  }, [filter]);

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

  const renderItem = ({ item }: { item: PurchaseOrder }) => (
    <Pressable
      onPress={() => navigation.navigate('PurchaseOrderDetail', { poId: item.id })}>
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.docNo}>{item.docNo}</Text>
          <Badge label={poStatusLabel(item.status)} tone={poTone(item.status)} />
        </View>
        <Text style={styles.supplier}>{item.supplierName}</Text>
        <Text style={styles.meta}>
          {item.lines.length} baris · Rp{formatMoney(item.totalAmount)}
        </Text>
      </Card>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Purchase Order" subtitle="Daftar pesanan ke supplier" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}>
        {FILTERS.map(f => {
          const active = filter === f;
          return (
            <Pressable
              key={f ?? 'ALL'}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(f)}>
              <Text
                style={[styles.filterText, active && styles.filterTextActive]}>
                {f === null ? 'Semua' : poStatusLabel(f)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          ListEmptyComponent={
            <EmptyState
              title="Tidak ada purchase order"
              message="PO dengan status ini belum tersedia."
            />
          }
        />
      )}

      {canCreate && (
        <Pressable
          style={styles.fab}
          onPress={() => navigation.navigate('PurchaseOrderForm')}>
          <Text style={styles.fabText}>+</Text>
        </Pressable>
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
    paddingBottom: spacing.md,
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
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  docNo: {
    ...typography.bodyBold,
    color: colors.text,
  },
  supplier: {
    ...typography.body,
    color: colors.text,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  fabText: {
    color: colors.white,
    fontSize: 28,
    lineHeight: 30,
  },
});
