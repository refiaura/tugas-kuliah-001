/**
 * Sale return request screen: per-item return qty (validated against the
 * sold qty) with a SELLABLE/DAMAGED condition per line and a mandatory
 * reason. Submits to POST /sales/{id}/returns.
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
import { getSale, SaleItemResponse } from '../../services/saleApi';
import {
  requestReturn,
  ReturnLineRequest,
} from '../../services/controlApi';
import { formatRupiah } from '../../stores/cartStore';

type Props = NativeStackScreenProps<AppStackParamList, 'ReturnRequest'>;

type Condition = 'SELLABLE' | 'DAMAGED';

const CONDITIONS: Condition[] = ['SELLABLE', 'DAMAGED'];

function conditionLabel(c: Condition): string {
  return c === 'SELLABLE' ? 'Layak jual' : 'Rusak';
}

function parseQty(text: string, max: number): number | null {
  const cleaned = text.replace(',', '.').replace(/[^0-9.]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0 || n > max) return null;
  return n;
}

export default function ReturnRequestScreen({ navigation, route }: Props) {
  const { saleId } = route.params;
  const [items, setItems] = useState<SaleItemResponse[]>([]);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [loading, setLoading] = useState(true);
  const [qtyTexts, setQtyTexts] = useState<Record<number, string>>({});
  const [conditions, setConditions] = useState<Record<number, Condition>>({});
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const sale = await getSale(saleId);
        if (sale.status === 'VOIDED') {
          Alert.alert(
            'Tidak bisa retur',
            'Transaksi ini sudah di-void, retur tidak dapat diajukan.',
            [{ text: 'OK', onPress: () => navigation.goBack() }],
          );
          return;
        }
        setItems(sale.items.filter(i => i.qty > 0));
        setInvoiceNo(sale.invoiceNo);
      } catch (e) {
        Alert.alert(
          'Gagal',
          e instanceof Error ? e.message : 'Gagal memuat transaksi.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [saleId, navigation]);

  const filledLines = useMemo<ReturnLineRequest[]>(
    () =>
      Object.entries(qtyTexts)
        .map(([itemId, text]) => {
          const item = items.find(i => i.id === Number(itemId));
          if (!item) return null;
          const qty = parseQty(text, item.qty);
          if (qty === null) return null;
          return {
            saleItemId: item.id,
            qty,
            condition: conditions[item.id] ?? 'SELLABLE',
          };
        })
        .filter((l): l is ReturnLineRequest => l !== null),
    [qtyTexts, items, conditions],
  );

  const doSubmit = async () => {
    if (filledLines.length === 0) {
      Alert.alert(
        'Belum ada qty',
        'Isi qty retur yang valid untuk minimal satu baris.',
      );
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Alasan wajib', 'Isi alasan retur.');
      return;
    }
    setSubmitting(true);
    try {
      const ret = await requestReturn(saleId, {
        reason: reason.trim(),
        lines: filledLines,
      });
      Alert.alert(
        'Retur diajukan',
        `${ret.returnNo} untuk ${invoiceNo} tercatat${ret.status === 'PENDING' ? '; menunggu persetujuan supervisor' : ''}. Refund ${formatRupiah(ret.refundAmount)}.`,
        [
          {
            text: 'OK',
            onPress: () =>
              navigation.replace('TransactionDetail', { saleId }),
          },
        ],
      );
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal mengajukan retur.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Memuat transaksi…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Transaksi {invoiceNo}</Text>
      <TextInput
        style={styles.reasonInput}
        value={reason}
        onChangeText={setReason}
        placeholder="Alasan retur (wajib)"
      />
      <FlatList
        data={items}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.muted}>
            Tidak ada item yang bisa diretur pada transaksi ini.
          </Text>
        }
        renderItem={({ item }) => {
          const cond = conditions[item.id] ?? 'SELLABLE';
          return (
            <View style={styles.card}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.meta}>
                Terjual {item.qty} × {formatRupiah(item.unitPrice)}
              </Text>
              <TextInput
                style={styles.qtyInput}
                value={qtyTexts[item.id] ?? ''}
                onChangeText={text =>
                  setQtyTexts(prev => ({ ...prev, [item.id]: text }))
                }
                keyboardType="decimal-pad"
                placeholder={`Qty retur (maks ${item.qty})`}
              />
              <View style={styles.condRow}>
                {CONDITIONS.map(c => (
                  <Pressable
                    key={c}
                    style={[
                      styles.condChip,
                      cond === c && styles.condChipActive,
                    ]}
                    onPress={() =>
                      setConditions(prev => ({ ...prev, [item.id]: c }))
                    }>
                    <Text
                      style={[
                        styles.condText,
                        cond === c && styles.condTextActive,
                      ]}>
                      {conditionLabel(c)}
                    </Text>
                  </Pressable>
                ))}
              </View>
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
              ? 'Mengirim…'
              : `Ajukan Retur (${filledLines.length})`}
          </Text>
        </Pressable>
      </View>
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
  meta: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
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
  condRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  condChip: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  condChipActive: {
    backgroundColor: '#1565c0',
    borderColor: '#1565c0',
  },
  condText: {
    fontSize: 13,
    color: '#555',
  },
  condTextActive: {
    color: '#fff',
    fontWeight: '600',
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
    backgroundColor: '#2e7d32',
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
