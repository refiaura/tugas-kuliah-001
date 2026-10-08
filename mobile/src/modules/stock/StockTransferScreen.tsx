/**
 * Stock transfer screen — modern minimalist.
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
  View,
} from 'react-native';
import {
  formatQty,
  submitTransfer,
} from '../../services/stockApi';
import { listProducts, ProductResponse } from '../../services/productApi';
import { Badge, Button, Card, Input, ScreenHeader } from '../../components';
import { colors, spacing, typography } from '../../theme';

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
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <ScreenHeader
        title="Stock Transfer"
        subtitle="Pindah stok antar lokasi — total stok produk tidak berubah."
      />

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Pilih Produk</Text>
        <Input
          label="Cari produk"
          value={search}
          onChangeText={text => {
            setSearch(text);
            setSelected(null);
          }}
          placeholder="Ketik nama / SKU…"
          editable={!saving}
        />
        {searching && <ActivityIndicator color={colors.primary} />}
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
                <Text style={styles.pickerSku}>{item.sku}</Text>
              </Pressable>
            )}
          />
        )}
        {selected && (
          <Badge
            label={`Terpilih: ${selected.name} (${selected.sku})`}
            tone="accent"
            style={styles.selectedBadge}
          />
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Lokasi</Text>
        <View style={styles.locRow}>
          <View style={styles.locCol}>
            <Input
              label="Dari *"
              value={fromLocation}
              onChangeText={setFromLocation}
              placeholder="cth. Gudang A"
              editable={!saving}
            />
          </View>
          <View style={styles.locCol}>
            <Input
              label="Ke *"
              value={toLocation}
              onChangeText={setToLocation}
              placeholder="cth. Toko B"
              editable={!saving}
            />
          </View>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Jumlah</Text>
        <Input
          label="Jumlah"
          value={qtyText}
          onChangeText={setQtyText}
          keyboardType="decimal-pad"
          placeholder="cth. 10"
          editable={!saving}
        />
        <Input
          label="Catatan"
          value={notes}
          onChangeText={setNotes}
          placeholder="Opsional"
          editable={!saving}
        />
      </Card>

      <Button
        title={saving ? 'Menyimpan…' : 'Simpan Transfer'}
        onPress={() => void doSubmit()}
        loading={saving}
        size="lg"
        style={styles.submit}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.huge,
  },
  card: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.md,
  },
  pickerList: {
    maxHeight: 220,
    marginBottom: spacing.sm,
  },
  pickerItem: {
    backgroundColor: colors.background,
    borderRadius: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerItemSelected: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  pickerName: {
    ...typography.bodyBold,
    color: colors.text,
  },
  pickerSku: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  selectedBadge: {
    marginTop: spacing.sm,
  },
  locRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  locCol: {
    flex: 1,
  },
  submit: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
});
