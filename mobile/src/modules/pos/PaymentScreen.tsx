/**
 * Payment screen: split payment across methods, change calculation,
 * then checkout (or resume a held sale).
 */
import React, { useMemo, useState } from 'react';
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
import {
  checkoutSale,
  newIdempotencyKey,
  PAYMENT_METHODS,
  resumeSale,
  SaleResponse,
} from '../../services/saleApi';
import {
  cartGrandTotal,
  formatRupiah,
  useCartStore,
} from '../../stores/cartStore';
import { AppStackParamList } from '../../app/navigation';

type Props = NativeStackScreenProps<AppStackParamList, 'Payment'>;

interface DraftPayment {
  key: string;
  methodId: number;
  methodName: string;
  amount: number;
  referenceNo?: string;
}

function parseRupiahInput(text: string): number {
  const n = Number(text.replace(/[^0-9]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export default function PaymentScreen({ navigation, route }: Props) {
  const resumeSaleId = route.params.resumeSaleId;
  const items = useCartStore(s => s.items);
  const discountTotal = useCartStore(s => s.discountTotal);
  const customerId = useCartStore(s => s.customerId);
  const notes = useCartStore(s => s.notes);
  const clearCart = useCartStore(s => s.clear);

  const grandTotal = useMemo(
    () => cartGrandTotal(items, discountTotal),
    [items, discountTotal],
  );

  const [payments, setPayments] = useState<DraftPayment[]>([]);
  const [methodId, setMethodId] = useState<number>(1);
  const [amountText, setAmountText] = useState('');
  const [processing, setProcessing] = useState(false);

  const paidTotal = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, grandTotal - paidTotal);
  const change = Math.max(0, paidTotal - grandTotal);

  const addPayment = () => {
    const amount = parseRupiahInput(amountText);
    if (amount <= 0) {
      Alert.alert('Jumlah tidak valid', 'Masukkan jumlah pembayaran.');
      return;
    }
    const method = PAYMENT_METHODS.find(m => m.id === methodId);
    if (!method) {
      return;
    }
    setPayments(prev => [
      ...prev,
      {
        key: `${Date.now()}-${prev.length}`,
        methodId: method.id,
        methodName: method.name,
        amount,
      },
    ]);
    setAmountText('');
  };

  const removePayment = (key: string) => {
    setPayments(prev => prev.filter(p => p.key !== key));
  };

  const quickCash = () => {
    setMethodId(1);
    setAmountText(String(Math.max(grandTotal - paidTotal, 0)));
  };

  const process = () => {
    if (paidTotal < grandTotal) {
      Alert.alert(
        'Pembayaran kurang',
        `Masih kurang ${formatRupiah(grandTotal - paidTotal)}.`,
      );
      return;
    }
    Alert.alert(
      'Proses Transaksi',
      `Total ${formatRupiah(grandTotal)} · Bayar ${formatRupiah(
        paidTotal,
      )} · Kembali ${formatRupiah(change)}. Lanjut?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Proses',
          onPress: () => {
            void (async () => {
              setProcessing(true);
              try {
                const body = {
                  items: items.map(i => ({
                    productId: i.productId,
                    qty: i.qty,
                    discount: i.discount > 0 ? i.discount : undefined,
                  })),
                  payments: payments.map(p => ({
                    paymentMethodId: p.methodId,
                    amount: p.amount,
                    referenceNo: p.referenceNo,
                  })),
                  customerId: customerId ?? undefined,
                  discountTotal:
                    discountTotal > 0 ? discountTotal : undefined,
                  notes: notes.trim() || undefined,
                };
                let sale: SaleResponse;
                if (resumeSaleId !== undefined) {
                  sale = await resumeSale(resumeSaleId, {
                    ...body,
                    idempotencyKey: newIdempotencyKey(),
                  });
                } else {
                  sale = await checkoutSale({
                    ...body,
                    idempotencyKey: newIdempotencyKey(),
                  });
                }
                clearCart();
                navigation.replace('Receipt', { sale });
              } catch (e) {
                Alert.alert(
                  'Gagal',
                  e instanceof Error ? e.message : 'Gagal memproses transaksi.',
                );
              } finally {
                setProcessing(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total belanja</Text>
          <Text style={styles.summaryTotal}>{formatRupiah(grandTotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Sudah dibayar</Text>
          <Text style={styles.summaryValue}>{formatRupiah(paidTotal)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Sisa</Text>
          <Text
            style={[
              styles.summaryValue,
              remaining === 0 && styles.okText,
            ]}>
            {formatRupiah(remaining)}
          </Text>
        </View>
        {change > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Kembalian</Text>
            <Text style={styles.changeText}>{formatRupiah(change)}</Text>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Metode pembayaran</Text>
      <View style={styles.methodGrid}>
        {PAYMENT_METHODS.map(m => (
          <Pressable
            key={m.id}
            style={[
              styles.methodChip,
              methodId === m.id && styles.methodChipActive,
            ]}
            onPress={() => setMethodId(m.id)}>
            <Text
              style={[
                styles.methodText,
                methodId === m.id && styles.methodTextActive,
              ]}>
              {m.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.amountRow}>
        <TextInput
          style={styles.amountInput}
          placeholder="Jumlah (Rp)"
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="numeric"
        />
        <Pressable style={styles.quickBtn} onPress={quickCash}>
          <Text style={styles.quickText}>Uang pas</Text>
        </Pressable>
        <Pressable style={styles.addBtn} onPress={addPayment}>
          <Text style={styles.addText}>+ Tambah</Text>
        </Pressable>
      </View>

      <FlatList
        data={payments}
        keyExtractor={p => p.key}
        style={styles.payList}
        renderItem={({ item: p }) => (
          <View style={styles.payItem}>
            <View>
              <Text style={styles.payName}>{p.methodName}</Text>
              <Text style={styles.payAmount}>{formatRupiah(p.amount)}</Text>
            </View>
            <Pressable onPress={() => removePayment(p.key)} hitSlop={8}>
              <Text style={styles.removeText}>Hapus</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Belum ada pembayaran. Tambahkan di atas (bisa lebih dari satu).
          </Text>
        }
      />

      <Pressable
        style={[
          styles.processBtn,
          (paidTotal < grandTotal || processing) && styles.processBtnDisabled,
        ]}
        onPress={process}
        disabled={paidTotal < grandTotal || processing}>
        {processing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.processText}>Proses Pembayaran</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: { fontSize: 14, color: '#666' },
  summaryTotal: { fontSize: 20, fontWeight: '800', color: '#2e7d32' },
  summaryValue: { fontSize: 15, fontWeight: '600' },
  okText: { color: '#2e7d32' },
  changeText: { fontSize: 16, fontWeight: '800', color: '#1565c0' },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  methodChip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  methodChipActive: { borderColor: '#2e7d32', backgroundColor: '#e8f5e9' },
  methodText: { fontSize: 14, color: '#333' },
  methodTextActive: { color: '#2e7d32', fontWeight: '700' },
  amountRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  amountInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  quickBtn: {
    backgroundColor: '#e3f2fd',
    borderRadius: 10,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  quickText: { color: '#1565c0', fontWeight: '600' },
  addBtn: {
    backgroundColor: '#2e7d32',
    borderRadius: 10,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  addText: { color: '#fff', fontWeight: '700' },
  payList: { flex: 1 },
  payItem: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payName: { fontSize: 14, fontWeight: '600' },
  payAmount: { fontSize: 14, color: '#2e7d32', fontWeight: '700', marginTop: 2 },
  removeText: { color: '#c62828', fontWeight: '600' },
  emptyText: { color: '#888', textAlign: 'center', padding: 16 },
  processBtn: {
    backgroundColor: '#2e7d32',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  processBtnDisabled: { backgroundColor: '#a5d6a7' },
  processText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
