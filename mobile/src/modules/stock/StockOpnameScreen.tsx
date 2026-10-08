/**
 * Stock opname screen — modern minimalist.
 *
 * - Loads current balances (stock.view) with a search box.
 * - The user inputs the physical count per product.
 * - On submit, only rows with a filled count are sent; the backend
 *   snapshots expected stock, posts the differences, and returns the doc.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  formatQty,
  listStockBalances,
  OpnameResponse,
  StockBalance,
  submitOpname,
} from '../../services/stockApi';
import { Badge, Button, Card, EmptyState, Input, ScreenHeader } from '../../components';
import { colors, spacing, typography } from '../../theme';

function parseQty(text: string): number | null {
  const cleaned = text.replace(',', '.').replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function StockOpnameScreen() {
  const [items, setItems] = useState<StockBalance[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [location, setLocation] = useState('');
  const [result, setResult] = useState<OpnameResponse | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listStockBalances());
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal memuat saldo stok.',
      );
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      i =>
        i.name.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q),
    );
  }, [items, search]);

  const filledLines = useMemo(
    () =>
      Object.entries(counts)
        .map(([pid, text]) => ({ productId: Number(pid), qty: parseQty(text) }))
        .filter(l => l.qty !== null) as {
        productId: number;
        qty: number;
      }[],
    [counts],
  );

  const doSubmit = async () => {
    if (filledLines.length === 0) {
      Alert.alert(
        'Belum ada hitungan',
        'Isi jumlah hitung fisik minimal untuk satu produk.',
      );
      return;
    }
    setSubmitting(true);
    try {
      const doc = await submitOpname({
        location: location.trim() || undefined,
        lines: filledLines.map(l => ({
          productId: l.productId,
          countedQty: l.qty,
        })),
      });
      setResult(doc);
      setCounts({});
      await load();
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal menyimpan opname.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.centerText}>Memuat saldo stok…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.productId)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <ScreenHeader
              title="Stock Opname"
              subtitle="Hitung fisik tiap produk, selisih tercatat otomatis."
              style={styles.header}
            />
            <View style={styles.searchBlock}>
              <Input
                label="Cari produk"
                value={search}
                onChangeText={setSearch}
                placeholder="Nama produk / SKU…"
              />
              <Input
                label="Lokasi"
                value={location}
                onChangeText={setLocation}
                placeholder="Opsional"
              />
            </View>
            {result && (
              <Card style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Badge label="Tersimpan" tone="accent" />
                  <Text style={styles.resultDoc}>{result.docNo}</Text>
                </View>
                <ScrollView style={styles.resultLines} nestedScrollEnabled>
                  {result.lines.map((l, idx) => (
                    <Text key={idx} style={styles.resultLine}>
                      {l.productName ?? `#${l.productId}`}: {formatQty(l.expectedQty)}
                      {' → '}
                      {formatQty(l.countedQty)} (
                      {l.differenceQty >= 0 ? '+' : ''}
                      {formatQty(l.differenceQty)})
                    </Text>
                  ))}
                </ScrollView>
                <Button
                  title="Tutup"
                  variant="ghost"
                  onPress={() => setResult(null)}
                  style={styles.resultClose}
                />
              </Card>
            )}
          </>
        }
        ListEmptyComponent={
          <EmptyState
            title="Tidak ada produk"
            message="Stok masih kosong atau kata kunci tidak cocok."
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.item} padding={spacing.lg}>
            <View style={styles.itemTop}>
              <View style={styles.itemHead}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.sku}>{item.sku}</Text>
              </View>
              {item.qty <= item.minimumStock && (
                <Badge label="Menipis" tone="warning" />
              )}
            </View>
            <View style={styles.itemRow}>
              <Text style={styles.stockLabel}>
                Stok sistem: {formatQty(item.qty)}
              </Text>
              <TextInput
                style={styles.countInput}
                value={counts[item.productId] ?? ''}
                onChangeText={text =>
                  setCounts(prev => ({ ...prev, [item.productId]: text }))
                }
                keyboardType="decimal-pad"
                placeholder="Hitung fisik"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </Card>
        )}
      />

      <View style={styles.footer}>
        <Button
          title={
            submitting
              ? 'Menyimpan…'
              : `Simpan Opname (${filledLines.length})`
          }
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
  centerText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  header: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 110,
  },
  searchBlock: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  resultCard: {
    marginBottom: spacing.md,
    borderColor: colors.primarySoft,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  resultDoc: {
    ...typography.bodyBold,
    color: colors.text,
  },
  resultLines: {
    maxHeight: 160,
  },
  resultLine: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  resultClose: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  item: {
    marginBottom: spacing.md,
  },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  itemHead: {
    flex: 1,
    marginRight: spacing.sm,
  },
  name: {
    ...typography.bodyBold,
    color: colors.text,
  },
  sku: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  countInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
    minWidth: 130,
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
