/**
 * Purchase return screen: pick a PO that already received goods, input
 * the return qty per line (validated against received-minus-returned on
 * the backend) plus a mandatory reason. Posts PURCHASE_RETURN movements
 * and records supplier credit.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../app/navigation';
import {
  createPurchaseReturn,
  getPurchaseOrder,
  listPurchaseOrders,
  PoLine,
  PurchaseOrder,
} from '../../services/purchaseApi';
import { formatQty } from '../../services/stockApi';

type Props = NativeStackScreenProps<AppStackParamList, 'PurchaseReturn'>;

const RETURNABLE = ['ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED'];

function parseQty(text: string): number | null {
  const cleaned = text.replace(',', '.').replace(/[^0-9.]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function PurchaseReturnScreen({ navigation, route }: Props) {
  const initialPoId = route.params?.poId;
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [qtyTexts, setQtyTexts] = useState<Record<number, string>>({});
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await listPurchaseOrders(undefined, 0, 50);
        const returnable = res.items.filter(p =>
          RETURNABLE.includes(p.status),
        );
        setPos(returnable);
        if (initialPoId != null) {
          const found =
            returnable.find(p => p.id === initialPoId) ??
            (await getPurchaseOrder(initialPoId));
          if (RETURNABLE.includes(found.status)) {
            setPo(found);
          }
        }
      } catch (e) {
        Alert.alert(
          'Gagal',
          e instanceof Error ? e.message : 'Gagal memuat PO.',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [initialPoId]);

  const availableOf = (l: PoLine) => l.receivedQty - l.returnedQty;

  const filledLines = useMemo(
    () =>
      Object.entries(qtyTexts)
        .map(([poLineId, text]) => ({
          poLineId: Number(poLineId),
          qty: parseQty(text),
        }))
        .filter(l => l.qty !== null) as {
        poLineId: number;
        qty: number;
      }[],
    [qtyTexts],
  );

  const doSubmit = async () => {
    if (!po) {
      Alert.alert('Pilih PO', 'Pilih purchase order terlebih dahulu.');
      return;
    }
    if (filledLines.length === 0) {
      Alert.alert(
        'Belum ada qty',
        'Isi qty retur minimal untuk satu baris.',
      );
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Alasan wajib', 'Isi alasan retur.');
      return;
    }
    setSubmitting(true);
    try {
      const ret = await createPurchaseReturn({
        poId: po.id,
        reason: reason.trim(),
        lines: filledLines,
      });
      Alert.alert(
        'Berhasil',
        `${ret.docNo} tersimpan; kredit supplier Rp${ret.supplierCredit.toLocaleString('id-ID')}.`,
      );
      navigation.replace('PurchaseOrderDetail', { poId: po.id });
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal menyimpan retur.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Memuat PO…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Purchase Order</Text>
      {po ? (
        <View style={styles.poCard}>
          <Text style={styles.poDoc}>{po.docNo}</Text>
          <Text style={styles.meta}>{po.supplierName}</Text>
          <Pressable onPress={() => setPo(null)} hitSlop={8}>
            <Text style={styles.changeLink}>Ganti PO</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={pos}
          keyExtractor={item => String(item.id)}
          style={styles.poList}
          ListEmptyComponent={
            <Text style={styles.muted}>
              Tidak ada PO yang sudah menerima barang.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.poItem}
              onPress={() => {
                setPo(item);
                setQtyTexts({});
              }}>
              <Text style={styles.poDoc}>{item.docNo}</Text>
              <Text style={styles.meta}>{item.supplierName}</Text>
            </Pressable>
          )}
        />
      )}

      {po && (
        <>
          <TextInput
            style={styles.reasonInput}
            value={reason}
            onChangeText={setReason}
            placeholder="Alasan retur (wajib)"
          />
          <FlatList
            data={po.lines.filter(l => availableOf(l) > 0)}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.muted}>
                Tidak ada qty yang bisa diretur pada PO ini.
              </Text>
            }
            renderItem={({ item }) => {
              const available = availableOf(item);
              return (
                <View style={styles.card}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.productName}
                  </Text>
                  <Text style={styles.meta}>
                    Diterima {formatQty(item.receivedQty)} · sudah diretur{' '}
                    {formatQty(item.returnedQty)} · bisa diretur{' '}
                    {formatQty(available)}
                  </Text>
                  <TextInput
                    style={styles.qtyInput}
                    value={qtyTexts[item.id] ?? ''}
                    onChangeText={text =>
                      setQtyTexts(prev => ({ ...prev, [item.id]: text }))
                    }
                    keyboardType="decimal-pad"
                    placeholder={`Qty retur (maks ${formatQty(available)})`}
                  />
                </View>
              );
            }}
          />
          <View style={styles.footer}>
            <Pressable
              style={[styles.primaryBtn, submitting && styles.btnDisabled]}
              onPress={() => void doSubmit()}
              disabled={submitting}>
              <Text style={styles.primaryBtnText}>
                {submitting
                  ? 'Menyimpan…'
                  : `Simpan Retur (${filledLines.length})`}
              </Text>
            </Pressable>
          </View>
        </>
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
    padding: 24,
  },
  muted: {
    color: '#666',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    margin: 16,
    marginBottom: 8,
  },
  poList: {
    marginHorizontal: 16,
    flexGrow: 0,
    maxHeight: 280,
  },
  poItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  poCard: {
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  poDoc: {
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  changeLink: {
    color: '#ef6c00',
    fontWeight: '600',
    marginTop: 6,
  },
  reasonInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  list: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 90,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  qtyInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    marginTop: 8,
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  primaryBtn: {
    backgroundColor: '#ef6c00',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
