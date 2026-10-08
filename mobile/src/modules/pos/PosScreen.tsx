/**
 * POS screen: search products, build cart, hold or go to payment.
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
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama / SKU / barcode…"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {searching && <ActivityIndicator style={styles.searchSpinner} />}
      </View>

      {search.trim().length > 0 && (
        <View style={styles.resultsBox}>
          <FlatList
            data={results}
            keyExtractor={p => String(p.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: p }) => (
              <Pressable
                style={styles.resultItem}
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
                  <Text style={styles.resultName}>{p.name}</Text>
                  <Text style={styles.resultMeta}>{p.sku}</Text>
                </View>
                <Text style={styles.resultPrice}>
                  {formatRupiah(p.sellingPrice)}
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={
              !searching ? (
                <Text style={styles.emptyText}>Tidak ada produk ditemukan.</Text>
              ) : undefined
            }
          />
        </View>
      )}

      <View style={styles.cartHeader}>
        <Text style={styles.cartTitle}>Keranjang</Text>
        <Pressable onPress={() => void openHeld()} hitSlop={8}>
          <Text style={styles.heldLink}>Transaksi tertahan</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={i => String(i.productId)}
        style={styles.cartList}
        renderItem={({ item }) => (
          <View style={styles.cartItem}>
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
              <Pressable
                style={styles.removeBtn}
                onPress={() => removeItem(item.productId)}>
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Keranjang kosong. Cari produk di atas untuk menambah.
          </Text>
        }
      />

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
        <View style={styles.totalRow}>
          <Text style={styles.grandLabel}>Total</Text>
          <Text style={styles.grandValue}>{formatRupiah(grandTotal)}</Text>
        </View>
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionBtn, styles.holdBtn]}
            onPress={onHold}
            disabled={holding || items.length === 0}>
            <Text style={styles.holdBtnText}>
              {holding ? 'Menahan…' : 'Tahan'}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.actionBtn,
              styles.payBtn,
              items.length === 0 && styles.payBtnDisabled,
            ]}
            onPress={goToPayment}
            disabled={items.length === 0}>
            <Text style={styles.payBtnText}>Bayar</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={heldModalVisible}
        animationType="slide"
        onRequestClose={() => setHeldModalVisible(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Transaksi Tertahan</Text>
          {loadingHeld ? (
            <ActivityIndicator style={styles.modalSpinner} />
          ) : (
            <FlatList
              data={heldSales}
              keyExtractor={s => String(s.id)}
              renderItem={({ item: s }) => (
                <Pressable
                  style={styles.heldItem}
                  onPress={() => onResumeHeld(s)}>
                  <View>
                    <Text style={styles.heldInvoice}>{s.invoiceNo}</Text>
                    <Text style={styles.heldMeta}>
                      {s.items.length} item · {formatRupiah(s.grandTotal)}
                    </Text>
                  </View>
                  <Text style={styles.heldChevron}>›</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  Tidak ada transaksi tertahan.
                </Text>
              }
            />
          )}
          <Pressable
            style={styles.modalClose}
            onPress={() => setHeldModalVisible(false)}>
            <Text style={styles.modalCloseText}>Tutup</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 4,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  searchSpinner: { marginLeft: 8 },
  resultsBox: {
    maxHeight: 220,
    marginHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    elevation: 2,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  resultInfo: { flex: 1, marginRight: 8 },
  resultName: { fontSize: 15, fontWeight: '600' },
  resultMeta: { fontSize: 12, color: '#888' },
  resultPrice: { fontSize: 14, fontWeight: '700', color: '#2e7d32' },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  cartTitle: { fontSize: 16, fontWeight: '700' },
  heldLink: { color: '#1565c0', fontSize: 14, fontWeight: '600' },
  cartList: { flex: 1, paddingHorizontal: 12 },
  cartItem: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartInfo: { flex: 1, marginRight: 8 },
  cartName: { fontSize: 15, fontWeight: '600' },
  cartMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  discInput: {
    marginTop: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    width: 130,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: { fontSize: 18, color: '#1565c0', fontWeight: '700' },
  qtyText: { minWidth: 28, textAlign: 'center', fontSize: 15, fontWeight: '600' },
  removeBtn: { marginLeft: 8, padding: 4 },
  removeText: { color: '#c62828', fontSize: 16 },
  emptyText: { color: '#888', textAlign: 'center', padding: 24 },
  footer: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  totalLabel: { fontSize: 14, color: '#666' },
  totalValue: { fontSize: 14, fontWeight: '600' },
  grandLabel: { fontSize: 16, fontWeight: '700' },
  grandValue: { fontSize: 18, fontWeight: '800', color: '#2e7d32' },
  actionRow: { flexDirection: 'row', marginTop: 12, gap: 12 },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  holdBtn: { backgroundColor: '#fff3e0', borderWidth: 1, borderColor: '#ffb74d' },
  holdBtnText: { color: '#e65100', fontWeight: '700', fontSize: 16 },
  payBtn: { backgroundColor: '#2e7d32' },
  payBtnDisabled: { backgroundColor: '#a5d6a7' },
  payBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  modalContainer: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 48 },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalSpinner: { marginTop: 32 },
  heldItem: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heldInvoice: { fontSize: 15, fontWeight: '700' },
  heldMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  heldChevron: { fontSize: 22, color: '#999' },
  modalClose: {
    margin: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCloseText: { fontWeight: '700', fontSize: 16 },
});
