/**
 * Receipt screen shown after a successful checkout.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatRupiah } from '../../stores/cartStore';
import { AppStackParamList } from '../../app/navigation';

type Props = NativeStackScreenProps<AppStackParamList, 'Receipt'>;

export default function ReceiptScreen({ navigation, route }: Props) {
  const { sale } = route.params;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Transaksi Berhasil</Text>
        <Text style={styles.invoice}>{sale.invoiceNo}</Text>

        {sale.cashierName ? (
          <Text style={styles.meta}>Kasir: {sale.cashierName}</Text>
        ) : null}
        {sale.customerName ? (
          <Text style={styles.meta}>Pelanggan: {sale.customerName}</Text>
        ) : null}

        <View style={styles.divider} />

        {sale.items.map((it, idx) => (
          <View key={`${it.productId}-${idx}`} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>
                {it.name}
              </Text>
              <Text style={styles.itemMeta}>
                {formatRupiah(it.unitPrice)} × {it.qty}
                {it.discount > 0
                  ? ` · disc ${formatRupiah(it.discount)}`
                  : ''}
              </Text>
            </View>
            <Text style={styles.itemTotal}>{formatRupiah(it.subtotal)}</Text>
          </View>
        ))}

        <View style={styles.divider} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{formatRupiah(sale.subtotal)}</Text>
        </View>
        {sale.discountTotal > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Diskon</Text>
            <Text style={styles.totalValue}>
              −{formatRupiah(sale.discountTotal)}
            </Text>
          </View>
        )}
        <View style={styles.totalRow}>
          <Text style={styles.grandLabel}>Total</Text>
          <Text style={styles.grandValue}>{formatRupiah(sale.grandTotal)}</Text>
        </View>

        <View style={styles.divider} />

        {sale.payments.map((p, idx) => (
          <View key={`${p.paymentMethodCode}-${idx}`} style={styles.totalRow}>
            <Text style={styles.totalLabel}>{p.paymentMethodName}</Text>
            <Text style={styles.totalValue}>{formatRupiah(p.amount)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Dibayar</Text>
          <Text style={styles.totalValue}>{formatRupiah(sale.paidTotal)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Kembalian</Text>
          <Text style={styles.changeValue}>
            {formatRupiah(sale.changeAmount)}
          </Text>
        </View>
      </ScrollView>

      <Pressable
        style={styles.doneBtn}
        onPress={() => navigation.navigate('Pos')}>
        <Text style={styles.doneText}>Selesai — Kembali ke Kasir</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { padding: 20 },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    color: '#2e7d32',
  },
  invoice: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  meta: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 2 },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ccc',
    marginVertical: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemInfo: { flex: 1, marginRight: 8 },
  itemName: { fontSize: 14, fontWeight: '600' },
  itemMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: '600' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  totalLabel: { fontSize: 14, color: '#666' },
  totalValue: { fontSize: 14, fontWeight: '600' },
  grandLabel: { fontSize: 16, fontWeight: '700' },
  grandValue: { fontSize: 18, fontWeight: '800', color: '#2e7d32' },
  changeValue: { fontSize: 15, fontWeight: '800', color: '#1565c0' },
  doneBtn: {
    backgroundColor: '#2e7d32',
    margin: 16,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
