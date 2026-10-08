/**
 * Goods receipt — modern minimalist.
 * PO picker, line qty inputs in Cards, sticky submit button.
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
  createGoodsReceipt,
  getPurchaseOrder,
  listPurchaseOrders,
  PoLine,
  PurchaseOrder,
} from '../../services/purchaseApi';
import { formatQty } from '../../services/stockApi';
import { Button, Card, EmptyState, Input, ScreenHeader } from '../../components';
import { colors, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'GoodsReceipt'>;

const RECEIVABLE = ['ORDERED', 'PARTIALLY_RECEIVED'];

function parseQty(text: string): number | null {
  const cleaned = text.replace(',', '.').replace(/[^0-9.]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export default function GoodsReceiptScreen({ navigation, route }: Props) {
  const initialPoId = route.params?.poId;
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [qtyTexts, setQtyTexts] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await listPurchaseOrders(undefined, 0, 50);
        const receivable = res.items.filter(p =>
          RECEIVABLE.includes(p.status),
        );
        setPos(receivable);
        if (initialPoId != null) {
          const found =
            receivable.find(p => p.id === initialPoId) ??
            (await getPurchaseOrder(initialPoId));
          if (RECEIVABLE.includes(found.status)) {
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

  const remainingOf = (l: PoLine) => l.qty - l.receivedQty;

  const filledLines = useMemo(
    () =>
      Object.entries(qtyTexts)
        .map(([poLineId, text]) => ({
          poLineId: Number(poLineId),
          receivedQty: parseQty(text),
        }))
        .filter(l => l.receivedQty !== null) as {
        poLineId: number;
        receivedQty: number;
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
        'Isi qty terima minimal untuk satu baris.',
      );
      return;
    }
    setSubmitting(true);
    try {
      const receipt = await createGoodsReceipt({
        poId: po.id,
        notes: notes.trim() || undefined,
        lines: filledLines,
      });
      Alert.alert(
        'Berhasil',
        `${receipt.docNo} tersimpan; stok bertambah.`,
      );
      navigation.replace('PurchaseOrderDetail', { poId: po.id });
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal menyimpan receipt.',
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
      <ScreenHeader title="Terima Barang" subtitle="Goods receipt · parsial didukung" />

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
                message="Tidak ada PO yang bisa diterima (ORDERED / PARTIALLY_RECEIVED)."
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
            <Card style={styles.notesCard}>
              <Input
                value={notes}
                onChangeText={setNotes}
                placeholder="Catatan receipt (opsional)"
                containerStyle={styles.noMargin}
              />
            </Card>
            <FlatList
              data={po.lines}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => {
                const remaining = remainingOf(item);
                return (
                  <Card style={styles.lineCard}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.productName}
                    </Text>
                    <Text style={styles.meta}>
                      Order {formatQty(item.qty)} · sudah diterima{' '}
                      {formatQty(item.receivedQty)} · sisa{' '}
                      {formatQty(remaining)}
                    </Text>
                    <Input
                      value={qtyTexts[item.id] ?? ''}
                      onChangeText={text =>
                        setQtyTexts(prev => ({ ...prev, [item.id]: text }))
                      }
                      keyboardType="decimal-pad"
                      placeholder={`Qty terima (maks ${formatQty(remaining)})`}
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
                    : `Simpan Receipt (${filledLines.length})`
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
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
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
  notesCard: {
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
