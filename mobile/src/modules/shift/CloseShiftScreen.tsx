/**
 * Close shift screen.
 *
 * Shows the expected cash (from shift summary), asks for the actual
 * physical cash counted, computes the variance live, warns on large
 * variance, then closes the shift.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../app/navigation';
import { useShiftStore } from '../../stores/shiftStore';
import {
  closeShift,
  getShiftSummary,
  ShiftSummary,
} from '../../services/shiftApi';
import { formatRupiah } from '../../stores/cartStore';

type Props = NativeStackScreenProps<AppStackParamList, 'CloseShift'>;

/** Warn when |variance| exceeds 1% of expected (or any amount if expected is 0). */
const VARIANCE_WARN_RATIO = 0.01;

export default function CloseShiftScreen({ navigation }: Props) {
  const currentShift = useShiftStore(s => s.currentShift);
  const setCurrentShift = useShiftStore(s => s.setCurrentShift);

  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actualText, setActualText] = useState('');
  const [notes, setNotes] = useState('');
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!currentShift) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const s = await getShiftSummary(currentShift.id);
        setSummary(s);
      } catch (e) {
        Alert.alert(
          'Gagal',
          e instanceof Error ? e.message : 'Gagal memuat ringkasan shift.',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [currentShift]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Memuat ringkasan…</Text>
      </View>
    );
  }

  if (!currentShift) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Tidak ada shift aktif</Text>
      </View>
    );
  }

  const expected = summary?.expectedCash ?? currentShift.expectedCash;
  const actual = Number(actualText.replace(/[^0-9]/g, '')) || 0;
  const hasInput = actualText.trim().length > 0;
  const variance = actual - expected;
  const warnThreshold = Math.max(expected * VARIANCE_WARN_RATIO, expected === 0 ? 0 : 1);
  const showWarning = hasInput && Math.abs(variance) > warnThreshold;

  const doClose = () => {
    if (!hasInput) {
      Alert.alert('Jumlah belum diisi', 'Hitung kas fisik lalu masukkan jumlahnya.');
      return;
    }
    const msg =
      `Ekspektasi: ${formatRupiah(expected)}\n` +
      `Fisik: ${formatRupiah(actual)}\n` +
      `Selisih: ${formatRupiah(variance)}` +
      (showWarning ? '\n\n⚠️ Selisih cukup besar, pastikan hitungan benar.' : '');
    Alert.alert('Tutup Shift?', msg, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Tutup',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setClosing(true);
            try {
              await closeShift(actual, notes);
              setCurrentShift(null);
              Alert.alert('Shift ditutup', 'Shift berhasil ditutup.', [
                {
                  text: 'OK',
                  onPress: () => navigation.popToTop(),
                },
              ]);
            } catch (e) {
              Alert.alert(
                'Gagal',
                e instanceof Error ? e.message : 'Gagal menutup shift.',
              );
            } finally {
              setClosing(false);
            }
          })();
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ringkasan Shift</Text>
        {summary && (
          <>
            <Row label="Penjualan tunai" value={formatRupiah(summary.cashSales)} />
            <Row label="Kas masuk" value={formatRupiah(summary.cashIn)} />
            <Row label="Kas keluar" value={formatRupiah(summary.cashOut)} />
            <View style={styles.divider} />
          </>
        )}
        <Row label="Ekspektasi kas" value={formatRupiah(expected)} bold />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Hitung Kas Fisik</Text>
        <Text style={styles.label}>Jumlah uang fisik di laci (Rp)</Text>
        <TextInput
          style={styles.input}
          value={actualText}
          onChangeText={setActualText}
          keyboardType="numeric"
          placeholder="0"
        />
        {hasInput && (
          <>
            <Row
              label="Selisih"
              value={formatRupiah(variance)}
            />
            {showWarning && (
              <Text style={styles.warning}>
                ⚠️ Selisih melebihi batas wajar. Periksa kembali hitungan kas.
              </Text>
            )}
            {variance === 0 && (
              <Text style={styles.ok}>✓ Kas cocok dengan ekspektasi.</Text>
            )}
          </>
        )}
        <Text style={styles.label}>Catatan (opsional)</Text>
        <TextInput
          style={styles.input}
          value={notes}
          onChangeText={setNotes}
          placeholder="cth. Selisih karena…"
        />
      </View>

      <Pressable
        style={[styles.dangerBtn, closing && styles.btnDisabled]}
        onPress={doClose}
        disabled={closing}>
        <Text style={styles.dangerBtnText}>
          {closing ? 'Menutup…' : 'Tutup Shift'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  muted: {
    color: '#666',
    marginTop: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowLabel: {
    color: '#666',
    fontSize: 14,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  bold: {
    fontWeight: '700',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 8,
  },
  warning: {
    color: '#c62828',
    fontWeight: '600',
    marginTop: 8,
  },
  ok: {
    color: '#2e7d32',
    fontWeight: '600',
    marginTop: 8,
  },
  dangerBtn: {
    backgroundColor: '#c62828',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  dangerBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
