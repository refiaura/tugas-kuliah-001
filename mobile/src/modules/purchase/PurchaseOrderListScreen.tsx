/**
 * PO list screen with a status filter.
 *
 * Tapping a row opens PurchaseOrderDetail; a "+" button (purchase.create)
 * opens the PO form.
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
      style={styles.card}
      onPress={() => navigation.navigate('PurchaseOrderDetail', { poId: item.id })}>
      <View style={styles.cardHeader}>
        <Text style={styles.docNo}>{item.docNo}</Text>
        <Text style={styles.status}>{poStatusLabel(item.status)}</Text>
      </View>
      <Text style={styles.supplier}>{item.supplierName}</Text>
      <Text style={styles.meta}>
        {item.lines.length} baris · Rp{formatMoney(item.totalAmount)}
      </Text>
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
            onPress={() => setFilter(f)}>
            <Text
              style={[
                styles.filterText,
                filter === f && styles.filterTextActive,
              ]}>
              {f === null ? 'Semua' : poStatusLabel(f)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.empty}>Tidak ada purchase order.</Text>
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
  docNo: {
    fontSize: 15,
    fontWeight: '700',
  },
  status: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '600',
  },
  supplier: {
    fontSize: 14,
    color: '#333',
  },
  meta: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  empty: {
    textAlign: 'center',
    color: '#888',
    marginTop: 32,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2e7d32',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  fabText: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 30,
  },
});
