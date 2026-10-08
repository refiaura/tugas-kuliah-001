/**
 * Transaction detail — modern minimalist.
 * Invoice header, items, payments, totals; void / return actions for
 * COMPLETED sales, read-only banner for VOIDED.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../app/navigation';
import { useAuthStore } from '../../stores/authStore';
import { getSale, SaleResponse } from '../../services/saleApi';
import { requestVoid } from '../../services/controlApi';
import { formatRupiah } from '../../stores/cartStore';
import { Badge, Button, Card, Input } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'TransactionDetail'>;

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function statusMeta(status: string): { label: string; tone: 'accent' | 'danger' | 'neutral' } {
  switch (status) {
    case 'COMPLETED':
      return { label: 'Selesai', tone: 'accent' };
    case 'VOIDED':
      return { label: 'Void', tone: 'danger' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

export default function TransactionDetailScreen({ navigation, route }: Props) {
  const { saleId } = route.params;
  const hasPermission = useAuthStore(s => s.hasPermission);
  const [sale, setSale] = useState<SaleResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // void request modal
  const [voidVisible, setVoidVisible] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidSaving, setVoidSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await getSale(saleId);
      setSale(s);
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal memuat detail transaksi.',
      );
    }
  }, [saleId]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const doRequestVoid = async () => {
    if (!voidReason.trim()) {
      Alert.alert('Alasan wajib', 'Isi alasan permintaan void.');
      return;
    }
    setVoidSaving(true);
    try {
      const approval = await requestVoid(saleId, voidReason.trim());
      setVoidVisible(false);
      setVoidReason('');
      Alert.alert(
        'Permintaan void terkirim',
        `Pengajuan #${approval.id} menunggu persetujuan supervisor.`,
      );
      await load();
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal mengajukan void.',
      );
    } finally {
      setVoidSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.muted}>Memuat transaksi…</Text>
      </View>
    );
  }

  if (!sale) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Transaksi tidak ditemukan.</Text>
      </View>
    );
  }

  const isVoided = sale.status === 'VOIDED';
  const isCompleted = sale.status === 'COMPLETED';
  const canRequest = hasPermission('sales.create');
  const sm = statusMeta(sale.status);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}>
      <Card>
        <View style={styles.cardHeader}>
          <Text style={styles.invoice} numberOfLines={1}>
            {sale.invoiceNo}
          </Text>
          <Badge label={sm.label} tone={sm.tone} />
        </View>
        <Row label="Kasir" value={sale.cashierName ?? '-'} />
        <Row label="Pelanggan" value={sale.customerName ?? '-'} />
        <Row label="Selesai" value={formatDate(sale.completedAt)} />
        {sale.notes ? <Row label="Catatan" value={sale.notes} /> : null}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Item</Text>
        {sale.items.map((item, idx) => (
          <View
            key={item.id}
            style={[styles.itemRow, idx > 0 && styles.itemDivider]}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.itemMeta}>
                {item.sku} · {item.qty} × {formatRupiah(item.unitPrice)}
                {item.discount > 0
                  ? ` · disc ${formatRupiah(item.discount)}`
                  : ''}
              </Text>
            </View>
            <Text style={styles.itemTotal}>{formatRupiah(item.subtotal)}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Pembayaran</Text>
        {sale.payments.map((p, idx) => (
          <Row
            key={`${p.paymentMethodCode}-${idx}`}
            label={p.paymentMethodName}
            value={formatRupiah(p.amount)}
          />
        ))}
        <View style={styles.divider} />
        <Row label="Subtotal" value={formatRupiah(sale.subtotal)} />
        <Row label="Diskon" value={formatRupiah(sale.discountTotal)} />
        <Row label="Pajak" value={formatRupiah(sale.taxTotal)} />
        <Row label="Total" value={formatRupiah(sale.grandTotal)} bold />
        <Row label="Dibayar" value={formatRupiah(sale.paidTotal)} />
        <Row label="Kembalian" value={formatRupiah(sale.changeAmount)} />
      </Card>

      {isVoided && (
        <Card style={styles.voidBanner}>
          <Text style={styles.voidBannerText}>
            Transaksi ini telah di-void.
          </Text>
        </Card>
      )}

      {isCompleted && canRequest && (
        <View style={styles.rowBtns}>
          <Button
            title="Minta Void"
            variant="danger"
            onPress={() => setVoidVisible(true)}
            style={styles.flexBtn}
          />
          <Button
            title="Ajukan Retur"
            variant="secondary"
            onPress={() =>
              navigation.navigate('ReturnRequest', { saleId: sale.id })
            }
            style={styles.flexBtn}
          />
        </View>
      )}

      <Modal visible={voidVisible} animationType="slide" transparent>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setVoidVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Minta Void</Text>
            <Text style={styles.modalDesc}>
              Permintaan void {sale.invoiceNo} akan dikirim ke approval inbox.
            </Text>
            <Input
              label="Alasan (wajib)"
              value={voidReason}
              onChangeText={setVoidReason}
              placeholder="cth. Salah input item / pelanggan batal"
              multiline
              editable={!voidSaving}
            />
            <View style={styles.rowBtns}>
              <Button
                title="Batal"
                variant="ghost"
                onPress={() => setVoidVisible(false)}
                style={styles.flexBtn}
              />
              <Button
                title={voidSaving ? 'Mengirim…' : 'Kirim Permintaan'}
                variant="danger"
                onPress={() => void doRequestVoid()}
                loading={voidSaving}
                style={styles.flexBtn}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.xl,
    paddingBottom: spacing.huge,
    gap: spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xxl,
  },
  muted: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  invoice: {
    ...typography.title,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  rowValue: {
    ...typography.bodyBold,
    color: colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  bold: {
    ...typography.title,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  itemDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  voidBanner: {
    backgroundColor: colors.danger[50],
    borderColor: colors.danger[50],
    alignItems: 'center',
  },
  voidBannerText: {
    ...typography.bodyBold,
    color: colors.danger[600],
  },
  rowBtns: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  flexBtn: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xxl,
    paddingBottom: spacing.huge,
  },
  modalTitle: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalDesc: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
});
