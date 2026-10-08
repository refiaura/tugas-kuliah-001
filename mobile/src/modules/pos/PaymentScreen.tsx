/**
 * Payment screen — modern minimalist.
 * Hero total card, method chips, change highlight.
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
import { useShiftStore } from '../../stores/shiftStore';
import { AppStackParamList } from '../../app/navigation';
import { Button, Card, EmptyState } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

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
    void (async () => {
      // Shift must be open before any checkout (backend also enforces it).
      let shift = useShiftStore.getState().currentShift;
      if (!useShiftStore.getState().initialized) {
        await useShiftStore.getState().fetchCurrent();
        shift = useShiftStore.getState().currentShift;
      }
      if (!shift) {
        Alert.alert(
          'Shift belum dibuka',
          'Buka shift dulu sebelum memproses transaksi.',
          [
            { text: 'Batal', style: 'cancel' },
            {
              text: 'Buka Shift',
              onPress: () => navigation.navigate('MainTabs', { screen: 'ShiftTab' }),
            },
          ],
        );
        return;
      }
      confirmProcess();
    })();
  };

  const confirmProcess = () => {
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
      {/* Summary hero */}
      <Card style={styles.summary}>
        <Text style={styles.summaryLabel}>Total yang harus dibayar</Text>
        <Text style={styles.summaryTotal}>{formatRupiah(grandTotal)}</Text>
        <View style={styles.summaryRows}>
          <View style={styles.summaryRow}>
            <Text style={styles.rowLabel}>Sudah dibayar</Text>
            <Text style={styles.rowValue}>{formatRupiah(paidTotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.rowLabel}>Sisa</Text>
            <Text style={[styles.rowValue, remaining === 0 && styles.okText]}>
              {formatRupiah(remaining)}
            </Text>
          </View>
          {change > 0 && (
            <View style={[styles.summaryRow, styles.changeRow]}>
              <Text style={styles.changeLabel}>Kembalian</Text>
              <Text style={styles.changeValue}>{formatRupiah(change)}</Text>
            </View>
          )}
        </View>
      </Card>

      {/* Methods */}
      <Text style={styles.sectionTitle}>Metode pembayaran</Text>
      <View style={styles.methodGrid}>
        {PAYMENT_METHODS.map(m => {
          const active = methodId === m.id;
          return (
            <Pressable
              key={m.id}
              style={[styles.methodChip, active && styles.methodChipActive]}
              onPress={() => setMethodId(m.id)}>
              <Text
                style={[styles.methodText, active && styles.methodTextActive]}>
                {m.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Amount entry */}
      <View style={styles.amountRow}>
        <TextInput
          style={styles.amountInput}
          placeholder="Jumlah (Rp)"
          placeholderTextColor={colors.textMuted}
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="numeric"
          returnKeyType="done"
          onSubmitEditing={addPayment}
        />
        <Pressable style={styles.quickBtn} onPress={quickCash}>
          <Text style={styles.quickText}>Uang pas</Text>
        </Pressable>
        <Pressable style={styles.addBtn} onPress={addPayment}>
          <Text style={styles.addText}>+ Tambah</Text>
        </Pressable>
      </View>

      {/* Added payments */}
      <FlatList
        data={payments}
        keyExtractor={p => p.key}
        style={styles.payList}
        contentContainerStyle={styles.payContent}
        renderItem={({ item: p }) => (
          <Card style={styles.payItem} padding={spacing.md}>
            <View>
              <Text style={styles.payName}>{p.methodName}</Text>
              <Text style={styles.payAmount}>{formatRupiah(p.amount)}</Text>
            </View>
            <Pressable onPress={() => removePayment(p.key)} hitSlop={8}>
              <Text style={styles.removeText}>Hapus</Text>
            </Pressable>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            title="Belum ada pembayaran"
            message="Tambahkan di atas — bisa lebih dari satu."
            icon="○"
          />
        }
      />

      {/* Process */}
      <View style={styles.footer}>
        <Button
          title="Proses Pembayaran"
          size="lg"
          onPress={process}
          loading={processing}
          disabled={paidTotal < grandTotal || processing}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  summary: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  summaryTotal: {
    ...typography.display,
    color: colors.primary,
    fontSize: 34,
    marginTop: spacing.xs,
  },
  summaryRows: {
    width: '100%',
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  rowValue: {
    ...typography.bodyBold,
    color: colors.text,
  },
  okText: {
    color: colors.primary,
  },
  changeRow: {
    marginTop: spacing.sm,
  },
  changeLabel: {
    ...typography.subtitle,
    color: colors.text,
  },
  changeValue: {
    ...typography.title,
    color: colors.primary,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.md,
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  methodChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  methodChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  methodText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  methodTextActive: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  amountRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  amountInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
    minHeight: 52,
  },
  quickBtn: {
    backgroundColor: colors.slate[100],
    borderRadius: radius.lg,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  quickText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  addText: {
    ...typography.bodyBold,
    color: colors.white,
  },
  payList: {
    flex: 1,
  },
  payContent: {
    paddingBottom: spacing.sm,
  },
  payItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  payName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  payAmount: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  removeText: {
    ...typography.bodyBold,
    color: colors.danger[600],
  },
  footer: {
    paddingTop: spacing.md,
  },
});
