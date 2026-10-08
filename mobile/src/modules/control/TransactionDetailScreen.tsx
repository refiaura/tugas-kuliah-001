/**
 * Transaction detail screen: invoice header, items, payments, totals.
 * COMPLETED sales can be void-requested (sales.create) via a reason modal,
 * or routed to the sale-return form. VOIDED sales are shown read-only.
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
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../app/navigation';
import { useAuthStore } from '../../stores/authStore';
import { getSale, SaleResponse } from '../../services/saleApi';
import { requestVoid } from '../../services/controlApi';
import { formatRupiah } from '../../stores/cartStore';

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
        <ActivityIndicator size="large" />
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.invoice}>{sale.invoiceNo}</Text>
          <Text
            style={[
              styles.status,
              isVoided ? styles.statusVoided : styles.statusCompleted,
            ]}>
            {isVoided ? 'Void' : isCompleted ? 'Selesai' : sale.status}
          </Text>
        </View>
        <Row label="Kasir" value={sale.cashierName ?? '-'} />
        <Row label="Pelanggan" value={sale.customerName ?? '-'} />
        <Row label="Selesai" value={formatDate(sale.completedAt)} />
        {sale.notes ? <Row label="Catatan" value={sale.notes} /> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Item</Text>
        {sale.items.map(item => (
          <View key={item.id} style={styles.itemRow}>
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
      </View>

      <View style={styles.card}>
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
      </View>

      {isVoided && (
        <View style={styles.voidBanner}>
          <Text style={styles.voidBannerText}>
            Transaksi ini telah di-void.
          </Text>
        </View>
      )}

      {isCompleted && canRequest && (
        <View style={styles.rowBtns}>
          <Pressable
            style={styles.dangerBtn}
            onPress={() => setVoidVisible(true)}>
            <Text style={styles.dangerBtnText}>Minta Void</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() =>
              navigation.navigate('ReturnRequest', { saleId: sale.id })
            }>
            <Text style={styles.secondaryBtnText}>Ajukan Retur</Text>
          </Pressable>
        </View>
      )}

      <Modal visible={voidVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Minta Void</Text>
            <Text style={styles.muted}>
              Permintaan void {sale.invoiceNo} akan dikirim ke approval inbox.
            </Text>
            <Text style={styles.label}>Alasan (wajib)</Text>
            <TextInput
              style={styles.input}
              value={voidReason}
              onChangeText={setVoidReason}
              placeholder="cth. Salah input item / pelanggan batal"
              multiline
            />
            <View style={styles.rowBtns}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setVoidVisible(false)}>
                <Text style={styles.secondaryBtnText}>Batal</Text>
              </Pressable>
              <Pressable
                style={[styles.dangerBtn, voidSaving && styles.btnDisabled]}
                onPress={() => void doRequestVoid()}
                disabled={voidSaving}>
                <Text style={styles.dangerBtnText}>
                  {voidSaving ? 'Mengirim…' : 'Kirim Permintaan'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
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
  container: {
    padding: 16,
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
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    marginBottom: 8,
  },
  invoice: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusCompleted: {
    color: '#2e7d32',
    backgroundColor: '#e8f5e9',
  },
  statusVoided: {
    color: '#c62828',
    backgroundColor: '#ffebee',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowLabel: {
    color: '#666',
    fontSize: 14,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  bold: {
    fontWeight: '700',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemMeta: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '700',
  },
  voidBanner: {
    backgroundColor: '#ffebee',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  voidBannerText: {
    color: '#c62828',
    fontWeight: '600',
    textAlign: 'center',
  },
  rowBtns: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  dangerBtn: {
    backgroundColor: '#c62828',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    flex: 1,
  },
  dangerBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryBtn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2e7d32',
    flex: 1,
  },
  secondaryBtnText: {
    color: '#2e7d32',
    fontWeight: '700',
    fontSize: 16,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
