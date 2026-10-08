/**
 * Product form — modern minimalist.
 * Fields grouped in cards, shared Input components, sticky save button.
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
import { Button, Card, Input, ScreenHeader } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

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

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        title={isEdit ? 'Edit Produk' : 'Tambah Produk'}
        subtitle={
          isEdit ? 'Perbarui detail produk' : 'Lengkapi detail produk baru'
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {/* Basic info */}
        <SectionLabel>Informasi produk</SectionLabel>
        <Card style={styles.card}>
          <Input
            label="SKU *"
            value={sku}
            onChangeText={setSku}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isEdit && !saving}
            testID="product-sku"
            containerStyle={styles.lastInput}
          />
          <Input
            label="Barcode"
            value={barcode}
            onChangeText={setBarcode}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
            testID="product-barcode"
            containerStyle={styles.lastInput}
          />
          <Input
            label="Nama produk *"
            value={name}
            onChangeText={setName}
            editable={!saving}
            testID="product-name"
            containerStyle={styles.lastInput}
          />
        </Card>

        {/* Category & unit */}
        <SectionLabel>Kategori & satuan</SectionLabel>
        <Card style={styles.card}>
          <Text style={styles.pickerLabel}>Kategori</Text>
          <Pressable
            style={styles.picker}
            onPress={() => setShowCategoryPicker(v => !v)}
            disabled={saving}
            testID="product-category">
            <Text
              style={
                selectedCategory
                  ? styles.pickerText
                  : styles.pickerPlaceholder
              }>
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
                  style={[
                    styles.option,
                    c.id === categoryId && styles.optionSelected,
                  ]}
                  onPress={() => {
                    setCategoryId(c.id);
                    setShowCategoryPicker(false);
                  }}>
                  <Text
                    style={[
                      styles.optionText,
                      c.id === categoryId && styles.optionTextSelected,
                    ]}>
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={[styles.pickerLabel, styles.pickerLabelSpaced]}>
            Satuan
          </Text>
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
                  style={[
                    styles.option,
                    u.id === unitId && styles.optionSelected,
                  ]}
                  onPress={() => {
                    setUnitId(u.id);
                    setShowUnitPicker(false);
                  }}>
                  <Text
                    style={[
                      styles.optionText,
                      u.id === unitId && styles.optionTextSelected,
                    ]}>
                    {u.code}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Card>

        {/* Pricing */}
        <SectionLabel>Harga</SectionLabel>
        <Card style={styles.card}>
          <Input
            label="Harga beli (Rp) *"
            value={purchasePrice}
            onChangeText={setPurchasePrice}
            keyboardType="numeric"
            editable={!saving}
            testID="product-purchase-price"
            containerStyle={styles.lastInput}
          />
          <Input
            label="Harga jual (Rp) *"
            value={sellingPrice}
            onChangeText={setSellingPrice}
            keyboardType="numeric"
            editable={!saving}
            testID="product-selling-price"
            containerStyle={styles.lastInput}
          />
        </Card>

        {/* Stock & status */}
        <SectionLabel>Stok & status</SectionLabel>
        <Card style={styles.card}>
          <Input
            label="Stok minimum"
            value={minimumStock}
            onChangeText={setMinimumStock}
            keyboardType="numeric"
            editable={!saving}
            hint="Peringatan stok menipis muncul di bawah angka ini."
            testID="product-min-stock"
            containerStyle={styles.lastInput}
          />
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>Produk aktif</Text>
              <Text style={styles.switchHint}>
                Produk nonaktif tidak muncul di kasir.
              </Text>
            </View>
            <Switch
              value={active}
              onValueChange={setActive}
              disabled={saving}
              trackColor={{ true: colors.primary, false: colors.slate[200] }}
            />
          </View>
        </Card>

        {formError ? <Text style={styles.error}>{formError}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={isEdit ? 'Simpan perubahan' : 'Tambah produk'}
          size="lg"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          testID="product-save"
        />
      </View>
    </KeyboardAvoidingView>
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
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    marginBottom: spacing.sm,
  },
  lastInput: {
    marginBottom: 0,
  },
  pickerLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  pickerLabelSpaced: {
    marginTop: spacing.md,
  },
  picker: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 52,
  },
  pickerText: {
    ...typography.body,
    color: colors.text,
  },
  pickerPlaceholder: {
    ...typography.body,
    color: colors.textMuted,
  },
  pickerChevron: {
    fontSize: 16,
    color: colors.textMuted,
  },
  options: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  option: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionSelected: {
    backgroundColor: colors.primarySoft,
  },
  optionText: {
    ...typography.body,
    color: colors.text,
  },
  optionTextSelected: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  switchLabel: {
    ...typography.bodyBold,
    color: colors.text,
  },
  switchHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  error: {
    ...typography.body,
    color: colors.danger[600],
    marginTop: spacing.md,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
