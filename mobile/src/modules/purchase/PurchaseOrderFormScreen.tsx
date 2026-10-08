/**
 * PO form — modern minimalist.
 * Supplier & lines in Card sections, Input components, single accent.
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
import { Button, Card, Input, ScreenHeader } from '../../components';
import { colors, radius, spacing, typography } from '../../theme';

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

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
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
    <View style={styles.container}>
      <ScreenHeader title="PO Baru" subtitle="Dibuat sebagai Draft" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {/* Supplier */}
        <SectionTitle>Supplier</SectionTitle>
        <Card>
          <Pressable
            style={styles.selector}
            onPress={() => setSupplierPickerOpen(v => !v)}>
            <Text
              style={
                selectedSupplier ? styles.selectorText : styles.selectorMuted
              }>
              {selectedSupplier
                ? `${selectedSupplier.name} (${selectedSupplier.supplierCode})`
                : 'Pilih supplier…'}
            </Text>
            <Text style={styles.chevron}>{supplierPickerOpen ? '▴' : '▾'}</Text>
          </Pressable>
          {supplierPickerOpen && (
            <View style={styles.pickerBox}>
              <Input
                placeholder="Cari supplier…"
                value={supplierSearch}
                onChangeText={setSupplierSearch}
                containerStyle={styles.pickerSearch}
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
        </Card>

        {/* Lines */}
        <SectionTitle>Baris Produk</SectionTitle>
        {lines.map(l => (
          <Card key={l.productId} style={styles.lineCard}>
            <View style={styles.lineHeader}>
              <Text style={styles.lineName} numberOfLines={1}>
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
            <View style={styles.lineRow}>
              <Input
                label="Qty"
                value={l.qtyText}
                onChangeText={t => updateLine(l.productId, 'qtyText', t)}
                keyboardType="decimal-pad"
                placeholder="0"
                containerStyle={styles.lineInput}
              />
              <Input
                label="Harga beli"
                value={l.priceText}
                onChangeText={t => updateLine(l.productId, 'priceText', t)}
                keyboardType="decimal-pad"
                placeholder="0"
                containerStyle={styles.lineInput}
              />
            </View>
          </Card>
        ))}

        <Button
          title="+ Tambah Produk"
          variant="secondary"
          onPress={() => {
            setProductPickerOpen(true);
            void searchProducts();
          }}
          style={styles.addProduct}
        />

        {productPickerOpen && (
          <Card style={styles.pickerCard}>
            <View style={styles.searchRow}>
              <Input
                placeholder="Cari produk…"
                value={productSearch}
                onChangeText={setProductSearch}
                onSubmitEditing={() => void searchProducts()}
                containerStyle={styles.searchFlex}
              />
              <Button
                title="Cari"
                onPress={() => void searchProducts()}
              />
            </View>
            {loadingProducts && (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={styles.loader}
              />
            )}
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
            <Button
              title="Tutup"
              variant="ghost"
              onPress={() => setProductPickerOpen(false)}
            />
          </Card>
        )}

        {/* Notes */}
        <SectionTitle>Catatan (opsional)</SectionTitle>
        <Card>
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="Catatan PO…"
            multiline
            containerStyle={styles.noMargin}
          />
        </Card>

        <Card style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>Rp{formatMoney(total)}</Text>
        </Card>

        <Button
          title={submitting ? 'Menyimpan…' : 'Buat PO (Draft)'}
          onPress={() => void doCreate()}
          loading={submitting}
          size="lg"
          style={styles.submit}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  selector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  selectorText: {
    ...typography.body,
    color: colors.text,
  },
  selectorMuted: {
    ...typography.body,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 16,
    color: colors.textMuted,
  },
  muted: {
    color: colors.textMuted,
  },
  pickerBox: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    maxHeight: 280,
  },
  pickerSearch: {
    marginBottom: spacing.sm,
  },
  pickerItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemText: {
    ...typography.body,
    color: colors.text,
  },
  lineCard: {
    marginBottom: spacing.md,
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  lineName: {
    ...typography.bodyBold,
    color: colors.text,
    flex: 1,
  },
  remove: {
    ...typography.body,
    color: colors.danger[600],
    padding: spacing.sm,
  },
  lineRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  lineInput: {
    flex: 1,
    marginBottom: 0,
  },
  addProduct: {
    marginTop: spacing.sm,
  },
  pickerCard: {
    marginTop: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  searchFlex: {
    flex: 1,
    marginBottom: 0,
  },
  loader: {
    marginVertical: spacing.md,
  },
  noMargin: {
    marginBottom: 0,
  },
  totalCard: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  totalValue: {
    ...typography.title,
    color: colors.text,
  },
  submit: {
    marginTop: spacing.lg,
  },
});
