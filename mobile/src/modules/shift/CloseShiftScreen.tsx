/**
 * Close shift screen — modern minimalist.
 *
 * Shows the expected cash (from shift summary), asks for the actual
 * physical cash counted, computes the variance live, warns on large
 * variance, then closes the shift.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
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
import { Badge, Button, Card, EmptyState, Input, ScreenHeader } from '../../components';
import { colors, spacing, typography } from '../../theme';

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
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.centerText}>Memuat ringkasan…</Text>
      </View>
    );
  }

  if (!currentShift) {
    return (
      <View style={styles.center}>
        <EmptyState title="Tidak ada shift aktif" />
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <ScreenHeader
        title="Tutup Shift"
        subtitle="Hitung uang fisik di laci dan catat jumlahnya."
      />

      <Card style={styles.card}>
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
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Hitung Kas Fisik</Text>
        <Input
          label="Jumlah uang fisik di laci (Rp)"
          value={actualText}
          onChangeText={setActualText}
          keyboardType="numeric"
          placeholder="0"
          editable={!closing}
        />
        {hasInput && (
          <View style={styles.varianceBox}>
            <View style={styles.varianceRow}>
              <Text style={styles.varianceLabel}>Selisih</Text>
              <Text style={styles.varianceValue}>{formatRupiah(variance)}</Text>
            </View>
            {showWarning ? (
              <Badge label="Selisih melebihi batas wajar — periksa hitungan kas" tone="danger" />
            ) : variance === 0 ? (
              <Badge label="Kas cocok dengan ekspektasi" tone="accent" />
            ) : null}
          </View>
        )}
        <Input
          label="Catatan (opsional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="cth. Selisih karena…"
          editable={!closing}
        />
      </Card>

      <Button
        title={closing ? 'Menutup…' : 'Tutup Shift'}
        variant="danger"
        size="lg"
        onPress={doClose}
        loading={closing}
        style={styles.submit}
      />
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
      <Text style={[styles.rowValue, bold && styles.rowValueBold]}>{value}</Text>
    </View>
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
  card: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  rowValue: {
    ...typography.bodyBold,
    color: colors.text,
  },
  rowValueBold: {
    ...typography.title,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  varianceBox: {
    marginBottom: spacing.md,
  },
  varianceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  varianceLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  varianceValue: {
    ...typography.title,
    color: colors.text,
  },
  submit: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
});
