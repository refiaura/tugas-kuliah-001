/**
 * Purchase return — modern minimalist.
 * PO picker, return qty inputs in Cards, sticky submit button.
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
import {
  createPurchaseReturn,
  getPurchaseOrder,
  listPurchaseOrders,
  PoLine,
  PurchaseOrder,
} from '../../services/purchaseApi';
import { formatQty } from '../../services/stockApi';
import { Button, Card, EmptyState, Input, ScreenHeader } from '../../components';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'PurchaseReturn'>;

const RETURNABLE = ['ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED'];

function parseQty(text: string): number | null {
  const cleaned = text.replace(',', '.').replace(/[^0-9.]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
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
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.muted}>Memuat PO…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Retur Supplier" subtitle="Stock out + kredit supplier" />

      <View style={styles.body}>
        <SectionTitle>Purchase Order</SectionTitle>
        {po ? (
          <Card style={styles.poCard}>
            <View style={styles.poRow}>
              <View style={styles.poText}>
                <Text style={styles.poDoc}>{po.docNo}</Text>
                <Text style={styles.meta}>{po.supplierName}</Text>
              </View>
              <Pressable onPress={() => setPo(null)} hitSlop={8}>
                <Text style={styles.changeLink}>Ganti</Text>
              </Pressable>
            </View>
          </Card>
        ) : (
          <FlatList
            data={pos}
            keyExtractor={item => String(item.id)}
            style={styles.poList}
            ListEmptyComponent={
              <EmptyState
                title="Tidak ada PO"
                message="Tidak ada PO yang sudah menerima barang."
              />
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setPo(item);
                  setQtyTexts({});
                }}>
                <Card style={styles.poItem}>
                  <Text style={styles.poDoc}>{item.docNo}</Text>
                  <Text style={styles.meta}>{item.supplierName}</Text>
                </Card>
              </Pressable>
            )}
          />
        )}

        {po && (
          <>
            <Card style={styles.reasonCard}>
              <Input
                value={reason}
                onChangeText={setReason}
                placeholder="Alasan retur (wajib)"
                containerStyle={styles.noMargin}
              />
            </Card>
            <FlatList
              data={po.lines.filter(l => availableOf(l) > 0)}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <EmptyState
                  title="Tidak ada qty"
                  message="Tidak ada qty yang bisa diretur pada PO ini."
                />
              }
              renderItem={({ item }) => {
                const available = availableOf(item);
                return (
                  <Card style={styles.lineCard}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.productName}
                    </Text>
                    <Text style={styles.meta}>
                      Diterima {formatQty(item.receivedQty)} · sudah diretur{' '}
                      {formatQty(item.returnedQty)} · bisa diretur{' '}
                      {formatQty(available)}
                    </Text>
                    <Input
                      value={qtyTexts[item.id] ?? ''}
                      onChangeText={text =>
                        setQtyTexts(prev => ({ ...prev, [item.id]: text }))
                      }
                      keyboardType="decimal-pad"
                      placeholder={`Qty retur (maks ${formatQty(available)})`}
                      containerStyle={styles.noMarginTop}
                    />
                  </Card>
                );
              }}
            />
            <View style={styles.footer}>
              <Button
                title={
                  submitting
                    ? 'Menyimpan…'
                    : `Simpan Retur (${filledLines.length})`
                }
                onPress={() => void doSubmit()}
                loading={submitting}
                size="lg"
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  muted: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  poList: {
    paddingHorizontal: spacing.xl,
    flexGrow: 0,
    maxHeight: 320,
  },
  poItem: {
    marginBottom: spacing.md,
  },
  poCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: colors.warning[50],
    borderColor: colors.warning[50],
  },
  poRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  poText: {
    flex: 1,
  },
  poDoc: {
    ...typography.bodyBold,
    color: colors.text,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  changeLink: {
    ...typography.bodyBold,
    color: colors.primary,
    marginLeft: spacing.md,
  },
  reasonCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  noMargin: {
    marginBottom: 0,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  lineCard: {
    marginBottom: spacing.md,
  },
  name: {
    ...typography.bodyBold,
    color: colors.text,
  },
  noMarginTop: {
    marginBottom: 0,
    marginTop: spacing.md,
  },
  footer: {
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
