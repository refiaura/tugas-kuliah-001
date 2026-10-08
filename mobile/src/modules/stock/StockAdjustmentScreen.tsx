/**
 * Stock adjustment screen.
 *
 * - Pick a product (searchable list).
 * - Enter signed qty change (e.g. -2 for damaged/lost, +5 for correction).
 * - Reason is mandatory (backend rejects blank).
 */
import React, { useEffect, useState } from 'react';
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
import {
  formatQty,
  submitAdjustment,
} from '../../services/stockApi';
import { listProducts, ProductResponse } from '../../services/productApi';

function parseQty(text: string): number | null {
  const cleaned = text.replace(',', '.').replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

export default function StockAdjustmentScreen() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ProductResponse[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ProductResponse | null>(null);
  const [qtyText, setQtyText] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        if (search.trim().length < 2) {
          setResults([]);
          return;
        }
        setSearching(true);
        try {
          const r = await listProducts({
            search: search.trim(),
            activeOnly: true,
            size: 15,
          });
          setResults(r.items);
        } catch (e) {
          Alert.alert(
            'Gagal',
            e instanceof Error ? e.message : 'Gagal mencari produk.',
          );
        } finally {
          setSearching(false);
        }
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const doSubmit = async () => {
    if (!selected) {
      Alert.alert('Pilih produk', 'Cari dan pilih produk terlebih dahulu.');
      return;
    }
    const qty = parseQty(qtyText);
    if (qty === null) {
      Alert.alert(
        'Jumlah tidak valid',
        'Masukkan perubahan qty bukan nol (mis. -2 atau 5).',
      );
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Alasan wajib', 'Isi alasan adjustment.');
      return;
    }
    setSaving(true);
    try {
      const doc = await submitAdjustment({
        productId: selected.id,
        qtyChange: qty,
        reason: reason.trim(),
      });
      Alert.alert(
        'Adjustment tersimpan',
        `${doc.docNo} — ${selected.name}: ${
          qty > 0 ? '+' : ''
        }${formatQty(qty)}`,
      );
      setSelected(null);
      setQtyText('');
      setReason('');
      setSearch('');
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal menyimpan adjustment.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Stock Adjustment</Text>
      <Text style={styles.muted}>
        Koreksi stok manual. Alasan wajib diisi.
      </Text>

      <Text style={styles.label}>Cari produk</Text>
      <TextInput
        style={styles.input}
        value={search}
        onChangeText={text => {
          setSearch(text);
          setSelected(null);
        }}
        placeholder="Ketik nama / SKU…"
      />
      {searching && <ActivityIndicator style={{ marginTop: 8 }} />}
      {!searching && search.trim().length >= 2 && (
        <FlatList
          data={results}
          keyExtractor={item => String(item.id)}
          scrollEnabled={false}
          style={styles.pickerList}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.pickerItem,
                selected?.id === item.id && styles.pickerItemSelected,
              ]}
              onPress={() => setSelected(item)}>
              <Text style={styles.pickerName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.pickerSku}>SKU: {item.sku}</Text>
            </Pressable>
          )}
        />
      )}
      {selected && (
        <Text style={styles.selectedText}>
          Terpilih: {selected.name} ({selected.sku})
        </Text>
      )}

      <Text style={styles.label}>Perubahan qty (+/-)</Text>
      <TextInput
        style={styles.input}
        value={qtyText}
        onChangeText={setQtyText}
        keyboardType="decimal-pad"
        placeholder="cth. -2 atau 5"
      />

      <Text style={styles.label}>Alasan *</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={reason}
        onChangeText={setReason}
        placeholder="cth. Barang rusak, hilang, salah input"
        multiline
      />

      <Pressable
        style={[styles.primaryBtn, saving && styles.btnDisabled]}
        onPress={() => void doSubmit()}
        disabled={saving}>
        <Text style={styles.primaryBtnText}>
          {saving ? 'Menyimpan…' : 'Simpan Adjustment'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    flexGrow: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  muted: {
    color: '#666',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  pickerList: {
    maxHeight: 220,
    marginTop: 4,
  },
  pickerItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerItemSelected: {
    borderColor: '#2e7d32',
    borderWidth: 2,
  },
  pickerName: {
    fontSize: 14,
    fontWeight: '600',
  },
  pickerSku: {
    fontSize: 12,
    color: '#888',
  },
  selectedText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
  },
  primaryBtn: {
    backgroundColor: '#2e7d32',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
