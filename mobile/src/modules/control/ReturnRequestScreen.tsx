/**
 * Sale return request — modern minimalist.
 * Per-item return qty (validated vs sold qty), SELLABLE/DAMAGED condition
 * chips, mandatory reason. Submits to POST /sales/{id}/returns.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
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
import { Badge, Button, Card, EmptyState, Input, ScreenHeader } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

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
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.muted}>Memuat transaksi…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Ajukan Retur" subtitle={`Transaksi ${invoiceNo}`} />
      <View style={styles.reasonWrap}>
        <Input
          label="Alasan retur (wajib)"
          value={reason}
          onChangeText={setReason}
          placeholder="cth. Barang cacat / salah ukuran"
          editable={!submitting}
        />
      </View>
      <FlatList
        data={items}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            title="Tidak ada item"
            message="Tidak ada item yang bisa diretur pada transaksi ini."
            icon="↩️"
          />
        }
        renderItem={({ item }) => {
          const cond = conditions[item.id] ?? 'SELLABLE';
          const valid = parseQty(qtyTexts[item.id] ?? '', item.qty) !== null;
          return (
            <Card>
              <View style={styles.itemHeader}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                {valid ? (
                  <Badge label={`Retur ${qtyTexts[item.id]}`} tone="accent" />
                ) : null}
              </View>
              <Text style={styles.meta}>
                Terjual {item.qty} × {formatRupiah(item.unitPrice)}
              </Text>
              <Input
                value={qtyTexts[item.id] ?? ''}
                onChangeText={text =>
                  setQtyTexts(prev => ({ ...prev, [item.id]: text }))
                }
                keyboardType="decimal-pad"
                placeholder={`Qty retur (maks ${item.qty})`}
                containerStyle={styles.qtyInput}
                editable={!submitting}
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
            </Card>
          );
        }}
      />
      <View style={styles.footer}>
        <Button
          title={submitting ? 'Mengirim…' : `Ajukan Retur (${filledLines.length})`}
          onPress={() => void doSubmit()}
          loading={submitting}
          size="lg"
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
  reasonWrap: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  list: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 110,
    flexGrow: 1,
    gap: spacing.md,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  name: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  qtyInput: {
    marginTop: spacing.md,
    marginBottom: 0,
  },
  condRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  condChip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  condChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  condText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  condTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
