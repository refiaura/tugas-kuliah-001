/**
 * PO form screen: pick a supplier, add product lines (qty + unit price),
 * and create the PO in DRAFT status.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../app/navigation';
import {
  createPurchaseOrder,
  formatMoney,
  listSuppliers,
  Supplier,
} from '../../services/purchaseApi';
import {
  listProducts,
  ProductResponse,
} from '../../services/productApi';

type Props = NativeStackScreenProps<AppStackParamList, 'PurchaseOrderForm'>;

interface LineDraft {
  productId: number;
  productName: string;
  qtyText: string;
  priceText: string;
}

function parsePositive(text: string): number | null {
  const cleaned = text.replace(',', '.').replace(/[^0-9.]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function PurchaseOrderFormScreen({ navigation }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);

  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [lines, setLines] = useState<LineDraft[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setSuppliers(await listSuppliers());
      } catch (e) {
        Alert.alert(
          'Gagal',
          e instanceof Error ? e.message : 'Gagal memuat supplier.',
        );
      }
    })();
  }, []);

  const selectedSupplier = useMemo(
    () => suppliers.find(s => s.id === supplierId) ?? null,
    [suppliers, supplierId],
  );

  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        s.supplierCode.toLowerCase().includes(q),
    );
  }, [suppliers, supplierSearch]);

  const searchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await listProducts({
        search: productSearch.trim() || undefined,
        size: 20,
      });
      setProducts(res.items);
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal mencari produk.',
      );
    } finally {
      setLoadingProducts(false);
    }
  };

  const addLine = (p: ProductResponse) => {
    if (lines.some(l => l.productId === p.id)) {
      Alert.alert('Sudah ada', 'Produk sudah ada di daftar baris.');
      return;
    }
    setLines(prev => [
      ...prev,
      {
        productId: p.id,
        productName: p.name,
        qtyText: '',
        priceText: String(p.purchasePrice ?? ''),
      },
    ]);
    setProductPickerOpen(false);
    setProductSearch('');
  };

  const parsedLines = useMemo(
    () =>
      lines
        .map(l => ({
          ...l,
          qty: parsePositive(l.qtyText),
          price: parsePositive(l.priceText),
        }))
        .filter(l => l.qty !== null && l.price !== null) as (LineDraft & {
        qty: number;
        price: number;
      })[],
    [lines],
  );

  const total = parsedLines.reduce((s, l) => s + l.qty * l.price, 0);

  const doCreate = async () => {
    if (supplierId === null) {
      Alert.alert('Supplier belum dipilih', 'Pilih supplier terlebih dahulu.');
      return;
    }
    if (parsedLines.length === 0) {
      Alert.alert(
        'Baris belum valid',
        'Tambah minimal satu produk dengan qty dan harga yang valid.',
      );
      return;
    }
    setSubmitting(true);
    try {
      const po = await createPurchaseOrder({
        supplierId,
        notes: notes.trim() || undefined,
        lines: parsedLines.map(l => ({
          productId: l.productId,
          qty: l.qty,
          unitPrice: l.price,
        })),
      });
      Alert.alert('Berhasil', `PO ${po.docNo} dibuat (Draft).`);
      navigation.replace('PurchaseOrderDetail', { poId: po.id });
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal membuat PO.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const updateLine = (
    productId: number,
    field: 'qtyText' | 'priceText',
    value: string,
  ) => {
    setLines(prev =>
      prev.map(l => (l.productId === productId ? { ...l, [field]: value } : l)),
    );
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* supplier */}
      <Text style={styles.sectionTitle}>Supplier</Text>
      <Pressable
        style={styles.selector}
        onPress={() => setSupplierPickerOpen(v => !v)}>
        <Text style={selectedSupplier ? styles.selectorText : styles.muted}>
          {selectedSupplier
            ? `${selectedSupplier.name} (${selectedSupplier.supplierCode})`
            : 'Pilih supplier…'}
        </Text>
        <Text style={styles.chevron}>{supplierPickerOpen ? '▴' : '▾'}</Text>
      </Pressable>
      {supplierPickerOpen && (
        <View style={styles.pickerBox}>
          <TextInput
            style={styles.searchInput}
            value={supplierSearch}
            onChangeText={setSupplierSearch}
            placeholder="Cari supplier…"
          />
          {filteredSuppliers.slice(0, 15).map(s => (
            <Pressable
              key={s.id}
              style={styles.pickerItem}
              onPress={() => {
                setSupplierId(s.id);
                setSupplierPickerOpen(false);
              }}>
              <Text style={styles.pickerItemText}>
                {s.name}{' '}
                <Text style={styles.muted}>({s.supplierCode})</Text>
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* lines */}
      <Text style={styles.sectionTitle}>Baris Produk</Text>
      {lines.map(l => (
        <View key={l.productId} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.name} numberOfLines={1}>
              {l.productName}
            </Text>
            <Pressable
              onPress={() =>
                setLines(prev =>
                  prev.filter(x => x.productId !== l.productId),
                )
              }
              hitSlop={8}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.cardRow}>
            <TextInput
              style={styles.numInput}
              value={l.qtyText}
              onChangeText={t => updateLine(l.productId, 'qtyText', t)}
              keyboardType="decimal-pad"
              placeholder="Qty"
            />
            <TextInput
              style={styles.numInput}
              value={l.priceText}
              onChangeText={t => updateLine(l.productId, 'priceText', t)}
              keyboardType="decimal-pad"
              placeholder="Harga beli"
            />
          </View>
        </View>
      ))}
      <Pressable
        style={styles.secondaryBtn}
        onPress={() => {
          setProductPickerOpen(true);
          void searchProducts();
        }}>
        <Text style={styles.secondaryBtnText}>+ Tambah Produk</Text>
      </Pressable>

      {productPickerOpen && (
        <View style={styles.pickerBox}>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.searchInput, styles.searchFlex]}
              value={productSearch}
              onChangeText={setProductSearch}
              placeholder="Cari produk…"
              onSubmitEditing={() => void searchProducts()}
            />
            <Pressable style={styles.searchBtn} onPress={() => void searchProducts()}>
              <Text style={styles.searchBtnText}>Cari</Text>
            </Pressable>
          </View>
          {loadingProducts && <ActivityIndicator style={styles.loader} />}
          {products.map(p => (
            <Pressable
              key={p.id}
              style={styles.pickerItem}
              onPress={() => addLine(p)}>
              <Text style={styles.pickerItemText}>
                {p.name} <Text style={styles.muted}>({p.sku})</Text>
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={styles.ghostBtn}
            onPress={() => setProductPickerOpen(false)}>
            <Text style={styles.ghostBtnText}>Tutup</Text>
          </Pressable>
        </View>
      )}

      {/* notes */}
      <Text style={styles.sectionTitle}>Catatan (opsional)</Text>
      <TextInput
        style={[styles.searchInput, styles.notesInput]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Catatan PO…"
        multiline
      />

      <Text style={styles.total}>Total: Rp{formatMoney(total)}</Text>

      <Pressable
        style={[styles.primaryBtn, submitting && styles.btnDisabled]}
        onPress={() => void doCreate()}
        disabled={submitting}>
        <Text style={styles.primaryBtnText}>
          {submitting ? 'Menyimpan…' : 'Buat PO (Draft)'}
        </Text>
      </Pressable>
      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  selector: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorText: {
    fontSize: 15,
  },
  chevron: {
    fontSize: 16,
    color: '#888',
  },
  muted: {
    color: '#999',
  },
  pickerBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginTop: 8,
    padding: 8,
    maxHeight: 260,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchFlex: {
    flex: 1,
  },
  searchBtn: {
    backgroundColor: '#2e7d32',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  searchBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  loader: {
    marginVertical: 12,
  },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerItemText: {
    fontSize: 14,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
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
  name: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  remove: {
    color: '#c62828',
    fontSize: 16,
    padding: 4,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 8,
  },
  numInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    textAlign: 'right',
  },
  secondaryBtn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2e7d32',
    marginTop: 4,
  },
  secondaryBtnText: {
    color: '#2e7d32',
    fontWeight: '600',
  },
  ghostBtn: {
    marginTop: 8,
    alignItems: 'center',
    padding: 6,
  },
  ghostBtnText: {
    color: '#2e7d32',
    fontWeight: '600',
  },
  notesInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  total: {
    fontSize: 16,
    fontWeight: '700',
    marginVertical: 12,
  },
  primaryBtn: {
    backgroundColor: '#2e7d32',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  spacer: {
    height: 40,
  },
});
