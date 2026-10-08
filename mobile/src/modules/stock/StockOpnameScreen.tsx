/**
 * Stock opname screen.
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
  Pressable,
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
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Memuat saldo stok…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Cari produk / SKU…"
        />
      </View>
      <View style={styles.locationRow}>
        <TextInput
          style={styles.searchInput}
          value={location}
          onChangeText={setLocation}
          placeholder="Lokasi (opsional)"
        />
      </View>

      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>
            Opname {result.docNo} tersimpan
          </Text>
          {result.lines.map((l, idx) => (
            <Text key={idx} style={styles.resultLine}>
              {l.productName ?? `#${l.productId}`}: {formatQty(l.expectedQty)}
              {' → '}
              {formatQty(l.countedQty)} (
              {l.differenceQty >= 0 ? '+' : ''}
              {formatQty(l.differenceQty)})
            </Text>
          ))}
          <Pressable
            style={styles.ghostBtn}
            onPress={() => setResult(null)}>
            <Text style={styles.ghostBtnText}>Tutup</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.productId)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.sku}>SKU: {item.sku}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.stockLabel}>
                Stok sistem: {formatQty(item.qty)}
                {item.qty <= item.minimumStock ? ' ⚠️' : ''}
              </Text>
              <TextInput
                style={styles.countInput}
                value={counts[item.productId] ?? ''}
                onChangeText={text =>
                  setCounts(prev => ({ ...prev, [item.productId]: text }))
                }
                keyboardType="decimal-pad"
                placeholder="Hitung fisik"
              />
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryBtn, submitting && styles.btnDisabled]}
          onPress={() => void doSubmit()}
          disabled={submitting}>
          <Text style={styles.primaryBtnText}>
            {submitting
              ? 'Menyimpan…'
              : `Simpan Opname (${filledLines.length})`}
          </Text>
        </Pressable>
      </View>
    </View>
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
    padding: 24,
  },
  muted: {
    color: '#666',
    marginTop: 8,
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  locationRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  list: {
    padding: 16,
    paddingBottom: 90,
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
    marginBottom: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  sku: {
    fontSize: 12,
    color: '#888',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 13,
    color: '#555',
  },
  countInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    minWidth: 130,
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  primaryBtn: {
    backgroundColor: '#2e7d32',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  resultCard: {
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 14,
    margin: 16,
    marginBottom: 0,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  resultLine: {
    fontSize: 13,
    color: '#333',
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
});
