/**
 * Receipt screen — modern minimalist.
 * Paper-receipt feel: centered, dashed dividers, generous whitespace.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatRupiah } from '../../stores/cartStore';
import { AppStackParamList } from '../../app/navigation';
import { Button, Card } from '../../components';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Receipt'>;

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={bold ? styles.rowLabelBold : styles.rowLabel}>{label}</Text>
      <Text style={bold ? styles.rowValueBold : styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function ReceiptScreen({ navigation, route }: Props) {
  const { sale } = route.params;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Success mark */}
        <View style={styles.checkWrap}>
          <View style={styles.check}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <Text style={styles.title}>Transaksi Berhasil</Text>
          <Text style={styles.invoice}>{sale.invoiceNo}</Text>
        </View>

        {/* Paper receipt */}
        <Card style={styles.paper} padding={spacing.xl}>
          {(sale.cashierName || sale.customerName) && (
            <>
              {sale.cashierName ? (
                <Text style={styles.meta}>Kasir: {sale.cashierName}</Text>
              ) : null}
              {sale.customerName ? (
                <Text style={styles.meta}>Pelanggan: {sale.customerName}</Text>
              ) : null}
              <View style={styles.divider} />
            </>
          )}

          {sale.items.map((it, idx) => (
            <View key={`${it.productId}-${idx}`} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>
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

          <Row label="Subtotal" value={formatRupiah(sale.subtotal)} />
          {sale.discountTotal > 0 && (
            <Row
              label="Diskon"
              value={`−${formatRupiah(sale.discountTotal)}`}
            />
          )}
          <Row
            label="Total"
            value={formatRupiah(sale.grandTotal)}
            bold
          />

          <View style={styles.divider} />

          {sale.payments.map((p, idx) => (
            <Row
              key={`${p.paymentMethodCode}-${idx}`}
              label={p.paymentMethodName}
              value={formatRupiah(p.amount)}
            />
          ))}
          <Row label="Dibayar" value={formatRupiah(sale.paidTotal)} />
          <Row
            label="Kembalian"
            value={formatRupiah(sale.changeAmount)}
            bold
          />
        </Card>

        <Text style={styles.thanks}>Terima kasih atas kunjungannya</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Selesai — Kembali ke Kasir"
          size="lg"
          onPress={() => navigation.navigate('Pos')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.xl,
    paddingBottom: spacing.md,
  },
  checkWrap: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  check: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  checkMark: {
    fontSize: 28,
    color: colors.primary,
    fontWeight: '700',
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  invoice: {
    ...typography.bodyBold,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  paper: {
    marginBottom: spacing.lg,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 2,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderStyle: 'dashed',
    marginVertical: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  itemName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  itemMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemTotal: {
    ...typography.bodyBold,
    color: colors.text,
  },
  row: {
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
  rowLabelBold: {
    ...typography.title,
    color: colors.text,
  },
  rowValueBold: {
    ...typography.title,
    color: colors.primary,
  },
  thanks: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
  },
});
