/**
 * Stock transfer screen.
 *
 * - Pick a product (searchable list).
 * - Enter from/to locations (must differ) and qty (> 0).
 * - The backend posts the transfer atomically as a TRANSFER_OUT +
 *   TRANSFER_IN pair.
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
  submitTransfer,
} from '../../services/stockApi';
import { listProducts, ProductResponse } from '../../services/productApi';

function parseQty(text: string): number | null {
  const cleaned = text.replace(',', '.').replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function StockTransferScreen() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ProductResponse[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ProductResponse | null>(null);
  const [qtyText, setQtyText] = useState('');
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [notes, setNotes] = useState('');
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
      Alert.alert('Jumlah tidak valid', 'Masukkan jumlah lebih dari nol.');
      return;
    }
    if (!fromLocation.trim() || !toLocation.trim()) {
      Alert.alert('Lokasi wajib', 'Isi lokasi asal dan lokasi tujuan.');
      return;
    }
    if (fromLocation.trim().toLowerCase() === toLocation.trim().toLowerCase()) {
      Alert.alert(
        'Lokasi sama',
        'Lokasi asal dan tujuan tidak boleh sama.',
      );
      return;
    }
    setSaving(true);
    try {
      const doc = await submitTransfer({
        productId: selected.id,
        qty,
        fromLocation: fromLocation.trim(),
        toLocation: toLocation.trim(),
        notes: notes.trim() || undefined,
      });
      Alert.alert(
        'Transfer tersimpan',
        `${doc.docNo} — ${selected.name}: ${formatQty(
          qty,
        )} dari ${doc.fromLocation} ke ${doc.toLocation}`,
      );
      setSelected(null);
      setQtyText('');
      setFromLocation('');
      setToLocation('');
      setNotes('');
      setSearch('');
    } catch (e) {
      Alert.alert(
        'Gagal',
        e instanceof Error ? e.message : 'Gagal menyimpan transfer.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Stock Transfer</Text>
      <Text style={styles.muted}>
        Pindah stok antar lokasi (total stok produk tidak berubah).
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

      <View style={styles.locRow}>
        <View style={styles.locCol}>
          <Text style={styles.label}>Dari lokasi *</Text>
          <TextInput
            style={styles.input}
            value={fromLocation}
            onChangeText={setFromLocation}
            placeholder="cth. Gudang A"
          />
        </View>
        <View style={styles.locCol}>
          <Text style={styles.label}>Ke lokasi *</Text>
          <TextInput
            style={styles.input}
            value={toLocation}
            onChangeText={setToLocation}
            placeholder="cth. Toko B"
          />
        </View>
      </View>

      <Text style={styles.label}>Jumlah</Text>
      <TextInput
        style={styles.input}
        value={qtyText}
        onChangeText={setQtyText}
        keyboardType="decimal-pad"
        placeholder="cth. 10"
      />

      <Text style={styles.label}>Catatan</Text>
      <TextInput
        style={styles.input}
        value={notes}
        onChangeText={setNotes}
        placeholder="Opsional"
      />

      <Pressable
        style={[styles.primaryBtn, saving && styles.btnDisabled]}
        onPress={() => void doSubmit()}
        disabled={saving}>
        <Text style={styles.primaryBtnText}>
          {saving ? 'Menyimpan…' : 'Simpan Transfer'}
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
  locRow: {
    flexDirection: 'row',
    gap: 12,
  },
  locCol: {
    flex: 1,
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
