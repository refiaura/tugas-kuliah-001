/**
 * POS screen — modern minimalist.
 * Prominent search, compact product cards, sticky cart footer with big Bayar button.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  listProducts,
  ProductResponse,
} from '../../services/productApi';
import {
  holdSale,
  listHeldSales,
  SaleResponse,
} from '../../services/saleApi';
import {
  cartGrandTotal,
  formatRupiah,
  useCartStore,
} from '../../stores/cartStore';
import { AppStackParamList } from '../../app/navigation';
import { Button, Card, EmptyState } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Pos'>;

function useDebounced(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function PosScreen({ navigation }: Props) {
  const items = useCartStore(s => s.items);
  const discountTotal = useCartStore(s => s.discountTotal);
  const addItem = useCartStore(s => s.addItem);
  const updateQty = useCartStore(s => s.updateQty);
  const setItemDiscount = useCartStore(s => s.setItemDiscount);
  const removeItem = useCartStore(s => s.removeItem);
  const clearCart = useCartStore(s => s.clear);
  const customerId = useCartStore(s => s.customerId);
  const notes = useCartStore(s => s.notes);

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ProductResponse[]>([]);
  const [searching, setSearching] = useState(false);
  const [holding, setHolding] = useState(false);
  const [heldModalVisible, setHeldModalVisible] = useState(false);
  const [heldSales, setHeldSales] = useState<SaleResponse[]>([]);
  const [loadingHeld, setLoadingHeld] = useState(false);
  const debouncedSearch = useDebounced(search, 400);
  const searchSeq = useRef(0);

  const runSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    try {
      const res = await listProducts({
        search: q,
        activeOnly: true,
        size: 20,
      });
      if (seq === searchSeq.current) {
        setResults(res.items);
      }
    } catch {
      // ignore search errors; cart remains usable
    } finally {
      if (seq === searchSeq.current) {
        setSearching(false);
      }
    }
  }, []);

  useEffect(() => {
    void runSearch(debouncedSearch);
  }, [debouncedSearch, runSearch]);

  const subtotal = items.reduce(
    (sum, i) => sum + Math.max(0, i.unitPrice * i.qty - i.discount),
    0,
  );
  const grandTotal = cartGrandTotal(items, discountTotal);

  const onHold = () => {
    if (items.length === 0) {
      Alert.alert('Keranjang kosong', 'Tambahkan produk terlebih dahulu.');
      return;
    }
    Alert.alert('Tahan Transaksi', 'Simpan keranjang sebagai transaksi tertahan?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Tahan',
        onPress: () => {
          void (async () => {
            setHolding(true);
            try {
              await holdSale({
                items: items.map(i => ({
                  productId: i.productId,
                  qty: i.qty,
                  discount: i.discount > 0 ? i.discount : undefined,
                })),
                customerId: customerId ?? undefined,
                notes: notes.trim() || undefined,
              });
              clearCart();
              Alert.alert('Berhasil', 'Transaksi ditahan.');
            } catch (e) {
              Alert.alert(
                'Gagal',
                e instanceof Error ? e.message : 'Gagal menahan transaksi.',
              );
            } finally {
              setHolding(false);
            }
          })();
        },
      },
    ]);
  };

  const openHeld = async () => {
    setHeldModalVisible(true);
    setLoadingHeld(true);
    try {
      setHeldSales(await listHeldSales());
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal memuat transaksi tertahan.',
      );
      setHeldModalVisible(false);
    } finally {
      setLoadingHeld(false);
    }
  };

  const onResumeHeld = (sale: SaleResponse) => {
    if (items.length > 0) {
      Alert.alert(
        'Keranjang terisi',
        'Keranjang saat ini akan diganti dengan transaksi tertahan.',
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Lanjut', onPress: () => applyHeld(sale) },
        ],
      );
    } else {
      applyHeld(sale);
    }
  };

  const applyHeld = (sale: SaleResponse) => {
    clearCart();
    for (const si of sale.items) {
      addItem(
        {
          productId: si.productId,
          sku: si.sku,
          name: si.name,
          unitPrice: si.unitPrice,
        },
        si.qty,
      );
    }
    setHeldModalVisible(false);
    navigation.navigate('Payment', { resumeSaleId: sale.id });
  };

  const goToPayment = () => {
    if (items.length === 0) {
      Alert.alert('Keranjang kosong', 'Tambahkan produk terlebih dahulu.');
      return;
    }
    navigation.navigate('Payment', {});
  };

  return (
    <View style={styles.container}>
      {/* Prominent search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama / SKU / barcode…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searching && (
            <ActivityIndicator size="small" color={colors.primary} />
          )}
        </View>
      </View>

      {/* Search results */}
      {search.trim().length > 0 && (
        <Card style={styles.resultsCard} padding={0}>
          <FlatList
            data={results}
            keyExtractor={p => String(p.id)}
            keyboardShouldPersistTaps="handled"
            style={styles.resultsList}
            renderItem={({ item: p, index }) => (
              <Pressable
                style={[
                  styles.resultItem,
                  index > 0 && styles.resultDivider,
                ]}
                onPress={() => {
                  addItem({
                    productId: p.id,
                    sku: p.sku,
                    name: p.name,
                    unitPrice: p.sellingPrice,
                  });
                  setSearch('');
                }}>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={styles.resultMeta}>{p.sku}</Text>
                </View>
                <Text style={styles.resultPrice}>
                  {formatRupiah(p.sellingPrice)}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              !searching ? (
                <EmptyState
                  title="Tidak ditemukan"
                  message="Coba kata kunci lain."
                  icon="○"
                />
              ) : undefined
            }
          />
        </Card>
      )}

      {/* Cart header */}
      <View style={styles.cartHeader}>
        <Text style={styles.cartTitle}>
          Keranjang{items.length > 0 ? ` · ${items.length}` : ''}
        </Text>
        <Pressable onPress={() => void openHeld()} hitSlop={8}>
          <Text style={styles.heldLink}>Transaksi tertahan</Text>
        </Pressable>
      </View>

      {/* Cart items */}
      <FlatList
        data={items}
        keyExtractor={i => String(i.productId)}
        style={styles.cartList}
        contentContainerStyle={styles.cartContent}
        renderItem={({ item }) => (
          <Card style={styles.cartItem}>
            <View style={styles.cartInfo}>
              <Text style={styles.cartName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.cartMeta}>
                {formatRupiah(item.unitPrice)} × {item.qty}
              </Text>
              <TextInput
                style={styles.discInput}
                placeholder="Diskon (Rp)"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                defaultValue={item.discount > 0 ? String(item.discount) : ''}
                onEndEditing={e => {
                  const v = Number(e.nativeEvent.text.replace(/[^0-9]/g, ''));
                  setItemDiscount(
                    item.productId,
                    Number.isFinite(v) ? Math.min(v, item.unitPrice * item.qty) : 0,
                  );
                }}
              />
            </View>
            <View style={styles.qtyCol}>
              <View style={styles.qtyRow}>
                <Pressable
                  style={styles.qtyBtn}
                  onPress={() => updateQty(item.productId, item.qty - 1)}>
                  <Text style={styles.qtyBtnText}>−</Text>
                </Pressable>
                <Text style={styles.qtyText}>{item.qty}</Text>
                <Pressable
                  style={styles.qtyBtn}
                  onPress={() => updateQty(item.productId, item.qty + 1)}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </Pressable>
              </View>
              <Pressable
                style={styles.removeBtn}
                onPress={() => removeItem(item.productId)}
                hitSlop={8}>
                <Text style={styles.removeText}>Hapus</Text>
              </Pressable>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            title="Keranjang kosong"
            message="Cari produk di atas untuk menambah."
            icon="○"
          />
        }
      />

      {/* Sticky footer */}
      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{formatRupiah(subtotal)}</Text>
        </View>
        {discountTotal > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Diskon</Text>
            <Text style={styles.totalValue}>
              −{formatRupiah(discountTotal)}
            </Text>
          </View>
        )}
        <View style={[styles.totalRow, styles.grandRow]}>
          <Text style={styles.grandLabel}>Total</Text>
          <Text style={styles.grandValue}>{formatRupiah(grandTotal)}</Text>
        </View>
        <View style={styles.actionRow}>
          <Button
            title={holding ? 'Menahan…' : 'Tahan'}
            variant="secondary"
            onPress={onHold}
            disabled={holding || items.length === 0}
            style={styles.holdBtn}
          />
          <Button
            title="Bayar"
            size="lg"
            onPress={goToPayment}
            disabled={items.length === 0}
            style={styles.payBtn}
          />
        </View>
      </View>

      {/* Held sales modal */}
      <Modal
        visible={heldModalVisible}
        animationType="slide"
        onRequestClose={() => setHeldModalVisible(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Transaksi Tertahan</Text>
          {loadingHeld ? (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={styles.modalSpinner}
            />
          ) : (
            <FlatList
              data={heldSales}
              keyExtractor={s => String(s.id)}
              contentContainerStyle={styles.modalList}
              renderItem={({ item: s }) => (
                <Pressable onPress={() => onResumeHeld(s)}>
                  <Card style={styles.heldItem}>
                    <View style={styles.heldInfo}>
                      <Text style={styles.heldInvoice}>{s.invoiceNo}</Text>
                      <Text style={styles.heldMeta}>
                        {s.items.length} item · {formatRupiah(s.grandTotal)}
                      </Text>
                    </View>
                    <Text style={styles.heldChevron}>›</Text>
                  </Card>
                </Pressable>
              )}
              ListEmptyComponent={
                <EmptyState
                  title="Tidak ada"
                  message="Tidak ada transaksi tertahan."
                  icon="○"
                />
              }
            />
          )}
          <View style={styles.modalFooter}>
            <Button
              title="Tutup"
              variant="secondary"
              onPress={() => setHeldModalVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchWrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.md,
  },
  resultsCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    maxHeight: 240,
  },
  resultsList: {
    maxHeight: 240,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
  },
  resultDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resultInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  resultName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  resultMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  resultPrice: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  cartTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  heldLink: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  cartList: {
    flex: 1,
  },
  cartContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cartInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  cartName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  cartMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  discInput: {
    marginTop: spacing.sm,
    backgroundColor: colors.slate[100],
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.caption,
    color: colors.text,
    width: 140,
  },
  qtyCol: {
    alignItems: 'flex-end',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.slate[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: {
    fontSize: 18,
    color: colors.text,
    fontWeight: '600',
  },
  qtyText: {
    minWidth: 32,
    textAlign: 'center',
    ...typography.bodyBold,
    color: colors.text,
  },
  removeBtn: {
    marginTop: spacing.sm,
    padding: spacing.xs,
  },
  removeText: {
    ...typography.caption,
    color: colors.danger[600],
    fontWeight: '600',
  },
  footer: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  totalLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  totalValue: {
    ...typography.bodyBold,
    color: colors.text,
  },
  grandRow: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  grandLabel: {
    ...typography.title,
    color: colors.text,
  },
  grandValue: {
    ...typography.title,
    color: colors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  holdBtn: {
    flex: 1,
  },
  payBtn: {
    flex: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.huge,
  },
  modalTitle: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalSpinner: {
    marginTop: spacing.xxxl,
  },
  modalList: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  heldItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heldInfo: {
    flex: 1,
  },
  heldInvoice: {
    ...typography.bodyBold,
    color: colors.text,
  },
  heldMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  heldChevron: {
    fontSize: 24,
    color: colors.textMuted,
  },
  modalFooter: {
    padding: spacing.xl,
  },
});
