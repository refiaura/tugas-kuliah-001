/**
 * Stock adjustment screen — modern minimalist.
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
  View,
} from 'react-native';
import {
  formatQty,
  submitAdjustment,
} from '../../services/stockApi';
import { listProducts, ProductResponse } from '../../services/productApi';
import { Badge, Button, Card, Input, ScreenHeader } from '../../components';
import { colors, spacing, typography } from '../../theme';

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
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <ScreenHeader
        title="Stock Adjustment"
        subtitle="Koreksi stok manual. Alasan wajib diisi."
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
        <Text style={styles.sectionTitle}>Perubahan</Text>
        <Input
          label="Perubahan qty (+/-)"
          value={qtyText}
          onChangeText={setQtyText}
          keyboardType="decimal-pad"
          placeholder="cth. -2 atau 5"
          editable={!saving}
        />
        <Input
          label="Alasan *"
          value={reason}
          onChangeText={setReason}
          placeholder="cth. Barang rusak, hilang, salah input"
          multiline
          editable={!saving}
          style={styles.reasonInput}
        />
      </Card>

      <Button
        title={saving ? 'Menyimpan…' : 'Simpan Adjustment'}
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
  reasonInput: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  submit: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
});
