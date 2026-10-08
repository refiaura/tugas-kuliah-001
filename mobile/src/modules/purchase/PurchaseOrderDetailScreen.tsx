/**
 * PO detail screen: lines with received/returned progress and lifecycle
 * action buttons gated by permission and PO status.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  approvePurchaseOrder,
  cancelPurchaseOrder,
  formatMoney,
  getPurchaseOrder,
  markOrderedPurchaseOrder,
  poStatusLabel,
  PurchaseOrder,
  submitPurchaseOrder,
} from '../../services/purchaseApi';

type Props = NativeStackScreenProps<AppStackParamList, 'PurchaseOrderDetail'>;

export default function PurchaseOrderDetailScreen({ navigation, route }: Props) {
  const { poId } = route.params;
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const hasPermission = useAuthStore(s => s.hasPermission);

  const load = useCallback(async () => {
    try {
      setPo(await getPurchaseOrder(poId));
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal memuat detail PO.',
      );
    }
  }, [poId]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const runAction = async (
    label: string,
    fn: (id: number) => Promise<PurchaseOrder>,
  ) => {
    Alert.alert(label, `Yakin ingin ${label.toLowerCase()} PO ini?`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Ya',
        onPress: () =>
          void (async () => {
            setActing(true);
            try {
              const updated = await fn(poId);
              setPo(updated);
            } catch (e) {
              Alert.alert(
                'Gagal',
                e instanceof Error ? e.message : `Gagal ${label.toLowerCase()}.`,
              );
            } finally {
              setActing(false);
            }
          })(),
      },
    ]);
  };

  if (loading || !po) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Memuat detail PO…</Text>
      </View>
    );
  }

  const canEdit = hasPermission('purchase.create');
  const canApprove = hasPermission('purchase.approve');
  const canReceive = hasPermission('purchase.receive');
  const canReturn = hasPermission('purchase.return');

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Text style={styles.docNo}>{po.docNo}</Text>
          <Text style={styles.status}>{poStatusLabel(po.status)}</Text>
        </View>
        <Text style={styles.supplier}>{po.supplierName}</Text>
        <Text style={styles.meta}>
          Dibuat oleh {po.createdBy ?? '-'}
          {po.approvedBy ? ` · Approved oleh ${po.approvedBy}` : ''}
        </Text>
        {po.notes ? <Text style={styles.notes}>{po.notes}</Text> : null}
      </View>

      {po.lines.map(l => (
        <View key={l.id} style={styles.card}>
          <Text style={styles.name} numberOfLines={1}>
            {l.productName}
          </Text>
          <Text style={styles.meta}>
            Order {l.qty} × Rp{formatMoney(l.unitPrice)} = Rp
            {formatMoney(l.lineTotal)}
          </Text>
          <Text style={styles.progress}>
            Diterima {l.receivedQty} · Diretur {l.returnedQty}
          </Text>
        </View>
      ))}

      <Text style={styles.total}>Total: Rp{formatMoney(po.totalAmount)}</Text>

      <View style={styles.actions}>
        {po.status === 'DRAFT' && canEdit && (
          <Pressable
            style={[styles.actionBtn, acting && styles.btnDisabled]}
            onPress={() => void runAction('Submit PO', submitPurchaseOrder)}
            disabled={acting}>
            <Text style={styles.actionBtnText}>Submit untuk Approval</Text>
          </Pressable>
        )}
        {po.status === 'SUBMITTED' && canApprove && (
          <Pressable
            style={[styles.actionBtn, acting && styles.btnDisabled]}
            onPress={() => void runAction('Approve PO', approvePurchaseOrder)}
            disabled={acting}>
            <Text style={styles.actionBtnText}>Approve</Text>
          </Pressable>
        )}
        {po.status === 'APPROVED' && canEdit && (
          <Pressable
            style={[styles.actionBtn, acting && styles.btnDisabled]}
            onPress={() =>
              void runAction('Kirim PO', markOrderedPurchaseOrder)
            }
            disabled={acting}>
            <Text style={styles.actionBtnText}>Kirim ke Supplier</Text>
          </Pressable>
        )}
        {(po.status === 'DRAFT' || po.status === 'SUBMITTED') && canEdit && (
          <Pressable
            style={[
              styles.actionBtn,
              styles.dangerBtn,
              acting && styles.btnDisabled,
            ]}
            onPress={() => void runAction('Batalkan PO', cancelPurchaseOrder)}
            disabled={acting}>
            <Text style={[styles.actionBtnText, styles.dangerText]}>
              Batalkan PO
            </Text>
          </Pressable>
        )}
        {(po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED') &&
          canReceive && (
            <Pressable
              style={[styles.actionBtn, styles.receiveBtn]}
              onPress={() =>
                navigation.navigate('GoodsReceipt', { poId: po.id })
              }>
              <Text style={styles.actionBtnText}>Terima Barang</Text>
            </Pressable>
          )}
        {(po.status === 'ORDERED' ||
          po.status === 'PARTIALLY_RECEIVED' ||
          po.status === 'RECEIVED') &&
          canReturn && (
            <Pressable
              style={[styles.actionBtn, styles.returnBtn]}
              onPress={() =>
                navigation.navigate('PurchaseReturn', { poId: po.id })
              }>
              <Text style={styles.actionBtnText}>Retur ke Supplier</Text>
            </Pressable>
          )}
      </View>
      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  muted: {
    color: '#666',
    marginTop: 8,
  },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  docNo: {
    fontSize: 17,
    fontWeight: '700',
  },
  status: {
    fontSize: 13,
    color: '#2e7d32',
    fontWeight: '600',
  },
  supplier: {
    fontSize: 15,
    marginTop: 4,
  },
  meta: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  notes: {
    fontSize: 13,
    color: '#555',
    marginTop: 6,
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  progress: {
    fontSize: 13,
    color: '#2e7d32',
    marginTop: 4,
  },
  total: {
    fontSize: 16,
    fontWeight: '700',
    marginVertical: 12,
  },
  actions: {
    gap: 10,
  },
  actionBtn: {
    backgroundColor: '#2e7d32',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  dangerBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#c62828',
  },
  dangerText: {
    color: '#c62828',
  },
  receiveBtn: {
    backgroundColor: '#1565c0',
  },
  returnBtn: {
    backgroundColor: '#ef6c00',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  spacer: {
    height: 40,
  },
});
