/**
 * Product form: create new or edit existing.
 *
 * - Create: POST /products (needs product.create).
 * - Edit: PUT /products/{id} for basic fields (needs product.update);
 *   price changes go to PUT /products/{id}/price (needs product.price.update).
 *
 * Validation: SKU & name required, prices >= 0.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '../../stores/authStore';
import {
  CategoryResponse,
  createProduct,
  getProduct,
  listCategories,
  updateProduct,
  updateProductPrice,
} from '../../services/productApi';
import { AppStackParamList } from '../../app/navigation';

type Props = NativeStackScreenProps<AppStackParamList, 'ProductForm'>;

/** Static units matching backend V3 seed order (PCS=1 … PACK=5). */
const UNITS = [
  { id: 1, code: 'PCS' },
  { id: 2, code: 'BOX' },
  { id: 3, code: 'KG' },
  { id: 4, code: 'LITER' },
  { id: 5, code: 'PACK' },
];

function parsePrice(text: string): number | null {
  const n = Number(text.replace(/[^\d.-]/g, ''));
  return text.trim() === '' || Number.isNaN(n) ? null : n;
}

export default function ProductFormScreen({ navigation, route }: Props) {
  const productId = route.params.productId;
  const isEdit = productId !== undefined;
  const hasPermission = useAuthStore(s => s.hasPermission);
  const canUpdatePrice = hasPermission('product.price.update');

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [unitId, setUnitId] = useState<number>(1);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [minimumStock, setMinimumStock] = useState('');
  const [active, setActive] = useState(true);

  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  // Original prices (edit mode) — to detect price changes.
  const [origPurchasePrice, setOrigPurchasePrice] = useState<number | null>(
    null,
  );
  const [origSellingPrice, setOrigSellingPrice] = useState<number | null>(
    null,
  );

  useEffect(() => {
    void (async () => {
      try {
        const cats = await listCategories();
        setCategories(cats.filter(c => c.active));
      } catch (e) {
        setFormError(
          e instanceof Error ? e.message : 'Gagal memuat kategori.',
        );
      }
      if (isEdit && productId !== undefined) {
        try {
          const p = await getProduct(productId);
          setSku(p.sku);
          setBarcode(p.barcode ?? '');
          setName(p.name);
          setCategoryId(p.categoryId);
          setUnitId(p.unitId ?? 1);
          setPurchasePrice(String(p.purchasePrice));
          setSellingPrice(String(p.sellingPrice));
          setMinimumStock(String(p.minimumStock));
          setActive(p.active);
          setOrigPurchasePrice(p.purchasePrice);
          setOrigSellingPrice(p.sellingPrice);
        } catch (e) {
          setFormError(
            e instanceof Error ? e.message : 'Gagal memuat produk.',
          );
        }
      }
      setLoading(false);
    })();
  }, [isEdit, productId]);

  const selectedCategory = categories.find(c => c.id === categoryId) ?? null;
  const selectedUnit =
    UNITS.find(u => u.id === unitId) ?? { id: unitId, code: 'PCS' };

  const handleSave = async () => {
    if (saving) {
      return;
    }
    // ---- validation ----
    if (!sku.trim()) {
      setFormError('SKU wajib diisi.');
      return;
    }
    if (!name.trim()) {
      setFormError('Nama produk wajib diisi.');
      return;
    }
    const buy = parsePrice(purchasePrice);
    const sell = parsePrice(sellingPrice);
    if (buy === null || buy < 0) {
      setFormError('Harga beli harus angka >= 0.');
      return;
    }
    if (sell === null || sell < 0) {
      setFormError('Harga jual harus angka >= 0.');
      return;
    }
    const minStock = minimumStock.trim() === '' ? 0 : parsePrice(minimumStock);
    if (minStock === null || minStock < 0) {
      setFormError('Stok minimum harus angka >= 0.');
      return;
    }

    setFormError(null);
    setSaving(true);
    try {
      if (!isEdit) {
        await createProduct({
          sku: sku.trim(),
          barcode: barcode.trim() || undefined,
          name: name.trim(),
          categoryId: categoryId ?? undefined,
          unitId,
          purchasePrice: buy,
          sellingPrice: sell,
          minimumStock: minStock,
          active,
        });
      } else if (productId !== undefined) {
        await updateProduct(productId, {
          barcode: barcode.trim() || undefined,
          name: name.trim(),
          categoryId: categoryId ?? undefined,
          unitId,
          minimumStock: minStock,
          active,
        });
        // Price changes use the dedicated endpoint.
        const priceChanged =
          buy !== origPurchasePrice || sell !== origSellingPrice;
        if (priceChanged) {
          if (!canUpdatePrice) {
            Alert.alert(
              'Izin kurang',
              'Harga berubah tetapi Anda tidak memiliki izin product.price.update. Perubahan lain tersimpan.',
            );
          } else {
            await updateProductPrice(productId, {
              sellingPrice: sell,
              purchasePrice: buy,
              reason: 'Update via aplikasi mobile',
            });
          }
        }
      }
      navigation.goBack();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Gagal menyimpan produk.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>SKU *</Text>
        <TextInput
          style={[styles.input, isEdit && styles.inputDisabled]}
          value={sku}
          onChangeText={setSku}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!isEdit && !saving}
          testID="product-sku"
        />

        <Text style={styles.label}>Barcode</Text>
        <TextInput
          style={styles.input}
          value={barcode}
          onChangeText={setBarcode}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!saving}
          testID="product-barcode"
        />

        <Text style={styles.label}>Nama produk *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          editable={!saving}
          testID="product-name"
        />

        <Text style={styles.label}>Kategori</Text>
        <Pressable
          style={styles.picker}
          onPress={() => setShowCategoryPicker(v => !v)}
          disabled={saving}
          testID="product-category">
          <Text style={selectedCategory ? styles.pickerText : styles.pickerPlaceholder}>
            {selectedCategory ? selectedCategory.name : 'Pilih kategori…'}
          </Text>
          <Text style={styles.pickerChevron}>▾</Text>
        </Pressable>
        {showCategoryPicker ? (
          <View style={styles.options}>
            <Pressable
              style={styles.option}
              onPress={() => {
                setCategoryId(null);
                setShowCategoryPicker(false);
              }}>
              <Text style={styles.optionText}>— Tanpa kategori —</Text>
            </Pressable>
            {categories.map(c => (
              <Pressable
                key={c.id}
                style={styles.option}
                onPress={() => {
                  setCategoryId(c.id);
                  setShowCategoryPicker(false);
                }}>
                <Text style={styles.optionText}>{c.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text style={styles.label}>Satuan</Text>
        <Pressable
          style={styles.picker}
          onPress={() => setShowUnitPicker(v => !v)}
          disabled={saving}
          testID="product-unit">
          <Text style={styles.pickerText}>{selectedUnit.code}</Text>
          <Text style={styles.pickerChevron}>▾</Text>
        </Pressable>
        {showUnitPicker ? (
          <View style={styles.options}>
            {UNITS.map(u => (
              <Pressable
                key={u.id}
                style={styles.option}
                onPress={() => {
                  setUnitId(u.id);
                  setShowUnitPicker(false);
                }}>
                <Text style={styles.optionText}>{u.code}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text style={styles.label}>Harga beli *</Text>
        <TextInput
          style={styles.input}
          value={purchasePrice}
          onChangeText={setPurchasePrice}
          keyboardType="numeric"
          editable={!saving}
          testID="product-purchase-price"
        />

        <Text style={styles.label}>Harga jual *</Text>
        <TextInput
          style={styles.input}
          value={sellingPrice}
          onChangeText={setSellingPrice}
          keyboardType="numeric"
          editable={!saving}
          testID="product-selling-price"
        />

        <Text style={styles.label}>Stok minimum</Text>
        <TextInput
          style={styles.input}
          value={minimumStock}
          onChangeText={setMinimumStock}
          keyboardType="numeric"
          editable={!saving}
          testID="product-min-stock"
        />

        <View style={styles.switchRow}>
          <Text style={styles.label}>Aktif</Text>
          <Switch value={active} onValueChange={setActive} disabled={saving} />
        </View>

        {formError ? <Text style={styles.error}>{formError}</Text> : null}

        <Pressable
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
          testID="product-save">
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {isEdit ? 'Simpan perubahan' : 'Tambah produk'}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputDisabled: {
    backgroundColor: '#eee',
    color: '#888',
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 16,
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  pickerChevron: {
    fontSize: 16,
    color: '#999',
  },
  options: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginTop: 4,
    maxHeight: 200,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionText: {
    fontSize: 15,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  error: {
    color: '#c62828',
    marginTop: 12,
    fontSize: 14,
  },
  button: {
    backgroundColor: '#1565c0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
